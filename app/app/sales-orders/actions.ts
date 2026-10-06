"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { getLocale } from "@/lib/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  operationalLog,
  requestIdFor,
  safeErrorMessage,
} from "@/lib/rivora/observability";
import {
  getErpAdapter,
  requireErpAdapter,
  type ErpSalesOrderInput,
} from "@/lib/rivora/erp";

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


async function autoMapSalesOrderDraft({
  salesOrderDraftId,
  context,
}: {
  salesOrderDraftId: string;
  context: Awaited<ReturnType<typeof requireSalesOrderAdmin>>;
}) {
  const { supabase, workspace, claims } = context;
  const adapter = getErpAdapter(workspace.erpProvider);
  if (!adapter) {
    return {
      configured: false,
      created: 0,
      total: 0,
      provider: null,
      displayName: null,
    };
  }
  const config = await adapter.getConfigurationStatus(workspace.id);
  if (!config.configured) {
    return {
      configured: false,
      created: 0,
      total: 0,
    };
  }

  const { data: draft, error: draftError } = await supabase
    .from("sales_order_drafts")
    .select("id,customer_id,customers(id,name,external_id)")
    .eq("id", salesOrderDraftId)
    .eq("organization_id", workspace.id)
    .maybeSingle();

  if (draftError) throw draftError;
  if (!draft) throw new Error("Sales order draft not found.");

  const { data: lines, error: lineError } = await supabase
    .from("sales_order_draft_lines")
    .select(
      "product_id,sku,unit,products(id,sku,name,manufacturer_part_number,unit)",
    )
    .eq("sales_order_draft_id", salesOrderDraftId)
    .eq("organization_id", workspace.id)
    .order("line_number");

  if (lineError) throw lineError;

  const customer = Array.isArray((draft as any).customers)
    ? (draft as any).customers[0]
    : (draft as any).customers;

  if (!customer) throw new Error("Sales order customer was not found.");

  const uniqueProducts = new Map<string, any>();
  for (const line of lines ?? []) {
    const product = Array.isArray((line as any).products)
      ? (line as any).products[0]
      : (line as any).products;
    const productId = String((line as any).product_id);
    if (!productId || uniqueProducts.has(productId)) continue;
    uniqueProducts.set(productId, {
      id: productId,
      sku: String(product?.sku || (line as any).sku || ""),
      name: String(product?.name || ""),
      manufacturerPartNumber: product?.manufacturer_part_number
        ? String(product.manufacturer_part_number)
        : null,
      unit: String(product?.unit || (line as any).unit || ""),
    });
  }

  const entityIds = [
    String(draft.customer_id),
    ...Array.from(uniqueProducts.keys()),
  ];

  const { data: existingMappings, error: existingError } = await supabase
    .from("erp_entity_mappings")
    .select("entity_type,local_entity_id,external_number")
    .eq("organization_id", workspace.id)
    .eq("provider", adapter.provider)
    .in("local_entity_id", entityIds);

  if (existingError) throw existingError;

  const alreadyMapped = new Set(
    (existingMappings ?? [])
      .filter((mapping: any) => mapping.external_number)
      .map(
        (mapping: any) =>
          `${String(mapping.entity_type)}:${String(mapping.local_entity_id)}`,
      ),
  );

  const suggestions = await adapter.suggestMappings({
    workspaceId: workspace.id,
    customer: {
      id: String(draft.customer_id),
      name: String(customer.name || ""),
      externalId: customer.external_id ? String(customer.external_id) : null,
    },
    products: Array.from(uniqueProducts.values()),
  });

  const toCreate = suggestions.filter(
    (suggestion) =>
      !alreadyMapped.has(
        `${suggestion.entityType}:${suggestion.localEntityId}`,
      ),
  );

  if (toCreate.length) {
    const { error: saveError } = await supabase
      .from("erp_entity_mappings")
      .upsert(
        toCreate.map((suggestion) => ({
          organization_id: workspace.id,
          provider: adapter.provider,
          entity_type: suggestion.entityType,
          local_entity_id: suggestion.localEntityId,
          external_id: suggestion.externalId,
          external_number: suggestion.externalNumber,
          metadata: suggestion.metadata,
          updated_by: String(claims.sub),
        })),
        {
          onConflict: "organization_id,provider,entity_type,local_entity_id",
        },
      );

    if (saveError) throw saveError;
  }

  return {
    configured: true,
    created: toCreate.length,
    total: suggestions.length,
    provider: adapter.provider,
    displayName: adapter.displayName,
  };
}

