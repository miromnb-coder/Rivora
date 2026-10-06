import type { getAuthContext } from "@/lib/rivora/workspace";

export type WorkspaceFeature = "leads";

type WorkspaceContext = Awaited<ReturnType<typeof getAuthContext>>;

export async function canManageWorkspaceFeature(
  context: WorkspaceContext,
  feature: WorkspaceFeature,
) {
  if (
    !context.claims ||
    !context.workspace ||
    !["owner", "admin"].includes(context.workspace.role)
  ) {
    return false;
  }

  const { data, error } = await context.supabase.rpc(
    "can_manage_workspace_feature",
    { target_feature: feature },
  );

  if (error) {
    console.error("[workspace-feature]", feature, error.code, error.message);
    return false;
  }

  return data === true;
}
