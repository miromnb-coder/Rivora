"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireQuoteAdmin } from "@/lib/rivora/quotes";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function asNumber(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
      tax_rate: 0,
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

export async function markQuoteSent(formData: FormData) {
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) throw new Error("Quote is required.");

  const { supabase } = await requireQuoteAdmin();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id, status")
    .eq("id", quoteId)
    .maybeSingle();

  if (!quote) throw new Error("Quote not found.");
  if (quote.status !== "approved") throw new Error("Approve the quote before marking it sent.");

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("quotes")
    .update({ status: "sent", sent_at: now, updated_at: now })
    .eq("id", quoteId);

  if (error) throw new Error(error.message);
  revalidatePath(`/app/quotes/${quoteId}`);
  revalidatePath("/app/quotes");
}