export async function createSalesOrderDraftAction(formData: FormData) {
  const fi = (await getLocale()) === "fi";
  const purchaseOrderId = clean(formData.get("purchaseOrderId"), 80);
  if (!purchaseOrderId) throw new Error("Purchase order ID is required.");

  let draftId = "";
  let failure: string | null = null;
  let success = fi ? "Myyntitilausluonnos luotiin." : "Sales order draft created.";

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

    const adapter = getErpAdapter(context.workspace.erpProvider);
    if (adapter) {
      try {
        const mappingResult = await autoMapSalesOrderDraft({
          salesOrderDraftId: draftId,
          context,
        });
        if (mappingResult.configured) {
          success =
            mappingResult.created > 0
              ? (fi
                  ? `Myyntitilausluonnos luotiin. ${mappingResult.created} ${adapter.displayName} -vastinetta löytyi automaattisesti.`
                  : `Sales order draft created. ${mappingResult.created} ${adapter.displayName} mapping(s) found automatically.`)
              : (fi
                  ? `Myyntitilausluonnos luotiin. Aiemmat ${adapter.displayName} -vastineet säilytettiin.`
                  : `Sales order draft created. Existing ${adapter.displayName} mappings were preserved.`);
        }
      } catch {
        success = fi
          ? `Myyntitilausluonnos luotiin. ${adapter.displayName} -vastineiden automaattisen haun voi yrittää uudelleen luonnoksesta.`
          : `Sales order draft created. ${adapter.displayName} automatic mapping can be retried from the draft.`;
      }
    }
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

  redirect(draftUrl(draftId, success, "ok"));
}

export async function autoMapErpAction(formData: FormData) {
  const fi = (await getLocale()) === "fi";
  const salesOrderDraftId = clean(formData.get("salesOrderDraftId"), 80);
  if (!salesOrderDraftId) throw new Error("Sales order draft ID is required.");

  let failure: string | null = null;
  let success = fi ? "ERP-vastineiden haku valmistui." : "ERP mapping search completed.";

  try {
    const context = await requireSalesOrderAdmin();
    const adapter = requireErpAdapter(context.workspace.erpProvider);
    const result = await autoMapSalesOrderDraft({
      salesOrderDraftId,
      context,
    });

    if (!result.configured) {
      throw new Error(
        `${adapter.displayName} server credentials are not configured for this workspace.`,
      );
    }

    success =
      result.created > 0
        ? (fi
            ? `${result.created} uutta ${adapter.displayName} -vastinetta löytyi automaattisesti.`
            : `${result.created} new ${adapter.displayName} mapping(s) found automatically.`)
        : result.total > 0
          ? (fi
              ? "Automaattiset vastineet oli jo tallennettu. Olemassa olevia vastineita ei ylikirjoitettu."
              : "Automatic matches were already saved. No existing mapping was overwritten.")
          : (fi
              ? `Turvallisia täsmäosumia ei löytynyt järjestelmästä ${adapter.displayName}. Tarkista puuttuvat vastineet käsin.`
              : `No safe exact matches were found in ${adapter.displayName}. Review the remaining mappings manually.`);
  } catch (error) {
    failure =
      error instanceof Error
        ? error.message
        : "ERP automatic mapping failed.";
  }

  revalidatePath("/app/sales-orders");
  revalidatePath(`/app/sales-orders/${salesOrderDraftId}`);
  revalidatePath(`/app/orders/case/sales/${salesOrderDraftId}`);

  redirect(
    draftUrl(
      salesOrderDraftId,
      failure ?? success,
      failure ? "error" : "ok",
    ),
  );
}

