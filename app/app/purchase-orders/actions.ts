"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import {
  parseTabularFile,
  sourceTypeFromName,
  toPurchaseOrderRows,
} from "@/lib/rivora/imports";
import { extractPurchaseOrderFromPdf } from "@/lib/rivora/openai-po";
import { reconcilePurchaseOrderForWorkspace } from "@/lib/rivora/po-reconciliation-service";

type WorkspaceContext = Awaited<ReturnType<typeof requireWorkspace>>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected purchase order import error.";
}

function clean(value: FormDataEntryValue | null, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeCurrency(value: string | null | undefined) {
  const currency = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function normalizeDate(value: string | null | undefined) {
  const date = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function filenameWithoutExtension(name: string) {
  return name.replace(/\.[^.]+$/, "").trim() || "Purchase order";
}

function safeStorageFilename(name: string) {
  const safe = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return safe.slice(0, 180) || "purchase-order";
}

async function sha256ForFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function requirePurchaseOrderWriter() {
  const context = await requireWorkspace();
  if (!["owner", "admin", "member"].includes(context.workspace.role)) {
    throw new Error("Reviewer access is read-only.");
  }
  return context;
}

async function upsertCustomer(
  supabase: WorkspaceContext["supabase"],
  organizationId: string,
  name: string
) {
  const { data, error } = await supabase
    .from("customers")
    .upsert(
      { organization_id: organizationId, name },
      { onConflict: "organization_id,name" }
    )
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

async function loadQuote(
  supabase: WorkspaceContext["supabase"],
  organizationId: string,
  quoteId: string
) {
  if (!quoteId) return null;

  const { data, error } = await supabase
    .from("quotes")
    .select("id,customer_id,quote_number,currency,status,customers(name)")
    .eq("id", quoteId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Selected quote was not found in this workspace.");
  if (!["approved", "sent"].includes(String(data.status))) {
    throw new Error("Choose an approved or sent quote for the purchase order.");
  }

  const customer = Array.isArray((data as any).customers)
    ? (data as any).customers[0]
    : (data as any).customers;

  return {
    id: String(data.id),
    customerId: String(data.customer_id),
    customerName: String(customer?.name ?? ""),
    quoteNumber: data.quote_number ? String(data.quote_number) : null,
    currency: data.currency ? String(data.currency) : null,
  };
}

async function storePurchaseOrderFile({
  context,
  purchaseOrderId,
  file,
  sha256,
}: {
  context: WorkspaceContext;
  purchaseOrderId: string;
  file: File;
  sha256: string;
}) {
  const { supabase, workspace } = context;
  const storagePath = `${workspace.id}/${purchaseOrderId}/${Date.now()}-${safeStorageFilename(file.name)}`;

  const uploadOptions: {
    upsert: boolean;
    cacheControl: string;
    contentType?: string;
  } = {
    upsert: false,
    cacheControl: "3600",
  };
  if (file.type) uploadOptions.contentType = file.type;

  const { error: uploadError } = await supabase.storage
    .from("purchase-order-files")
    .upload(storagePath, file, uploadOptions);

  if (uploadError) {
    throw new Error(`Purchase order file upload failed: ${uploadError.message}`);
  }

  const { error: fileRowError } = await supabase.from("purchase_order_files").insert({
    organization_id: workspace.id,
    purchase_order_id: purchaseOrderId,
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type || null,
    size_bytes: file.size,
    sha256,
  });

  if (fileRowError) {
    await supabase.storage.from("purchase-order-files").remove([storagePath]);
    throw fileRowError;
  }
}

async function markFailed(
  context: WorkspaceContext | null,
  purchaseOrderId: string | null,
  message: string
) {
  if (!context || !purchaseOrderId) return;
  await context.supabase
    .from("purchase_orders")
    .update({
      status: "failed",
      processing_error: message.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", purchaseOrderId)
    .eq("organization_id", context.workspace.id);
}

export async function processPdfPurchaseOrder(formData: FormData) {
  const file = formData.get("pdfPurchaseOrder");
  const customerOverride = clean(formData.get("pdfCustomerName"), 200);
  const poNumberOverride = clean(formData.get("pdfPoNumber"), 200);
  const quoteId = clean(formData.get("pdfQuoteId"), 80);

  let purchaseOrderId: string | null = null;
  let context: WorkspaceContext | null = null;
  let failure: string | null = null;

  try {
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose a purchase order PDF.");
    }

    context = await requirePurchaseOrderWriter();
    const { supabase, workspace } = context;
    const selectedQuote = await loadQuote(supabase, workspace.id, quoteId);
    const result = await extractPurchaseOrderFromPdf(file);
    const extracted = result.extraction;

    if (extracted.document_type === "rfq") {
      throw new Error("This PDF looks like an RFQ, not a purchase order.");
    }
    if (extracted.document_type !== "purchase_order") {
      throw new Error("The PDF could not be identified as a purchase order.");
    }

    let customerId: string;
    let customerName: string;

    if (selectedQuote) {
      customerId = selectedQuote.customerId;
      customerName = selectedQuote.customerName;
    } else {
      customerName = customerOverride || extracted.customer_name?.trim() || "";
      if (!customerName) {
        throw new Error(
          "Customer could not be identified. Enter the customer name or select a quote."
        );
      }
      const customer = await upsertCustomer(supabase, workspace.id, customerName);
      customerId = customer.id;
      customerName = customer.name;
    }

    const warnings = [...extracted.warnings];
    if (
      selectedQuote &&
      extracted.customer_name &&
      selectedQuote.customerName &&
      extracted.customer_name.trim().toLowerCase() !== selectedQuote.customerName.trim().toLowerCase()
    ) {
      warnings.push(
        `PO customer "${extracted.customer_name}" differs from selected quote customer "${selectedQuote.customerName}".`
      );
    }

    const poNumber =
      poNumberOverride ||
      extracted.po_number?.trim() ||
      filenameWithoutExtension(file.name);
    const currency =
      normalizeCurrency(extracted.currency) ||
      normalizeCurrency(selectedQuote?.currency) ||
      "EUR";

    const { data: purchaseOrder, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        organization_id: workspace.id,
        customer_id: customerId,
        quote_id: selectedQuote?.id ?? null,
        po_number: poNumber,
        quote_reference:
          extracted.quote_reference?.trim() || selectedQuote?.quoteNumber || null,
        source_type: "pdf",
        source_file_name: file.name,
        status: "processing",
        currency,
        order_date: normalizeDate(extracted.order_date),
        overall_confidence: extracted.overall_confidence,
        extraction_provider: result.provider,
        extraction_model: result.model,
        extraction_confidence: extracted.overall_confidence,
        extraction_warnings: warnings,
        extraction_completed_at: new Date().toISOString(),
        created_by: String(context.claims.sub),
      })
      .select("id")
      .single();

    if (poError) throw poError;
    const createdPurchaseOrderId = String(purchaseOrder.id);
    purchaseOrderId = createdPurchaseOrderId;

    await storePurchaseOrderFile({
      context,
      purchaseOrderId: createdPurchaseOrderId,
      file,
      sha256: result.sha256,
    });

    const linePayload = extracted.lines.map((line, index) => ({
      organization_id: workspace.id,
      purchase_order_id: createdPurchaseOrderId,
      line_number: index + 1,
      customer_sku: line.customer_sku || null,
      raw_description: line.description,
      manufacturer: line.manufacturer,
      manufacturer_part_number: line.manufacturer_part_number,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unit_price,
      line_total: line.line_total,
      extraction_confidence: line.confidence,
      source_page: line.source_page,
      extraction_notes: line.notes,
    }));

    const { error: lineError } = await supabase
      .from("purchase_order_lines")
      .insert(linePayload);
    if (lineError) throw lineError;

    const { error: auditError } = await supabase.from("ai_extractions").insert({
      organization_id: workspace.id,
      purchase_order_id: createdPurchaseOrderId,
      provider: result.provider,
      model: result.model,
      response_id: result.responseId,
      status: "completed",
      source_file_name: file.name,
      source_file_sha256: result.sha256,
      document_type: extracted.document_type,
      overall_confidence: extracted.overall_confidence,
      extracted_payload: extracted,
      warnings,
      usage: result.usage,
    });
    if (auditError) throw auditError;

    const { error: readyError } = await supabase
      .from("purchase_orders")
      .update({
        status: "extracted",
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdPurchaseOrderId)
      .eq("organization_id", workspace.id);

    if (readyError) throw readyError;

    if (selectedQuote) {
      try {
        await reconcilePurchaseOrderForWorkspace({
          supabase,
          organizationId: workspace.id,
          purchaseOrderId: createdPurchaseOrderId,
        });
      } catch (reconciliationError) {
        const reconciliationMessage =
          reconciliationError instanceof Error
            ? reconciliationError.message
            : "Purchase order reconciliation failed.";
        await supabase
          .from("purchase_orders")
          .update({
            status: "extracted",
            processing_error: `Reconciliation: ${reconciliationMessage}`.slice(0, 2000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", createdPurchaseOrderId)
          .eq("organization_id", workspace.id);
      }
    }
  } catch (error) {
    failure = errorMessage(error);
    await markFailed(context, purchaseOrderId, failure);
  }

  if (failure && purchaseOrderId) {
    revalidatePath("/app/purchase-orders");
    redirect(`/app/purchase-orders/${purchaseOrderId}?error=${encodeURIComponent(failure)}`);
  }
  if (failure) {
    redirect(`/app/purchase-orders?pdfError=${encodeURIComponent(failure)}`);
  }
  if (!purchaseOrderId) {
    redirect("/app/purchase-orders?pdfError=Purchase%20order%20creation%20failed");
  }

  revalidatePath("/app/purchase-orders");
  redirect(`/app/purchase-orders/${purchaseOrderId}`);
}

export async function processStructuredPurchaseOrder(formData: FormData) {
  const file = formData.get("purchaseOrder");
  const customerInput = clean(formData.get("customerName"), 200);
  const poNumber = clean(formData.get("poNumber"), 200);
  const quoteId = clean(formData.get("quoteId"), 80);
  const currencyInput = clean(formData.get("currency"), 3);
  const orderDateInput = clean(formData.get("orderDate"), 10);

  let purchaseOrderId: string | null = null;
  let context: WorkspaceContext | null = null;
  let failure: string | null = null;

  try {
    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose a CSV or XLSX purchase order.");
    }
    if (!poNumber) throw new Error("Purchase order number is required.");

    context = await requirePurchaseOrderWriter();
    const { supabase, workspace } = context;
    const selectedQuote = await loadQuote(supabase, workspace.id, quoteId);

    let customerId: string;
    if (selectedQuote) {
      customerId = selectedQuote.customerId;
    } else {
      if (!customerInput) {
        throw new Error("Customer name is required when no quote is selected.");
      }
      const customer = await upsertCustomer(supabase, workspace.id, customerInput);
      customerId = customer.id;
    }

    const rows = toPurchaseOrderRows(await parseTabularFile(file));
    const sha256 = await sha256ForFile(file);
    const currency =
      normalizeCurrency(currencyInput) ||
      normalizeCurrency(selectedQuote?.currency) ||
      "EUR";

    const { data: purchaseOrder, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        organization_id: workspace.id,
        customer_id: customerId,
        quote_id: selectedQuote?.id ?? null,
        po_number: poNumber,
        quote_reference: selectedQuote?.quoteNumber ?? null,
        source_type: sourceTypeFromName(file.name),
        source_file_name: file.name,
        status: "processing",
        currency,
        order_date: normalizeDate(orderDateInput),
        created_by: String(context.claims.sub),
      })
      .select("id")
      .single();

    if (poError) throw poError;
    const createdPurchaseOrderId = String(purchaseOrder.id);
    purchaseOrderId = createdPurchaseOrderId;

    await storePurchaseOrderFile({
      context,
      purchaseOrderId: createdPurchaseOrderId,
      file,
      sha256,
    });

    const linePayload = rows.map((line, index) => ({
      organization_id: workspace.id,
      purchase_order_id: createdPurchaseOrderId,
      line_number: index + 1,
      customer_sku: line.customerSku,
      raw_description: line.description,
      manufacturer: line.manufacturer,
      manufacturer_part_number: line.manufacturerPartNumber,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
    }));

    const { error: lineError } = await supabase
      .from("purchase_order_lines")
      .insert(linePayload);
    if (lineError) throw lineError;

    const { error: readyError } = await supabase
      .from("purchase_orders")
      .update({
        status: "extracted",
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", createdPurchaseOrderId)
      .eq("organization_id", workspace.id);

    if (readyError) throw readyError;

    if (selectedQuote) {
      try {
        await reconcilePurchaseOrderForWorkspace({
          supabase,
          organizationId: workspace.id,
          purchaseOrderId: createdPurchaseOrderId,
        });
      } catch (reconciliationError) {
        const reconciliationMessage =
          reconciliationError instanceof Error
            ? reconciliationError.message
            : "Purchase order reconciliation failed.";
        await supabase
          .from("purchase_orders")
          .update({
            status: "extracted",
            processing_error: `Reconciliation: ${reconciliationMessage}`.slice(0, 2000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", createdPurchaseOrderId)
          .eq("organization_id", workspace.id);
      }
    }
  } catch (error) {
    failure = errorMessage(error);
    await markFailed(context, purchaseOrderId, failure);
  }

  if (failure && purchaseOrderId) {
    revalidatePath("/app/purchase-orders");
    redirect(`/app/purchase-orders/${purchaseOrderId}?error=${encodeURIComponent(failure)}`);
  }
  if (failure) {
    redirect(`/app/purchase-orders?structuredError=${encodeURIComponent(failure)}`);
  }
  if (!purchaseOrderId) {
    redirect("/app/purchase-orders?structuredError=Purchase%20order%20creation%20failed");
  }

  revalidatePath("/app/purchase-orders");
  redirect(`/app/purchase-orders/${purchaseOrderId}`);
}
