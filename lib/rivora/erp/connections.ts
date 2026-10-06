async function createConnectionAdminClient() {
  const { createAdminClient } = await import("../../supabase/admin.ts");
  return createAdminClient();
}

export type StoredErpConnectionStatus =
  | "configured"
  | "verified"
  | "error"
  | "disconnected";

export type StoredErpConnection = {
  id: string;
  organizationId: string;
  provider: string;
  configuration: Record<string, unknown>;
  status: StoredErpConnectionStatus;
  hasSecret: boolean;
  verifiedAt: string | null;
  verifiedCompanyName: string | null;
  lastError: string | null;
  updatedAt: string;
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export async function getStoredErpConnection(
  organizationId: string,
  provider: string,
): Promise<StoredErpConnection | null> {
  const admin = await createConnectionAdminClient();
  const { data, error } = await admin
    .from("erp_connections")
    .select(
      "id,organization_id,provider,configuration,secret_id,status,verified_at,verified_company_name,last_error,updated_at",
    )
    .eq("organization_id", organizationId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    // During a staggered deploy the additive ERP-A5 migration can land just
    // before the application. Treat a missing table as no stored connection so
    // the proven legacy environment fallback remains available.
    if (
      error.code === "42P01" ||
      /erp_connections|relation .* does not exist/i.test(error.message)
    ) {
      return null;
    }
    throw new Error(`ERP connection lookup failed: ${error.message}`);
  }
  if (!data) return null;

  return {
    id: String(data.id),
    organizationId: String(data.organization_id),
    provider: String(data.provider),
    configuration: asObject(data.configuration),
    status: String(data.status) as StoredErpConnectionStatus,
    hasSecret: Boolean(data.secret_id),
    verifiedAt: data.verified_at ? String(data.verified_at) : null,
    verifiedCompanyName: data.verified_company_name
      ? String(data.verified_company_name)
      : null,
    lastError: data.last_error ? String(data.last_error) : null,
    updatedAt: String(data.updated_at),
  };
}

export async function getStoredErpConnectionSecret(
  organizationId: string,
  provider: string,
): Promise<string | null> {
  const admin = await createConnectionAdminClient();
  const { data, error } = await admin.rpc("get_erp_connection_secret_server", {
    target_organization_id: organizationId,
    target_provider: provider,
  });

  if (error) {
    throw new Error(`ERP credential lookup failed: ${error.message}`);
  }

  const secret = typeof data === "string" ? data.trim() : "";
  return secret || null;
}

export async function upsertStoredErpConnection({
  organizationId,
  provider,
  configuration,
  secret,
  actorId,
}: {
  organizationId: string;
  provider: string;
  configuration: Record<string, unknown>;
  secret: string;
  actorId: string;
}) {
  const admin = await createConnectionAdminClient();
  const { data, error } = await admin.rpc("upsert_erp_connection_server", {
    target_organization_id: organizationId,
    target_provider: provider,
    target_configuration: configuration,
    target_secret: secret,
    target_actor_id: actorId,
  });

  if (error) {
    throw new Error(`ERP connection could not be saved: ${error.message}`);
  }
  return String(data);
}

export async function markStoredErpConnectionVerification({
  organizationId,
  provider,
  result,
  companyName,
  errorMessage,
  actorId,
}: {
  organizationId: string;
  provider: string;
  result: "verified" | "error";
  companyName?: string | null;
  errorMessage?: string | null;
  actorId: string;
}) {
  const admin = await createConnectionAdminClient();
  const { error } = await admin.rpc("mark_erp_connection_verification_server", {
    target_organization_id: organizationId,
    target_provider: provider,
    target_result: result,
    target_company_name: companyName || "",
    target_error: errorMessage || "",
    target_actor_id: actorId,
  });

  if (error) {
    throw new Error(`ERP connection verification state could not be saved: ${error.message}`);
  }
}

export async function disconnectStoredErpConnection({
  organizationId,
  provider,
  actorId,
}: {
  organizationId: string;
  provider: string;
  actorId: string;
}) {
  const admin = await createConnectionAdminClient();
  const { error } = await admin.rpc("disconnect_erp_connection_server", {
    target_organization_id: organizationId,
    target_provider: provider,
    target_actor_id: actorId,
  });

  if (error) {
    throw new Error(`ERP connection could not be disconnected: ${error.message}`);
  }
}
