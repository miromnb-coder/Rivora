"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PURCHASE_ORDER_FIELD_MEMORY_TARGETS,
  type PurchaseOrderFieldMemoryTarget,
} from "@/lib/rivora/imports";

export async function updateCustomerMemoryMapping(formData: FormData) {
  const memoryId = String(formData.get("memoryId") ?? "");
  const productSku = String(formData.get("productSku") ?? "").trim();

  if (!memoryId || !productSku) {
    throw new Error("Memory entry and product SKU are required.");
  }

  const { supabase, workspace, claims } = await requireWorkspace();
  if (!["owner", "admin", "member"].includes(workspace.role)) {
    throw new Error("Reviewer access is read-only.");
  }

  const [{ data: memory }, { data: product }] = await Promise.all([
    supabase
      .from("workspace_memory_entries")
      .select("id,organization_id,customer_id,memory_type,scope")
      .eq("id", memoryId)
      .eq("organization_id", workspace.id)
      .eq("memory_type", "customer_sku_product")
      .eq("scope", "customer")
      .maybeSingle(),
    supabase
      .from("products")
      .select("id,sku")
      .eq("organization_id", workspace.id)
      .eq("sku", productSku)
      .eq("active", true)
      .maybeSingle(),
  ]);

  if (!memory) throw new Error("Smart Memory entry not found.");
  if (!product) throw new Error("Active catalogue product with that SKU was not found.");

  const admin = createAdminClient();
  const { error } = await admin.rpc(
    "update_customer_product_memory_by_memory_server",
    {
      target_memory_id: memory.id,
      target_product_id: product.id,
      target_actor_id: claims.sub,
    },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/app/memory");
  revalidatePath("/app/settings");
  if (memory.customer_id) {
    revalidatePath(`/app/customers/${memory.customer_id}`);
  }
}

export async function deleteCustomerMemoryMapping(formData: FormData) {
  const memoryId = String(formData.get("memoryId") ?? "");
  const confirmed = formData.get("confirmDelete") === "on";

  if (!memoryId) throw new Error("Memory entry is required.");
  if (!confirmed) throw new Error("Confirm Smart Memory deletion before continuing.");

  const { supabase, workspace, claims } = await requireWorkspace();
  if (!["owner", "admin"].includes(workspace.role)) {
    throw new Error("Owner or admin access is required to delete Smart Memory.");
  }

  const { data: memory } = await supabase
    .from("workspace_memory_entries")
    .select("id,customer_id")
    .eq("id", memoryId)
    .eq("organization_id", workspace.id)
    .eq("memory_type", "customer_sku_product")
    .eq("scope", "customer")
    .maybeSingle();

  if (!memory) throw new Error("Smart Memory entry not found.");

  const admin = createAdminClient();
  const { error } = await admin.rpc(
    "disable_customer_product_memory_by_memory_server",
    {
      target_memory_id: memory.id,
      target_actor_id: claims.sub,
    },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/app/memory");
  revalidatePath("/app/settings");
  if (memory.customer_id) {
    revalidatePath(`/app/customers/${memory.customer_id}`);
  }
}


function isPurchaseOrderFieldTarget(
  value: string,
): value is PurchaseOrderFieldMemoryTarget {
  return (PURCHASE_ORDER_FIELD_MEMORY_TARGETS as readonly string[]).includes(value);
}

export async function createCustomerPoFieldMemory(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "");
  const sourceHeader = String(formData.get("sourceHeader") ?? "").trim();
  const targetField = String(formData.get("targetField") ?? "").trim();

  if (!customerId || !sourceHeader || !isPurchaseOrderFieldTarget(targetField)) {
    throw new Error("Customer, source header and supported PO field are required.");
  }

  const { supabase, workspace, claims } = await requireWorkspace();
  if (!["owner", "admin"].includes(workspace.role)) {
    throw new Error("Owner or admin access is required to manage PO field memory.");
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("organization_id", workspace.id)
    .maybeSingle();

  if (!customer) throw new Error("Customer not found in this workspace.");

  const admin = createAdminClient();
  const { error } = await admin.rpc(
    "upsert_customer_po_field_memory_server",
    {
      target_customer_id: customerId,
      target_source_header: sourceHeader,
      target_field: targetField,
      target_metadata: { created_from: "smart_memory_settings" },
      target_actor_id: claims.sub,
    },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/app/memory");
  revalidatePath("/app/settings");
}

export async function updateCustomerPoFieldMemory(formData: FormData) {
  const memoryId = String(formData.get("memoryId") ?? "");
  const targetField = String(formData.get("targetField") ?? "").trim();

  if (!memoryId || !isPurchaseOrderFieldTarget(targetField)) {
    throw new Error("Smart Memory entry and supported PO field are required.");
  }

  const { supabase, workspace, claims } = await requireWorkspace();
  if (!["owner", "admin"].includes(workspace.role)) {
    throw new Error("Owner or admin access is required to manage PO field memory.");
  }

  const { data: memory } = await supabase
    .from("workspace_memory_entries")
    .select("id")
    .eq("id", memoryId)
    .eq("organization_id", workspace.id)
    .eq("scope", "customer")
    .eq("memory_type", "customer_po_field_alias")
    .maybeSingle();

  if (!memory) throw new Error("PO field Smart Memory entry not found.");

  const admin = createAdminClient();
  const { error } = await admin.rpc(
    "update_customer_po_field_memory_server",
    {
      target_memory_id: memory.id,
      target_field: targetField,
      target_actor_id: claims.sub,
    },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/app/memory");
  revalidatePath("/app/settings");
}

export async function deleteCustomerScalarMemory(formData: FormData) {
  const memoryId = String(formData.get("memoryId") ?? "");
  const confirmed = formData.get("confirmDelete") === "on";

  if (!memoryId) throw new Error("Smart Memory entry is required.");
  if (!confirmed) throw new Error("Confirm Smart Memory removal before continuing.");

  const { supabase, workspace, claims } = await requireWorkspace();
  if (!["owner", "admin"].includes(workspace.role)) {
    throw new Error("Owner or admin access is required to remove Smart Memory.");
  }

  const { data: memory } = await supabase
    .from("workspace_memory_entries")
    .select("id,memory_type")
    .eq("id", memoryId)
    .eq("organization_id", workspace.id)
    .eq("scope", "customer")
    .in("memory_type", ["customer_unit_alias", "customer_po_field_alias"])
    .maybeSingle();

  if (!memory) throw new Error("Controlled Smart Memory entry not found.");

  const admin = createAdminClient();
  const { error } = await admin.rpc(
    "disable_customer_scalar_memory_server",
    {
      target_memory_id: memory.id,
      target_actor_id: claims.sub,
    },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/app/memory");
  revalidatePath("/app/settings");
}
