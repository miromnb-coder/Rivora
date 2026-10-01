"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createBusinessCentralSalesOrder,
  getBusinessCentralConfigurationStatus,
  sanitizedBusinessCentralRequest,
  type BusinessCentralSalesOrderInput,
} from "@/lib/rivora/erp/business-central";

function clean(value: FormDataEntryValue | null, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

async function requireSalesOrderAdmin() {
  const context = await requireWorkspace();
  if (!["owner", "admin"].includes(context.workspace.role)) {
    throw new Error("Owner or admin access is required.");
  }
  return context;
}

function draftUrl(id: string, message: string, type: "ok" | "error") {
  const key = type === "error" ? "erpError" : "saved";
  return `/app/sales-orders/${id}?${key}=${encodeURIComponent(message)}`;
}

export async function createSalesOrderDraftAction(formData: FormData) {
  const purchaseOrderId = clean(formData.get("purchaseOrderId"), 80);
  if (!purchaseOrderId) throw new Error("Purchase order ID is required.");

  let draftId = "";
  let failure: string | null = null;

  try {
    const context = await requireSalesOrderAdmin();
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("create_sales_order_draft_server", {
      target_purchase_order_id: purchaseOrderId,
      target_actor_id: String(context.claims.sub),
    });
    if (error) throw error;
    draftId = String(data ?? "");
    if (!draftId) throw new Error("Sales order draft creation returned no ID.");
  } catch (error) {
    failure = error instanceof Error ? error.message : "Sales order draft creation failed.";
  }

  revalidatePath(`/app/purchase-orders/${purchaseOrderId}`);
  revalidatePath("/app/sales-orders");

  if (failure) {
    redirect(
      `/app/purchase-orders/${purchaseOrderId}?reconcileError=${encodeURIComponent(failure)}`,
    );
  }

  redirect(draftUrl(draftId, "Sales order draft created.", "ok"));
}

export async function saveErpMappingAction(formData: FormData) {
  const salesOrderDraftId = clean(formData.get("salesOrderDraftId"), 80);
  const entityType = clean(formData.get("entityType"), 30);
  const localEntityId = clean(formData.get("localEntityId"), 80);
  const externalNumber = clean(formData.get("externalNumber"), 120);

  if (!salesOrderDraftId || !localEntityId || !externalNumber) {
    throw new Error("ERP mapping fields are required.");
  }
  if (!["customer", "product"].includes(entityType)) {
    throw new Error("Unsupported ERP mapping entity type.");
  }

  let failure: string | null = null;

  try {
    const { supabase, workspace, claims } = await requireSalesOrderAdmin();

    const { error } = await supabase
      .from("erp_entity_mappings")
      .upsert(
        {
          organization_id: workspace.id,
          provider: "business_central",
          entity_type: entityType,
          local_entity_id: localEntityId,
          external_number: externalNumber,
          updated_by: String(claims.sub),
        },
        {
          onConflict: "organization_id,provider,entity_type,local_entity_id",
        },
      );

    if (error) throw error;
  } catch (error) {
    failure = error instanceof Error ? error.message : "ERP mapping could not be saved.";
  }

  revalidatePath(`/app/sales-orders/${salesOrderDraftId}`);
  redirect(
    draftUrl(
      salesOrderDraftId,
      failure ?? "Business Central mapping saved.",
      failure ? "error" : "ok",
    ),
  );
}

export async function sendBusinessCentralSalesOrderAction(formData: FormData) {
  const salesOrderDraftId = clean(formData.get("salesOrderDraftId"), 80);
  if (!salesOrderDraftId) throw new Error("Sales order draft ID is required.");

  let failure: string | null = null;
  let success = "Business Central sales order created.";
  let attemptId: string | null = null;
  let context: Awaited<ReturnType<typeof requireSalesOrderAdmin>> | null = null;

  try {
    context = await requireSalesOrderAdmin();
    const { supabase, workspace, claims } = context;
    const admin = createAdminClient();
    const actorId = String(claims.sub);

    const config = getBusinessCentralConfigurationStatus(workspace.id);
    if (!config.configured) {
      if (!config.workspaceMatches && !config.missing.includes("workspaceId")) {
        throw new Error("Business Central configuration belongs to a different workspace.");
      }
      throw new Error(
        "Business Central server credentials are not configured for this workspace.",
      );
    }

    const { data: draft, error: draftError } = await supabase
      .from("sales_order_drafts")
      .select(
        "id,customer_id,status,customer_po_number,order_date,currency,external_order_id,external_order_number",
      )
      .eq("id", salesOrderDraftId)
      .eq("organization_id", workspace.id)
      .maybeSingle();

    if (draftError) throw draftError;
    if (!draft) throw new Error("Sales order draft not found.");
    if (!["draft", "erp_failed"].includes(String(draft.status))) {
      throw new Error("Sales order draft is not eligible for Business Central export.");
    }
    if (draft.external_order_id) {
      throw new Error("Sales order draft already has an external ERP order.");
    }

    const { data: lines, error: lineError } = await supabase
      .from("sales_order_draft_lines")
      .select(
        "id,line_number,product_id,sku,description,quantity,unit,unit_price,line_total",
      )
      .eq("sales_order_draft_id", salesOrderDraftId)
      .eq("organization_id", workspace.id)
      .order("line_number");

    if (lineError) throw lineError;
    if (!lines?.length) throw new Error("Sales order draft has no lines.");

    const entityIds = [
      String(draft.customer_id),
      ...lines.map((line: any) => String(line.product_id)),
    ];

    const { data: mappings, error: mappingError } = await supabase
      .from("erp_entity_mappings")
      .select("entity_type,local_entity_id,external_number,external_id")
      .eq("organization_id", workspace.id)
      .eq("provider", "business_central")
      .in("local_entity_id", entityIds);

    if (mappingError) throw mappingError;

    const customerMapping = (mappings ?? []).find(
      (mapping: any) =>
        mapping.entity_type === "customer" &&
        String(mapping.local_entity_id) === String(draft.customer_id),
    );
    if (!customerMapping?.external_number) {
      throw new Error("Business Central customer number is missing.");
    }

    const productMappings = new Map<string, string>();
    for (const mapping of mappings ?? []) {
      if (mapping.entity_type === "product" && mapping.external_number) {
        productMappings.set(String(mapping.local_entity_id), String(mapping.external_number));
      }
    }

    const missingProducts = lines.filter(
      (line: any) => !productMappings.has(String(line.product_id)),
    );
    if (missingProducts.length) {
      throw new Error(
        `Business Central item mapping is missing for ${missingProducts
          .slice(0, 5)
          .map((line: any) => line.sku)
          .join(", ")}${missingProducts.length > 5 ? "…" : ""}.`,
      );
    }

    const input: BusinessCentralSalesOrderInput = {
      workspaceId: workspace.id,
      customerNumber: String(customerMapping.external_number),
      customerPoNumber: String(draft.customer_po_number),
      orderDate: String(draft.order_date),
      currency: String(draft.currency),
      lines: lines.map((line: any) => ({
        lineNumber: Number(line.line_number),
        externalItemNumber: productMappings.get(String(line.product_id))!,
        description: String(line.description),
        quantity: Number(line.quantity),
        unit: String(line.unit),
        unitPrice: Number(line.unit_price),
      })),
    };

    const requestPayload = sanitizedBusinessCentralRequest(input);
    const { data: startedAttempt, error: startError } = await admin.rpc(
      "begin_erp_delivery_attempt_server",
      {
        target_sales_order_draft_id: salesOrderDraftId,
        target_provider: "business_central",
        target_request_payload: requestPayload,
        target_actor_id: actorId,
      },
    );

    if (startError) throw startError;
    attemptId = String(startedAttempt ?? "");
    if (!attemptId) throw new Error("ERP attempt could not be started.");

    try {
      const result = await createBusinessCentralSalesOrder(input);

      const attemptStatus =
        result.status === "created"
          ? "created"
          : result.status === "existing"
            ? "existing"
            : "partial";

      const { error: finishError } = await admin.rpc("finish_erp_delivery_attempt_server", {
        target_attempt_id: attemptId,
        target_status: attemptStatus,
        target_external_order_id: result.externalOrderId,
        target_external_order_number: result.externalOrderNumber ?? "",
        target_error_message: result.status === "partial" ? result.error : "",
        target_response_summary: result.summary,
        target_actor_id: actorId,
      });
      if (finishError) throw finishError;

      if (result.status === "existing") {
        failure =
          "An existing Business Central order with this customer PO number was detected. No duplicate was created; review the existing ERP order.";
      } else if (result.status === "partial") {
        failure =
          `Business Central created order ${result.externalOrderNumber || result.externalOrderId}, but a line failed. Automatic retry is locked to prevent duplicates. ${result.error}`;
      } else {
        success = `Business Central Draft order ${result.externalOrderNumber || result.externalOrderId} created.`;
      }
    } catch (adapterError) {
      const message =
        adapterError instanceof Error ? adapterError.message : "Business Central export failed.";

      const { error: finishError } = await admin.rpc("finish_erp_delivery_attempt_server", {
        target_attempt_id: attemptId,
        target_status: "failed",
        target_external_order_id: "",
        target_external_order_number: "",
        target_error_message: message,
        target_response_summary: {},
        target_actor_id: actorId,
      });

      if (finishError) {
        throw new Error(`${message} ERP attempt finalization also failed: ${finishError.message}`);
      }

      failure = message;
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : "Business Central export failed.";
  }

  revalidatePath("/app/sales-orders");
  revalidatePath(`/app/sales-orders/${salesOrderDraftId}`);

  redirect(
    draftUrl(
      salesOrderDraftId,
      failure ?? success,
      failure ? "error" : "ok",
    ),
  );
}