export async function saveErpMappingAction(formData: FormData) {
  const fi = (await getLocale()) === "fi";
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
  let adapterDisplayName = "ERP";

  try {
    const { supabase, workspace, claims } = await requireSalesOrderAdmin();
    const adapter = requireErpAdapter(workspace.erpProvider);
    adapterDisplayName = adapter.displayName;

    let localUnit: string | null = null;
    if (entityType === "product") {
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("id,unit")
        .eq("id", localEntityId)
        .eq("organization_id", workspace.id)
        .eq("active", true)
        .maybeSingle();
      if (productError) throw productError;
      if (!product) throw new Error("Averomira product was not found.");
      localUnit = product.unit ? String(product.unit) : null;
    } else {
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id")
        .eq("id", localEntityId)
        .eq("organization_id", workspace.id)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customer) throw new Error("Averomira customer was not found.");
    }

    const validated = await adapter.validateManualMapping({
      workspaceId: workspace.id,
      entityType: entityType as "customer" | "product",
      externalNumber,
      localUnit,
    });

    const { error } = await supabase
      .from("erp_entity_mappings")
      .upsert(
        {
          organization_id: workspace.id,
          provider: adapter.provider,
          entity_type: entityType,
          local_entity_id: localEntityId,
          external_id: validated.externalId,
          external_number: validated.externalNumber,
          metadata: validated.metadata,
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
  revalidatePath(`/app/orders/case/sales/${salesOrderDraftId}`);
  redirect(
    draftUrl(
      salesOrderDraftId,
      failure ?? (fi ? `${adapterDisplayName} -vastine tallennettiin.` : `${adapterDisplayName} mapping saved.`),
      failure ? "error" : "ok",
    ),
  );
}

export async function sendErpSalesOrderAction(formData: FormData) {
  const operationId = requestIdFor();
  const salesOrderDraftId = clean(formData.get("salesOrderDraftId"), 80);
  if (!salesOrderDraftId) throw new Error("Sales order draft ID is required.");

  let failure: string | null = null;
  let success = "ERP sales order created.";
  let attemptId: string | null = null;
  let context: Awaited<ReturnType<typeof requireSalesOrderAdmin>> | null = null;

  try {
    context = await requireSalesOrderAdmin();
    const { supabase, workspace, claims } = context;
    const adapter = requireErpAdapter(workspace.erpProvider);
    const admin = createAdminClient();
    const actorId = String(claims.sub);

    const config = await adapter.getConfigurationStatus(workspace.id);
    if (!config.configured) {
      if (!config.workspaceMatches && !config.missing.includes("workspaceId")) {
        throw new Error(`${adapter.displayName} configuration belongs to a different workspace.`);
      }
      throw new Error(
        `${adapter.displayName} server credentials are not configured for this workspace.`,
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
      throw new Error(`Sales order draft is not eligible for ${adapter.displayName} export.`);
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
      .select("entity_type,local_entity_id,external_number,external_id,metadata")
      .eq("organization_id", workspace.id)
      .eq("provider", adapter.provider)
      .in("local_entity_id", entityIds);

    if (mappingError) throw mappingError;

    const customerMapping = (mappings ?? []).find(
      (mapping: any) =>
        mapping.entity_type === "customer" &&
        String(mapping.local_entity_id) === String(draft.customer_id),
    );
    if (!adapter.isMappingVerified(customerMapping as any)) {
      throw new Error(`${adapter.displayName} customer mapping must be verified before export.`);
    }
    const customerNumber = String(customerMapping?.external_number || "");
    if (!customerNumber) {
      throw new Error(`${adapter.displayName} customer number is missing.`);
    }

    const productMappings = new Map<string, string>();
    for (const mapping of mappings ?? []) {
      if (
        mapping.entity_type === "product" &&
        adapter.isMappingVerified(mapping as any)
      ) {
        productMappings.set(String(mapping.local_entity_id), String(mapping.external_number));
      }
    }

    const missingProducts = lines.filter(
      (line: any) => !productMappings.has(String(line.product_id)),
    );
    if (missingProducts.length) {
      throw new Error(
        `${adapter.displayName} item mapping is missing for ${missingProducts
          .slice(0, 5)
          .map((line: any) => line.sku)
          .join(", ")}${missingProducts.length > 5 ? "…" : ""}.`,
      );
    }

    const input: ErpSalesOrderInput = {
      workspaceId: workspace.id,
      customerNumber,
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

    const requestPayload = adapter.sanitizeSalesOrderRequest(input);
    const { data: startedAttempt, error: startError } = await admin.rpc(
      "begin_erp_delivery_attempt_server",
      {
        target_sales_order_draft_id: salesOrderDraftId,
        target_provider: adapter.provider,
        target_request_payload: requestPayload,
        target_actor_id: actorId,
      },
    );

    if (startError) throw startError;
    attemptId = String(startedAttempt ?? "");
    if (!attemptId) throw new Error("ERP attempt could not be started.");

    operationalLog("info", "erp_export_started", {
      operationId,
      organizationId: workspace.id,
      salesOrderDraftId,
      provider: adapter.provider,
      attemptId,
    });

    try {
      const result = await adapter.createSalesOrder(input);

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

      operationalLog(
        result.status === "created" ? "info" : "warn",
        "erp_export_finished",
        {
          operationId,
          organizationId: workspace.id,
          salesOrderDraftId,
          provider: adapter.provider,
          attemptId,
          result: result.status,
          externalOrderNumber: result.externalOrderNumber ?? null,
        },
      );

      if (result.status === "existing") {
        failure =
          `An existing ${adapter.displayName} order with this customer PO number was detected. No duplicate was created; review the existing ERP order.`;
      } else if (result.status === "partial") {
        failure =
          `${adapter.displayName} created order ${result.externalOrderNumber || result.externalOrderId}, but a line failed. Automatic retry is locked to prevent duplicates. ${result.error}`;
      } else {
        success = `${adapter.displayName} Draft order ${result.externalOrderNumber || result.externalOrderId} created.`;
      }
    } catch (adapterError) {
      const message = safeErrorMessage(adapterError, "ERP export failed.");

      operationalLog("error", "erp_export_adapter_failed", {
        operationId,
        organizationId: workspace.id,
        salesOrderDraftId,
        provider: adapter.provider,
        attemptId,
        message,
      });

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
    failure = safeErrorMessage(error, "ERP export failed.");
    operationalLog("error", "erp_export_action_failed", {
      operationId,
      salesOrderDraftId,
      attemptId,
      message: failure,
    });
  }

  revalidatePath("/app/sales-orders");
  revalidatePath(`/app/sales-orders/${salesOrderDraftId}`);
  revalidatePath(`/app/orders/case/sales/${salesOrderDraftId}`);

  redirect(
    draftUrl(
      salesOrderDraftId,
      failure ?? success,
      failure ? "error" : "ok",
    ),
  );
}
