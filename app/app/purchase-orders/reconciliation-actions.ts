"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { reconcilePurchaseOrderForWorkspace } from "@/lib/rivora/po-reconciliation-service";

function clean(value: FormDataEntryValue | null, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

async function requireReviewer() {
  const context = await requireWorkspace();
  if (!["owner", "admin", "member"].includes(context.workspace.role)) {
    throw new Error("Reviewer access is read-only.");
  }
  return context;
}

async function requireApprover() {
  const context = await requireWorkspace();
  if (!["owner", "admin"].includes(context.workspace.role)) {
    throw new Error("Owner or admin access is required to approve PO reconciliation.");
  }
  return context;
}

function detailUrl(purchaseOrderId: string, message?: string, type: "ok" | "error" = "ok") {
  const key = type === "error" ? "reconcileError" : "reconciled";
  return message
    ? `/app/purchase-orders/${purchaseOrderId}?${key}=${encodeURIComponent(message)}`
    : `/app/purchase-orders/${purchaseOrderId}`;
}

export async function runPurchaseOrderReconciliation(formData: FormData) {
  const purchaseOrderId = clean(formData.get("purchaseOrderId"), 80);
  if (!purchaseOrderId) throw new Error("Purchase order ID is required.");

  try {
    const { supabase, workspace } = await requireReviewer();
    const result = await reconcilePurchaseOrderForWorkspace({
      supabase,
      organizationId: workspace.id,
      purchaseOrderId,
    });

    revalidatePath("/app/purchase-orders");
    revalidatePath(`/app/purchase-orders/${purchaseOrderId}`);
    redirect(
      detailUrl(
        purchaseOrderId,
        result.status === "matched"
          ? "Quote and purchase order match."
          : "Reconciliation completed. Review the exceptions.",
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reconciliation failed.";
    redirect(detailUrl(purchaseOrderId, message, "error"));
  }
}

export async function linkPurchaseOrderQuote(formData: FormData) {
  const purchaseOrderId = clean(formData.get("purchaseOrderId"), 80);
  const quoteId = clean(formData.get("quoteId"), 80);
  if (!purchaseOrderId || !quoteId) throw new Error("Purchase order and quote are required.");

  try {
    const { supabase, workspace } = await requireReviewer();

    const { data: purchaseOrder, error: poError } = await supabase
      .from("purchase_orders")
      .select("id,customer_id,status,quote_reference")
      .eq("id", purchaseOrderId)
      .eq("organization_id", workspace.id)
      .maybeSingle();

    if (poError) throw poError;
    if (!purchaseOrder) throw new Error("Purchase order not found.");
    if (["approved", "ready_for_erp", "erp_created"].includes(String(purchaseOrder.status))) {
      throw new Error("Approved purchase order reconciliation is locked.");
    }

    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("id,customer_id,quote_number,status")
      .eq("id", quoteId)
      .eq("organization_id", workspace.id)
      .maybeSingle();

    if (quoteError) throw quoteError;
    if (!quote) throw new Error("Quote not found.");
    if (!["approved", "sent"].includes(String(quote.status))) {
      throw new Error("Choose an approved or sent quote.");
    }
    if (String(quote.customer_id) !== String(purchaseOrder.customer_id)) {
      throw new Error("The quote must belong to the same customer as the purchase order.");
    }

    const { error: updateError } = await supabase
      .from("purchase_orders")
      .update({
        quote_id: quote.id,
        quote_reference: purchaseOrder.quote_reference || quote.quote_number || null,
        status: "extracted",
        processing_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchaseOrderId)
      .eq("organization_id", workspace.id);

    if (updateError) throw updateError;

    const result = await reconcilePurchaseOrderForWorkspace({
      supabase,
      organizationId: workspace.id,
      purchaseOrderId,
    });

    revalidatePath("/app/purchase-orders");
    revalidatePath(`/app/purchase-orders/${purchaseOrderId}`);
    redirect(
      detailUrl(
        purchaseOrderId,
        result.status === "matched"
          ? "Quote linked and reconciliation matched."
          : "Quote linked. Review the reconciliation exceptions.",
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quote linking failed.";
    redirect(detailUrl(purchaseOrderId, message, "error"));
  }
}

export async function acceptPurchaseOrderException(formData: FormData) {
  const purchaseOrderId = clean(formData.get("purchaseOrderId"), 80);
  const reconciliationLineId = clean(formData.get("reconciliationLineId"), 80);
  const note = clean(formData.get("reviewNote"), 2000);
  if (!purchaseOrderId || !reconciliationLineId) {
    throw new Error("Purchase order and reconciliation line are required.");
  }

  try {
    const { supabase, workspace } = await requireReviewer();

    const { data: line, error: lineError } = await supabase
      .from("purchase_order_reconciliation_lines")
      .select("id,purchase_order_id,review_status")
      .eq("id", reconciliationLineId)
      .eq("organization_id", workspace.id)
      .maybeSingle();

    if (lineError) throw lineError;
    if (!line || String(line.purchase_order_id) !== purchaseOrderId) {
      throw new Error("Reconciliation exception not found.");
    }
    if (line.review_status !== "open") {
      throw new Error("This exception has already been reviewed.");
    }

    const { error: updateError } = await supabase
      .from("purchase_order_reconciliation_lines")
      .update({
        review_status: "accepted",
        review_note: note || null,
        reviewed_by: String((await supabase.auth.getClaims()).data?.claims?.sub ?? ""),
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", reconciliationLineId)
      .eq("organization_id", workspace.id);

    if (updateError) throw updateError;

    revalidatePath(`/app/purchase-orders/${purchaseOrderId}`);
    redirect(detailUrl(purchaseOrderId, "Exception accepted."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exception review failed.";
    redirect(detailUrl(purchaseOrderId, message, "error"));
  }
}

export async function acceptPurchaseOrderHeaderExceptions(formData: FormData) {
  const purchaseOrderId = clean(formData.get("purchaseOrderId"), 80);
  const reconciliationId = clean(formData.get("reconciliationId"), 80);
  const note = clean(formData.get("reviewNote"), 2000);
  if (!purchaseOrderId || !reconciliationId) {
    throw new Error("Purchase order and reconciliation are required.");
  }

  try {
    const { supabase, workspace } = await requireReviewer();
    const claims = await supabase.auth.getClaims();
    const userId = String(claims.data?.claims?.sub ?? "");

    const { data: reconciliation, error: reconciliationError } = await supabase
      .from("purchase_order_reconciliations")
      .select("id,purchase_order_id,header_review_status")
      .eq("id", reconciliationId)
      .eq("organization_id", workspace.id)
      .maybeSingle();

    if (reconciliationError) throw reconciliationError;
    if (!reconciliation || String(reconciliation.purchase_order_id) !== purchaseOrderId) {
      throw new Error("Reconciliation not found.");
    }
    if (reconciliation.header_review_status !== "open") {
      throw new Error("Header exceptions have already been reviewed.");
    }

    const { error: updateError } = await supabase
      .from("purchase_order_reconciliations")
      .update({
        header_review_status: "accepted",
        header_review_note: note || null,
        header_reviewed_by: userId || null,
        header_reviewed_at: new Date().toISOString(),
      })
      .eq("id", reconciliationId)
      .eq("organization_id", workspace.id);

    if (updateError) throw updateError;

    revalidatePath(`/app/purchase-orders/${purchaseOrderId}`);
    redirect(detailUrl(purchaseOrderId, "Header exceptions accepted."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Header exception review failed.";
    redirect(detailUrl(purchaseOrderId, message, "error"));
  }
}

export async function approvePurchaseOrderReconciliation(formData: FormData) {
  const purchaseOrderId = clean(formData.get("purchaseOrderId"), 80);
  const reconciliationId = clean(formData.get("reconciliationId"), 80);
  if (!purchaseOrderId || !reconciliationId) {
    throw new Error("Purchase order and reconciliation are required.");
  }

  try {
    const { supabase } = await requireApprover();

    const { error } = await supabase.rpc("approve_purchase_order_reconciliation", {
      target_reconciliation_id: reconciliationId,
    });
    if (error) throw error;

    revalidatePath("/app/purchase-orders");
    revalidatePath(`/app/purchase-orders/${purchaseOrderId}`);
    redirect(detailUrl(purchaseOrderId, "PO reconciliation approved."));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Approval failed.";
    redirect(detailUrl(purchaseOrderId, message, "error"));
  }
}
