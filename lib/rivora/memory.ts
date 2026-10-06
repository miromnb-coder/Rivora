import { createClient } from "@/lib/supabase/server";

export type MemoryScope = "customer" | "workspace";
export type MemoryVerificationState =
  | "proposed"
  | "verified"
  | "conflict"
  | "disabled";
export type MemorySource =
  | "manual_confirmation"
  | "approved_quote"
  | "approved_po_reconciliation"
  | "verified_erp_mapping"
  | "system_import";
export type MemoryTargetEntityType = "product" | "customer";

export type WorkspaceMemoryEntry = {
  id: string;
  organizationId: string;
  customerId: string | null;
  scope: MemoryScope;
  memoryType: string;
  sourceValue: string;
  sourceKey: string;
  targetEntityType: MemoryTargetEntityType;
  targetEntityId: string;
  confidence: number;
  verificationState: MemoryVerificationState;
  source: MemorySource;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  metadata: Record<string, unknown>;
  verifiedBy: string | null;
  verifiedAt: string | null;
  lastUsedAt: string | null;
  useCount: number;
  createdAt: string;
  updatedAt: string;
};

type RawMemoryEntry = {
  id: string;
  organization_id: string;
  customer_id: string | null;
  scope: MemoryScope;
  memory_type: string;
  source_value: string;
  source_key: string;
  target_entity_type: MemoryTargetEntityType;
  target_entity_id: string;
  confidence: number | string;
  verification_state: MemoryVerificationState;
  source: MemorySource;
  source_entity_type: string | null;
  source_entity_id: string | null;
  metadata: Record<string, unknown> | null;
  verified_by: string | null;
  verified_at: string | null;
  last_used_at: string | null;
  use_count: number;
  created_at: string;
  updated_at: string;
};

const MEMORY_SELECT =
  "id,organization_id,customer_id,scope,memory_type,source_value,source_key,target_entity_type,target_entity_id,confidence,verification_state,source,source_entity_type,source_entity_id,metadata,verified_by,verified_at,last_used_at,use_count,created_at,updated_at";

export function normalizeMemoryKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function mapMemoryEntry(row: RawMemoryEntry): WorkspaceMemoryEntry {
  return {
    id: row.id,
    organizationId: row.organization_id,
    customerId: row.customer_id,
    scope: row.scope,
    memoryType: row.memory_type,
    sourceValue: row.source_value,
    sourceKey: row.source_key,
    targetEntityType: row.target_entity_type,
    targetEntityId: row.target_entity_id,
    confidence: Number(row.confidence),
    verificationState: row.verification_state,
    source: row.source,
    sourceEntityType: row.source_entity_type,
    sourceEntityId: row.source_entity_id,
    metadata: row.metadata ?? {},
    verifiedBy: row.verified_by,
    verifiedAt: row.verified_at,
    lastUsedAt: row.last_used_at,
    useCount: Number(row.use_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findVerifiedWorkspaceMemory({
  organizationId,
  customerId,
  memoryType,
  sourceValue,
  allowWorkspaceFallback = true,
}: {
  organizationId: string;
  customerId?: string | null;
  memoryType: string;
  sourceValue: string;
  allowWorkspaceFallback?: boolean;
}): Promise<WorkspaceMemoryEntry | null> {
  const supabase = await createClient();
  const sourceKey = normalizeMemoryKey(sourceValue);
  const normalizedType = memoryType.trim().toLowerCase();

  if (!sourceKey || !normalizedType) return null;

  if (customerId) {
    const { data, error } = await supabase
      .from("workspace_memory_entries")
      .select(MEMORY_SELECT)
      .eq("organization_id", organizationId)
      .eq("scope", "customer")
      .eq("customer_id", customerId)
      .eq("memory_type", normalizedType)
      .eq("source_key", sourceKey)
      .eq("verification_state", "verified")
      .maybeSingle();

    if (error) {
      throw new Error(`Workspace memory lookup failed: ${error.message}`);
    }

    if (data) return mapMemoryEntry(data as RawMemoryEntry);
  }

  if (!allowWorkspaceFallback) return null;

  const { data, error } = await supabase
    .from("workspace_memory_entries")
    .select(MEMORY_SELECT)
    .eq("organization_id", organizationId)
    .eq("scope", "workspace")
    .is("customer_id", null)
    .eq("memory_type", normalizedType)
    .eq("source_key", sourceKey)
    .eq("verification_state", "verified")
    .maybeSingle();

  if (error) {
    throw new Error(`Workspace memory lookup failed: ${error.message}`);
  }

  return data ? mapMemoryEntry(data as RawMemoryEntry) : null;
}

export async function rememberWorkspaceDecision({
  organizationId,
  customerId,
  scope = customerId ? "customer" : "workspace",
  memoryType,
  sourceValue,
  targetEntityType,
  targetEntityId,
  source,
  confidence = 100,
  verificationState = "verified",
  sourceEntityType,
  sourceEntityId,
  metadata = {},
}: {
  organizationId: string;
  customerId?: string | null;
  scope?: MemoryScope;
  memoryType: string;
  sourceValue: string;
  targetEntityType: MemoryTargetEntityType;
  targetEntityId: string;
  source: MemorySource;
  confidence?: number;
  verificationState?: MemoryVerificationState;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_workspace_memory_entry", {
    target_organization_id: organizationId,
    target_customer_id: customerId ?? null,
    target_scope: scope,
    target_memory_type: memoryType,
    target_source_value: sourceValue,
    target_entity_type: targetEntityType,
    target_entity_id: targetEntityId,
    target_source: source,
    target_confidence: confidence,
    target_verification_state: verificationState,
    target_source_entity_type: sourceEntityType ?? null,
    target_source_entity_id: sourceEntityId ?? null,
    target_metadata: metadata,
  });

  if (error) {
    throw new Error(`Workspace memory could not be saved: ${error.message}`);
  }

  return String(data);
}

export async function setWorkspaceMemoryState(
  memoryId: string,
  state: MemoryVerificationState,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_workspace_memory_state", {
    target_memory_id: memoryId,
    target_state: state,
  });

  if (error) {
    throw new Error(`Workspace memory state could not be updated: ${error.message}`);
  }
}

export async function recordWorkspaceMemoryUsage(memoryId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_workspace_memory_usage", {
    target_memory_id: memoryId,
  });

  if (error) {
    throw new Error(`Workspace memory usage could not be recorded: ${error.message}`);
  }
}
