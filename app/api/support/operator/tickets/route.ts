import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/rivora/workspace";
import { isSupportOperatorEmail } from "@/lib/rivora/support-operator";
import {
  operationalLog,
  requestIdFor,
  requestIdHeaders,
  safeErrorMessage,
} from "@/lib/rivora/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = requestIdFor(request);

  try {
    const context = await getAuthContext();
    const email =
      typeof context.claims?.email === "string" ? context.claims.email : null;

    if (!context.claims?.sub || !isSupportOperatorEmail(email)) {
      return NextResponse.json(
        { error: "Not authorized.", requestId },
        { status: 403, headers: requestIdHeaders(requestId) },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("support_tickets")
      .select(
        "id,ticket_number,organization_id,requester_email,subject,category,status,priority,created_at,updated_at,last_message_at,last_user_message_at,last_support_message_at,organizations(name)",
      )
      .order("last_message_at", { ascending: false })
      .limit(100);

    if (error) throw error;

    const tickets = (data ?? []).map((ticket) => {
      const organization = Array.isArray(ticket.organizations)
        ? ticket.organizations[0]
        : ticket.organizations;

      return {
        id: String(ticket.id),
        ticketNumber: Number(ticket.ticket_number),
        organizationId: String(ticket.organization_id),
        workspaceName:
          organization && typeof organization === "object" && "name" in organization
            ? String(organization.name)
            : "Workspace",
        requesterEmail: ticket.requester_email
          ? String(ticket.requester_email)
          : null,
        subject: String(ticket.subject),
        category: String(ticket.category),
        status: String(ticket.status),
        priority: String(ticket.priority),
        createdAt: String(ticket.created_at),
        updatedAt: String(ticket.updated_at),
        lastMessageAt: String(ticket.last_message_at || ticket.updated_at),
        waitingOnSupport: Boolean(
          ticket.last_user_message_at &&
            (!ticket.last_support_message_at ||
              new Date(String(ticket.last_user_message_at)).getTime() >
                new Date(String(ticket.last_support_message_at)).getTime()),
        ),
      };
    });

    return NextResponse.json(
      { tickets, requestId },
      { status: 200, headers: requestIdHeaders(requestId) },
    );
  } catch (error) {
    operationalLog("error", "support_operator_list_failed", {
      requestId,
      message: safeErrorMessage(error),
    });

    return NextResponse.json(
      { error: "Support inbox could not be loaded.", requestId },
      { status: 503, headers: requestIdHeaders(requestId) },
    );
  }
}
