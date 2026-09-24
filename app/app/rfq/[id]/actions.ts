"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace } from "@/lib/rivora/workspace";

export async function confirmRfqMatch(formData: FormData) {
  const rfqId = String(formData.get("rfqId") ?? "");
  const lineId = String(formData.get("lineId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const remember = formData.get("remember") === "on";

  if (!rfqId || !lineId || !productId) return;

  const { supabase } = await requireWorkspace();
  const { error } = await supabase.rpc("confirm_rfq_line_match", {
    target_line_id: lineId,
    target_product_id: productId,
    remember_for_customer: remember,
  });

  if (error) throw new Error(error.message);

  revalidatePath(`/app/rfq/${rfqId}`);
  revalidatePath("/app/inbox");
  revalidatePath("/app/memory");
}
