import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";
import { ContextReadError } from "./types";

type ScopedDb=Awaited<ReturnType<typeof createClient>>;

/** Check the current JWT-scoped membership, not the display name.
 * A user with multiple memberships must explicitly select a workspace
 * before context can be sent outside Supabase.
 */
export async function verifyContextMembership(
  db: ScopedDb, actorId: string, organizationId: string,
): Promise<void> {
  const { data, error }=await db.from("organization_members")
    .select("organization_id,role")
    .eq("user_id",actorId)
    .order("created_at",{ascending:true}).limit(51);
  if (error || !data || data.length===0 || data.length>50)
    throw new ContextReadError("CONTEXT_MEMBERSHIP_UNAVAILABLE");
  const allowed=data.some(m=>m.organization_id===organizationId);
  if (!allowed) throw new ContextReadError("CONTEXT_MEMBERSHIP_UNAVAILABLE");
  if (data.length>1) {
    const explicit=(await cookies()).get("averomira-active-organization-id")?.value;
    if (explicit!==organizationId)
      throw new ContextReadError("CONTEXT_WORKSPACE_SELECTION_REQUIRED");
  }
}
