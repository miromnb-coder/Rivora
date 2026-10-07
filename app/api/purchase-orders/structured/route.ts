import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireWorkspace } from "@/lib/rivora/workspace";
import {
  parseTabularFile,
  PURCHASE_ORDER_FIELD_MEMORY_TARGETS,
  sourceTypeFromName,
  toPurchaseOrderRowsWithFieldMemory,
  type PurchaseOrderFieldMemory,
  type PurchaseOrderFieldMemoryTarget,
} from "@/lib/rivora/imports";
import { reconcilePurchaseOrderForWorkspace } from "@/lib/rivora/po-reconciliation-service";

type WorkspaceContext = Awaited<ReturnType<typeof requireWorkspace>>;

function redirectTo(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

function message(error: unknown) {
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

async function loadQuote(
  supabase: WorkspaceContext["supabase"],
  organizationId: string,
  quoteId: string,
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

async function upsertCustomer(
  supabase: WorkspaceContext["supabase"],
  organizationId: string,
  name: string,
) {
  const { data, error } = await supabase
    .from("customers")
    .upsert(
      { organization_id: organizationId, name },
      { onConflict: "organization_id,name" },
    )
    .select("id,name")
    .single();

  if (error) throw error;
  return data;
}

export async function POST(request: Request) {
  let purchaseOrderId: string | null = null;
  let context: WorkspaceContext | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("purchaseOrder");
    const customerInput = clean(formData.get("customerName"), 200);
    const poNumber = clean(formData.get("poNumber"), 200);
    const quoteId = clean(formData.get("quoteId"), 80);
    const currencyInput = clean(formData.get("currency"), 3);
    const orderDateInput = clean(formData.get("orderDate"), 10);

    if (!(file instanceof File) || file.size === 0) {
      throw new Error("Choose a CSV or XLSX purchase order.");
    }
    if (!poNumber) throw new Error("Purchase order number is required.");

    context = await requireWorkspace();
    if (!["owner", "admin", "member"].includes(context.workspace.role)) {
      throw new Error("Reviewer access is read-only.");
    }

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

    const { data: fieldMemoryRows, error: fieldMemoryError } = await supabase
      .from("workspace_memory_entries")
      .select("id,source_value,target_value")
      .eq("organization_id", workspace.id)
      .eq("customer_id", customerId)
      .eq("scope", "customer")
      .eq("memory_type", "customer_po_field_alias")
      .eq("target_entity_type", "po_field")
      .eq("verification_state", "verified");

    if (fieldMemoryError) throw fieldMemoryError;

    const allowedFieldTargets = new Set<string>(
      PURCHASE_ORDER_FIELD_MEMORY_TARGETS,
    );
    const fieldMemories: PurchaseOrderFieldMemory[] = [];
    for (const memory of fieldMemoryRows ?? []) {
      const targetField = String(memory.target_value ?? "");
      const sourceHeader = String(memory.source_value ?? "").trim();
      if (!sourceHeader || !allowedFieldTargets.has(targetField)) continue;

      fieldMemories.push({
        memoryId: String(memory.id),
        sourceHeader,
        targetField: targetField as PurchaseOrderFieldMemoryTarget,
      });
    }

    const parsed = toPurchaseOrderRowsWithFieldMemory(
      await parseTabularFile(file),
      fieldMemories,
    );
    const rows = parsed.rows;
    const memoryContext = parsed.usedMemories.length
      ? {
          po_field_memories: parsed.usedMemories.map((memory) => ({
            memory_id: memory.memoryId,
            source_header: memory.sourceHeader,
            target_field: memory.targetField,
          })),
        }
      : {};
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
        memory_context: memoryContext,
        created_by: String(context.claims.sub),
      })
      .select("id")
      .single();

    if (poError) throw poError;
    purchaseOrderId = String(purchaseOrder.id);

    const storagePath =
      `${workspace.id}/${purchaseOrderId}/${Date.now()}-${safeStorageFilename(file.name)}`;

    const { error: uploadError } = await supabase.storage
      .from("purchase-order-files")
      .upload(storagePath, file, {
        upsert: false,
        cacheControl: "3600",
        ...(file.type ? { contentType: file.type } : {}),
      });
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

    const linePayload = rows.map((line, index) => ({
      organization_id: workspace.id,
      purchase_order_id: purchaseOrderId,
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
      .eq("id", purchaseOrderId)
      .eq("organization_id", workspace.id);
    if (readyError) throw readyError;

    if (selectedQuote) {
      try {
        await reconcilePurchaseOrderForWorkspace({
          supabase,
          organizationId: workspace.id,
          purchaseOrderId,
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
          .eq("id", purchaseOrderId)
          .eq("organization_id", workspace.id);
      }
    }

    return redirectTo(request, `/app/purchase-orders/${purchaseOrderId}`);
  } catch (error) {
    const failure = message(error);

    if (context && purchaseOrderId) {
      await context.supabase
        .from("purchase_orders")
        .update({
          status: "failed",
          processing_error: failure.slice(0, 2000),
          updated_at: new Date().toISOString(),
        })
        .eq("id", purchaseOrderId)
        .eq("organization_id", context.workspace.id);

      return redirectTo(
        request,
        `/app/purchase-orders/${purchaseOrderId}?error=${encodeURIComponent(failure)}`,
      );
    }

    return redirectTo(
      request,
      `/app/purchase-orders?structuredError=${encodeURIComponent(failure)}`,
    );
  }
}
