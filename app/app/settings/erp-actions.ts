"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/rivora/workspace";
import {
  disconnectStoredErpConnection,
  getStoredErpConnection,
  markStoredErpConnectionVerification,
  upsertStoredErpConnection,
} from "@/lib/rivora/erp/connections";
import {
  getBusinessCentralConfigurationStatus,
  verifyBusinessCentralConnection,
} from "@/lib/rivora/erp/business-central";

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "").trim().slice(0, max);
}

function settingsUrl(message: string, tone: "ok" | "error" = "ok") {
  const query = new URLSearchParams({ message, tone });
  return `/app/settings?${query.toString()}#erp`;
}

async function requireErpAdmin() {
  const context = await requireWorkspace();
  if (!["owner", "admin"].includes(context.workspace.role)) {
    throw new Error("Owner or admin access is required to manage ERP credentials.");
  }
  if (context.workspace.erpProvider !== "business_central") {
    throw new Error("Microsoft Business Central is not the selected ERP.");
  }
  return context;
}

async function markFailure(
  workspaceId: string,
  actorId: string,
  error: unknown,
) {
  const message =
    error instanceof Error ? error.message : "Business Central connection verification failed.";
  try {
    const stored = await getStoredErpConnection(workspaceId, "business_central");
    if (stored) {
      await markStoredErpConnectionVerification({
        organizationId: workspaceId,
        provider: "business_central",
        result: "error",
        errorMessage: message,
        actorId,
      });
    }
  } catch {
    // Preserve the original verification failure for the user.
  }
  return message;
}

export async function saveBusinessCentralConnectionAction(formData: FormData) {
  const { workspace, claims } = await requireErpAdmin();
  const actorId = String(claims.sub);

  const tenantId = clean(formData.get("tenantId"), 240);
  const clientId = clean(formData.get("clientId"), 240);
  const environment = clean(formData.get("environment"), 120);
  const companyId = clean(formData.get("companyId"), 120);
  let clientSecret = clean(formData.get("clientSecret"), 4000);

  if (!tenantId || !clientId || !environment || !companyId) {
    redirect(settingsUrl("Täytä tenant ID, client ID, environment ja company ID.", "error"));
  }

  const companyUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!companyUuid.test(companyId)) {
    redirect(settingsUrl("Business Central Company ID ei ole kelvollinen UUID.", "error"));
  }

  let message = "";
  let tone: "ok" | "error" = "ok";

  try {
    if (!clientSecret) {
      const existing = await getStoredErpConnection(workspace.id, "business_central");
      if (!existing) {
        const status = await getBusinessCentralConfigurationStatus(workspace.id);
        if (status.source === "legacy_env") {
          // Secure one-click migration path for the currently proven production
          // workspace. The secret stays server-side and is never rendered.
          clientSecret = process.env.BUSINESS_CENTRAL_CLIENT_SECRET?.trim() || "";
        }
      }
    }

    await upsertStoredErpConnection({
      organizationId: workspace.id,
      provider: "business_central",
      configuration: {
        tenantId,
        clientId,
        environment,
        companyId,
      },
      secret: clientSecret,
      actorId,
    });

    const verified = await verifyBusinessCentralConnection(workspace.id);
    await markStoredErpConnectionVerification({
      organizationId: workspace.id,
      provider: "business_central",
      result: "verified",
      companyName: verified.companyName,
      actorId,
    });

    message = `Business Central -yhteys tarkistettu: ${verified.companyName} / ${verified.environment}.`;
  } catch (error) {
    message = await markFailure(workspace.id, actorId, error);
    tone = "error";
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/settings/business-central");
  revalidatePath("/app/sales-orders");
  redirect(settingsUrl(message, tone));
}

export async function verifyBusinessCentralConnectionAction() {
  const { workspace, claims } = await requireErpAdmin();
  const actorId = String(claims.sub);

  let message = "";
  let tone: "ok" | "error" = "ok";

  try {
    const verified = await verifyBusinessCentralConnection(workspace.id);
    const stored = await getStoredErpConnection(workspace.id, "business_central");
    if (!stored) {
      throw new Error(
        "Nykyinen yhteys käyttää vielä legacy-palvelinmääritystä. Tallenna yhteys ensin asiakaskohtaiseksi.",
      );
    }

    await markStoredErpConnectionVerification({
      organizationId: workspace.id,
      provider: "business_central",
      result: "verified",
      companyName: verified.companyName,
      actorId,
    });

    message = `Business Central -yhteys tarkistettu: ${verified.companyName}.`;
  } catch (error) {
    message = await markFailure(workspace.id, actorId, error);
    tone = "error";
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/settings/business-central");
  redirect(settingsUrl(message, tone));
}

export async function disconnectBusinessCentralConnectionAction() {
  const { workspace, claims } = await requireErpAdmin();
  let message = "Business Central -yhteys katkaistiin.";
  let tone: "ok" | "error" = "ok";

  try {
    await disconnectStoredErpConnection({
      organizationId: workspace.id,
      provider: "business_central",
      actorId: String(claims.sub),
    });
  } catch (error) {
    message =
      error instanceof Error ? error.message : "Business Central -yhteyttä ei voitu katkaista.";
    tone = "error";
  }

  revalidatePath("/app/settings");
  revalidatePath("/app/settings/business-central");
  revalidatePath("/app/sales-orders");
  redirect(settingsUrl(message, tone));
}
