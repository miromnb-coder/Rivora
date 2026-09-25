"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireQuoteAdmin } from "@/lib/rivora/quotes";
import {
  loadQuoteDocumentData,
  quotePdfFilename,
  renderQuotePdf,
} from "@/lib/rivora/quote-document";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getEditableQuote(quoteId: string) {
  const context = await requireQuoteAdmin();
  const { data: quote } = await context.supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .maybeSingle();

  if (!quote) throw new Error("Quote not found.");
  if (!["draft", "ready"].includes(quote.status)) {
    throw new Error("Approved or sent quotes are locked.");
  }

  return { ...context, quote };
}

export async function createQuoteFromRfq(formData: FormData) {
  const rfqId = String(formData.get("rfqId") ?? "");
  if (!rfqId) throw new Error("RFQ is required.");

  const { supabase, workspace, claims } = await requireQuoteAdmin();

  const { data: existing } = await supabase
    .from("quotes")
    .select("id")
    .eq("rfq_id", rfqId)
    .maybeSingle();

  if (existing) redirect(`/app/quotes/${existing.id}`);

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, organization_id, customer_id, reference, status")
    .eq("id", rfqId)
    .maybeSingle();

  if (!rfq || rfq.organization_id !== workspace.id) {
    throw new Error("RFQ not found.");
  }

  if (rfq.status !== "ready") {
    throw new Error("Resolve every RFQ line before creating a quote.");
  }

  if (!rfq.customer_id) {
    throw new Error("RFQ needs a customer before quote creation.");
  }

  const { data: rfqLines } = await supabase
    .from("rfq_lines")
    .select("id, line_number, quantity, unit, selected_product_id, review_status")
    .eq("rfq_id", rfqId)
    .order("line_number");

  if (!rfqLines?.length) throw new Error("RFQ has no lines.");

  const unresolved = rfqLines.some(
    (line) =>
      !line.selected_product_id ||
      ["needs_review", "unmatched", "pending"].includes(line.review_status)
  );

  if (unresolved) {
    throw new Error("Resolve every RFQ line before creating a quote.");
  }

  const productIds = [...new Set(rfqLines.map((line) => line.selected_product_id).filter(Boolean))] as string[];
  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name, unit, unit_price")
    .in("id", productIds);

  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  if (productMap.size !== productIds.length) {
    throw new Error("One or more selected products are unavailable.");
  }

  const quoteNumber = `Q-${new Date().getUTCFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const now = new Date().toISOString();
  const validity = new Date();
  validity.setUTCDate(validity.getUTCDate() + workspace.defaultQuoteValidityDays);
  const validUntil = validity.toISOString().slice(0, 10);

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      organization_id: workspace.id,
      customer_id: rfq.customer_id,
      rfq_id: rfq.id,
      quote_number: quoteNumber,
      status: "draft",
      currency: "EUR",
      customer_reference: rfq.reference ?? null,
      valid_until: validUntil,
      tax_rate: workspace.defaultTaxRate,
      created_by: claims.sub,
      updated_at: now,
    })
    .select("id")
    .single();

  if (quoteError || !quote) {
    throw new Error(quoteError?.message || "Could not create quote.");
  }

  const lines = rfqLines.map((line) => {
    const product = productMap.get(line.selected_product_id as string)!;
    const quantity = Number(line.quantity);
    const unitPrice = Number(product.unit_price ?? 0);

    return {
      organization_id: workspace.id,
      quote_id: quote.id,
      source_rfq_line_id: line.id,
      line_number: line.line_number,
      product_id: product.id,
      sku_snapshot: product.sku,
      description_snapshot: product.name,
      quantity,
      unit: line.unit || product.unit || "pcs",
      catalogue_unit_price: product.unit_price == null ? null : unitPrice,
      unit_price: unitPrice,
      discount_percent: 0,
      line_total: roundMoney(quantity * unitPrice),
      updated_at: now,
    };
  });

  const { error: linesError } = await supabase.from("quote_lines").insert(lines);

  if (linesError) {
    await supabase.from("quotes").delete().eq("id", quote.id);
    throw new Error(linesError.message);
  }

  revalidatePath("/app/quotes");
  revalidatePath(`/app/rfq/${rfqId}`);
  redirect(`/app/quotes/${quote.id}`);
}

export async function updateQuoteHeader(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  const validUntil = String(formData.get("validUntil") ?? "").trim();
  const customerReference = String(formData.get("customerReference") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const taxRate = asNumber(formData.get("taxRate"));

  if (!quoteId) throw new Error("Quote is required.");
  if (validUntil && !DATE_RE.test(validUntil)) throw new Error("Invalid validity date.");
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error("Invalid VAT rate.");
  if (customerReference.length > 300 || notes.length > 5000) throw new Error("Quote field is too long.");

  const { supabase } = await getEditableQuote(quoteId);
  const { error } = await supabase
    .from("quotes")
    .update({
      valid_until: validUntil || null,
      customer_reference: customerReference || null,
      notes: notes || null,
      tax_rate: taxRate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app/quotes");
}

export async function updateQuoteDelivery(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  const recipientContactId = String(formData.get("recipientContactId") ?? "").trim();
  let recipientName = String(formData.get("recipientName") ?? "").trim();
  let recipientEmail = String(formData.get("recipientEmail") ?? "").trim().toLowerCase();

  if (!quoteId) throw new Error("Quote is required.");
  if (recipientName.length > 160) throw new Error("Recipient name is too long.");
  if (recipientEmail && !EMAIL_RE.test(recipientEmail)) throw new Error("Enter a valid customer email.");

  const { supabase, workspace } = await requireQuoteAdmin();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, customer_id")
    .eq("id", quoteId)
    .maybeSingle();

  if (!quote) throw new Error("Quote not found.");
  if (["sent", "expired"].includes(quote.status)) {
    throw new Error("Sent or expired quote delivery details are locked.");
  }

  let savedContactId: string | null = null;
  if (recipientContactId) {
    const { data: contact } = await supabase
      .from("customer_contacts")
      .select("id, name, email")
      .eq("id", recipientContactId)
      .eq("customer_id", quote.customer_id)
      .eq("organization_id", workspace.id)
      .maybeSingle();

    if (!contact) throw new Error("Selected customer contact was not found.");
    recipientName = contact.name;
    recipientEmail = contact.email.toLowerCase();
    savedContactId = contact.id;
  }

  const { error } = await supabase
    .from("quotes")
    .update({
      recipient_contact_id: savedContactId,
      recipient_name: recipientName || null,
      recipient_email: recipientEmail || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", quoteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app/quotes");
}

export async function updateQuoteLine(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const quantity = asNumber(formData.get("quantity"));
  const unitPrice = asNumber(formData.get("unitPrice"));
  const discount = asNumber(formData.get("discountPercent"));

  if (!quoteId || !lineId) throw new Error("Quote line is required.");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantity must be above zero.");
  if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error("Unit price cannot be negative.");
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) throw new Error("Discount must be 0–100%.");

  const { supabase } = await getEditableQuote(quoteId);
  const lineTotal = roundMoney(quantity * unitPrice * (1 - discount / 100));

  const { error } = await supabase
    .from("quote_lines")
    .update({
      quantity,
      unit_price: unitPrice,
      discount_percent: discount,
      line_total: lineTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lineId)
    .eq("quote_id", quoteId);

  if (error) throw new Error(error.message);
  await supabase.from("quotes").update({ updated_at: new Date().toISOString() }).eq("id", quoteId);

  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app/quotes");
}

export async function markQuoteReady(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) throw new Error("Quote is required.");

  const { supabase, quote } = await getEditableQuote(quoteId);
  if (quote.status !== "draft") return;

  const { data: lines } = await supabase
    .from("quote_lines")
    .select("id, quantity, unit_price")
    .eq("quote_id", quoteId);

  if (!lines?.length || lines.some((line) => Number(line.quantity) <= 0 || Number(line.unit_price) < 0)) {
    throw new Error("Complete quote pricing before marking it ready.");
  }

  const { error } = await supabase
    .from("quotes")
    .update({ status: "ready", updated_at: new Date().toISOString() })
    .eq("id", quoteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app/quotes");
}

export async function returnQuoteToDraft(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) throw new Error("Quote is required.");

  const { supabase, quote } = await getEditableQuote(quoteId);
  if (quote.status !== "ready") return;

  const { error } = await supabase
    .from("quotes")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", quoteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app/quotes");
}

export async function approveQuote(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) throw new Error("Quote is required.");

  const { supabase, claims } = await requireQuoteAdmin();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .maybeSingle();

  if (!quote) throw new Error("Quote not found.");
  if (quote.status !== "ready") throw new Error("Only a ready quote can be approved.");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("quotes")
    .update({
      status: "approved",
      approved_by: claims.sub,
      approved_at: now,
      updated_at: now,
    })
    .eq("id", quoteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app/quotes");
}

export async function sendQuoteEmail(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) throw new Error("Quote is required.");

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = (process.env.NODRA_QUOTE_FROM ?? process.env.RIVORA_QUOTE_FROM)?.trim();
  const replyTo = (process.env.NODRA_QUOTE_REPLY_TO ?? process.env.RIVORA_QUOTE_REPLY_TO)?.trim();

  if (!apiKey || !from) {
    throw new Error("Quote email delivery is not configured.");
  }

  const { supabase, workspace } = await requireQuoteAdmin();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status, quote_number, recipient_name, recipient_email, approved_at, sent_at, delivery_status, delivery_attempt_count")
    .eq("id", quoteId)
    .maybeSingle();

  if (!quote) throw new Error("Quote not found.");

  const isInitialSend = quote.status === "approved";
  const isRetry =
    quote.status === "sent" &&
    ["bounced", "failed"].includes(String(quote.delivery_status ?? ""));

  if (!isInitialSend && !isRetry) {
    throw new Error("Quotes can only be sent after approval or retried after a failed delivery.");
  }

  if (!quote.recipient_email || !EMAIL_RE.test(quote.recipient_email)) {
    throw new Error("Add a valid customer email before sending.");
  }

  const document = await loadQuoteDocumentData(supabase, quoteId);
  if (!document) throw new Error("Quote document could not be generated.");

  const pdf = await renderQuotePdf(document);
  const subject = `${workspace.name} - Quote ${document.quoteNumber}`;
  const recipient = document.recipientName || document.customerName;
  const total = document.lines.reduce((sum, item) => sum + Number(item.line_total), 0);
  const tax = total * (document.taxRate / 100);
  const grand = total + tax;
  const totalLabel = new Intl.NumberFormat("en-FI", {
    style: "currency",
    currency: document.currency,
  }).format(grand);

  const text = [
    `Hello ${recipient},`,
    "",
    `Please find quote ${document.quoteNumber} attached as a PDF.`,
    `Quote total: ${totalLabel}`,
    document.validUntil ? `Valid until: ${document.validUntil}` : "",
    "",
    "Best regards,",
    workspace.name,
  ].filter(Boolean).join("\n");

  const html = `<div style="font-family:Arial,sans-serif;color:#202520;line-height:1.6">
    <p>Hello ${escapeHtml(recipient)},</p>
    <p>Please find quote <strong>${escapeHtml(document.quoteNumber)}</strong> attached as a PDF.</p>
    <p><strong>Quote total:</strong> ${escapeHtml(totalLabel)}${document.validUntil ? `<br><strong>Valid until:</strong> ${escapeHtml(document.validUntil)}` : ""}</p>
    <p>Best regards,<br>${escapeHtml(workspace.name)}</p>
  </div>`;

  const nextAttempt = Number(quote.delivery_attempt_count ?? 0) + 1;

  const body: Record<string, unknown> = {
    from,
    to: [quote.recipient_email],
    subject,
    text,
    html,
    attachments: [
      {
        filename: quotePdfFilename(document.quoteNumber),
        content: pdf.toString("base64"),
      },
    ],
    tags: [
      { name: "nodra_quote_id", value: quote.id },
      { name: "nodra_attempt", value: String(nextAttempt) },
    ],
  };

  if (replyTo) body.reply_to = [replyTo];



  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `nodra-quote-${quote.id}-attempt-${nextAttempt}`,
    },
    body: JSON.stringify(body),
  });

  const providerResult = (await response.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
  };

  if (!response.ok || !providerResult.id) {
    throw new Error(providerResult.message || "Quote email could not be sent.");
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("quotes")
    .update({
      status: "sent",
      sent_at: quote.sent_at || now,
      last_sent_at: now,
      sent_to_email: quote.recipient_email,
      email_provider_id: providerResult.id,
      delivery_status: "sent",
      delivery_status_at: now,
      delivered_at: null,
      bounced_at: null,
      failed_at: null,
      delivery_attempt_count: nextAttempt,
      updated_at: now,
    })
    .eq("id", quoteId);

  if (error) {
    throw new Error("Email was accepted by the provider, but Nodra could not record the sent state.");
  }

  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app/quotes");
}
