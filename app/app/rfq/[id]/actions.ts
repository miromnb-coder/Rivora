"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/rivora/workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export async function confirmRfqMatch(formData: FormData) {
  const rfqId = String(formData.get("rfqId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const remember = formData.get("remember") === "on";

  if (!rfqId || !lineId || !productId) return;

  const { workspace, claims } = await requireWorkspace();
  if (!["owner", "admin", "member"].includes(workspace.role)) {
    throw new Error("Reviewer access is read-only. An owner, admin or member must confirm RFQ matches.");
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("confirm_rfq_line_match_with_memory_server", {
    target_line_id: lineId,
    target_product_id: productId,
    remember_for_customer: remember,
    target_actor_id: claims.sub,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/app/rfq/${rfqId}`);
  revalidatePath("/app/inbox");
  revalidatePath("/app/memory");
}


export async function retryRfqProcessing(formData: FormData) {
  const rfqId = String(formData.get("rfqId") ?? "");
  if (!rfqId) throw new Error("RFQ is required.");

  const { supabase, workspace, claims } = await requireWorkspace();
  if (!["owner", "admin", "member"].includes(workspace.role)) {
    throw new Error("Reviewer access is read-only.");
  }

  const { data: rfq } = await supabase
    .from("rfqs")
    .select("id, organization_id, status")
    .eq("id", rfqId)
    .eq("organization_id", workspace.id)
    .maybeSingle();

  if (!rfq) throw new Error("RFQ not found.");
  if (rfq.status !== "failed") throw new Error("Only a failed RFQ can be retried.");

  const { count } = await supabase
    .from("rfq_lines")
    .select("id", { count: "exact", head: true })
    .eq("rfq_id", rfqId)
    .eq("organization_id", workspace.id);

  if (!count) {
    throw new Error("This RFQ failed before line creation. Re-upload the source file.");
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("refresh_rfq_matches_with_memory_server", {
    target_rfq_id: rfqId,
    target_actor_id: claims.sub,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/app/rfq/${rfqId}`);
  revalidatePath("/app/inbox");
}
