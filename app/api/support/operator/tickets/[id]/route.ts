import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/rivora/workspace";
import { isSupportOperatorEmail } from "@/lib/rivora/support-operator";
import { notifyCustomerAboutSupportReply } from "@/lib/rivora/support-email";
import { consumePublicRateLimit } from "@/lib/rivora/rate-limit";
import {
  operationalLog,
  requestIdFor,
  requestIdHeaders,
  safeErrorMessage,
} from "@/lib/rivora/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = new Set([
  "new",
  "in_progress",
  "waiting_customer",
  "resolved",
]);
const PRIORITIES = new Set(["low", "normal", "high"]);

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function operatorContext() {
  const context = await getAuthContext();
  const email =
    typeof context.claims?.email === "string" ? context.claims.email : null;

  return {
    context,
    allowed: Boolean(
      context.claims?.sub && isSupportOperatorEmail(email),
    ),
  };
}

async function operatorTicket(id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_tickets")
    .select(
      "id,ticket_number,organization_id,created_by,requester_email,subject,category,status,priority,context_path,request_id,created_at,updated_at,resolved_at,last_message_at,last_user_message_at,last_support_message_at,organizations(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFor(request);

  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json(
        { error: "Cross-site requests are not allowed.", requestId },
        { status: 403, headers: requestIdHeaders(requestId) },
      );
    }

    const { context, allowed } = await operatorContext();
    if (!allowed || !context.claims?.sub) {
      return NextResponse.json(
        { error: "Not authorized.", requestId },
        { status: 403, headers: requestIdHeaders(requestId) },
      );
    }

    const { id } = await params;
    const ticket = await operatorTicket(id);
    if (!ticket) {
      return NextResponse.json(
        { error: "Support ticket not found.", requestId },
        { status: 404, headers: requestIdHeaders(requestId) },
      );
    }

    const admin = createAdminClient();
    const [{ data: messages, error: messageError }, { data: attachments, error: attachmentError }] =
      await Promise.all([
        admin
          .from("support_messages")
          .select("id,author_user_id,author_type,body,created_at")
          .eq("ticket_id", id)
          .order("created_at", { ascending: true }),
        admin
          .from("support_attachments")
          .select("id,message_id,bucket,storage_path,file_name,mime_type,size_bytes,created_at")
          .eq("ticket_id", id)
          .order("created_at", { ascending: true }),
      ]);

    if (messageError) throw messageError;
    if (attachmentError) throw attachmentError;

    const attachmentItems = await Promise.all(
      (attachments ?? []).map(async (attachment) => {
        const { data, error } = await admin.storage
          .from(String(attachment.bucket))
          .createSignedUrl(String(attachment.storage_path), 15 * 60);

        return {
          id: String(attachment.id),
          messageId: attachment.message_id
            ? String(attachment.message_id)
            : null,
          fileName: String(attachment.file_name),
          mimeType: String(attachment.mime_type),
          sizeBytes: Number(attachment.size_bytes),
          createdAt: String(attachment.created_at),
          url: error ? null : data?.signedUrl ?? null,
        };
      }),
    );

    const organization = Array.isArray(ticket.organizations)
      ? ticket.organizations[0]
      : ticket.organizations;

    return NextResponse.json(
      {
        ticket: {
          id: String(ticket.id),
          ticketNumber: Number(ticket.ticket_number),
          organizationId: String(ticket.organization_id),
          workspaceName:
            organization &&
            typeof organization === "object" &&
            "name" in organization
              ? String(organization.name)
              : "Workspace",
          requesterEmail: ticket.requester_email
            ? String(ticket.requester_email)
            : null,
          subject: String(ticket.subject),
          category: String(ticket.category),
          status: String(ticket.status),
          priority: String(ticket.priority),
          contextPath: ticket.context_path
            ? String(ticket.context_path)
            : null,
          requestId: ticket.request_id ? String(ticket.request_id) : null,
          createdAt: String(ticket.created_at),
          updatedAt: String(ticket.updated_at),
          resolvedAt: ticket.resolved_at
            ? String(ticket.resolved_at)
            : null,
        },
        messages: (messages ?? []).map((message) => ({
          id: String(message.id),
          authorUserId: message.author_user_id
            ? String(message.author_user_id)
            : null,
          authorType: String(message.author_type),
          body: String(message.body),
          createdAt: String(message.created_at),
        })),
        attachments: attachmentItems,
        requestId,
      },
      { status: 200, headers: requestIdHeaders(requestId) },
    );
  } catch (error) {
    operationalLog("error", "support_operator_detail_failed", {
      requestId,
      message: safeErrorMessage(error),
    });

    return NextResponse.json(
      { error: "Support ticket could not be loaded.", requestId },
      { status: 503, headers: requestIdHeaders(requestId) },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFor(request);

  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json(
        { error: "Cross-site requests are not allowed.", requestId },
        { status: 403, headers: requestIdHeaders(requestId) },
      );
    }

    const { context, allowed } = await operatorContext();
    if (!allowed || !context.claims?.sub) {
      return NextResponse.json(
        { error: "Not authorized.", requestId },
        { status: 403, headers: requestIdHeaders(requestId) },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Unsupported request.", requestId },
        { status: 415, headers: requestIdHeaders(requestId) },
      );
    }

    const { id } = await params;
    const ticket = await operatorTicket(id);
    if (!ticket) {
      return NextResponse.json(
        { error: "Support ticket not found.", requestId },
        { status: 404, headers: requestIdHeaders(requestId) },
      );
    }

    const limit = await consumePublicRateLimit({
      scope: "support_operator_reply",
      value: context.claims.sub,
      windowSeconds: 60 * 60,
      limit: 120,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many support replies.", requestId },
        {
          status: 429,
          headers: {
            ...requestIdHeaders(requestId),
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }

    const body = await request.json();
    const message = cleanString(body.message);
    const status = cleanString(body.status) || "waiting_customer";

    if (message.length < 1 || message.length > 5000) {
      return NextResponse.json(
        { error: "Message must be between 1 and 5000 characters.", requestId },
        { status: 400, headers: requestIdHeaders(requestId) },
      );
    }

    if (!STATUSES.has(status)) {
      return NextResponse.json(
        { error: "Invalid support status.", requestId },
        { status: 400, headers: requestIdHeaders(requestId) },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc(
      "append_support_operator_message_server",
      {
        target_operator_id: context.claims.sub,
        target_ticket_id: id,
        target_message: message,
        target_status: status,
      },
    );

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const messageId = String(row?.message_id || "");
    const nextStatus = String(row?.ticket_status || status);
    if (!messageId) throw new Error("Support operator reply returned no message id.");

    const notificationSent = await notifyCustomerAboutSupportReply({
      ticketNumber: Number(ticket.ticket_number),
      requesterEmail: ticket.requester_email
        ? String(ticket.requester_email)
        : null,
      subject: String(ticket.subject),
      message,
      requestId,
    });

    operationalLog("info", "support_operator_reply_added", {
      requestId,
      ticketNumber: Number(ticket.ticket_number),
      operatorId: context.claims.sub,
      status: nextStatus,
      notificationSent,
    });

    return NextResponse.json(
      {
        ok: true,
        messageId,
        status: nextStatus,
        notificationSent,
        requestId,
      },
      { status: 201, headers: requestIdHeaders(requestId) },
    );
  } catch (error) {
    operationalLog("error", "support_operator_reply_failed", {
      requestId,
      message: safeErrorMessage(error),
    });

    return NextResponse.json(
      { error: "Support reply could not be sent.", requestId },
      { status: 503, headers: requestIdHeaders(requestId) },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFor(request);

  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json(
        { error: "Cross-site requests are not allowed.", requestId },
        { status: 403, headers: requestIdHeaders(requestId) },
      );
    }

    const { context, allowed } = await operatorContext();
    if (!allowed || !context.claims?.sub) {
      return NextResponse.json(
        { error: "Not authorized.", requestId },
        { status: 403, headers: requestIdHeaders(requestId) },
      );
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Unsupported request.", requestId },
        { status: 415, headers: requestIdHeaders(requestId) },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const status = cleanString(body.status);
    const priority = cleanString(body.priority);

    if (!STATUSES.has(status) || !PRIORITIES.has(priority)) {
      return NextResponse.json(
        { error: "Invalid support update.", requestId },
        { status: 400, headers: requestIdHeaders(requestId) },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc(
      "update_support_ticket_operator_server",
      {
        target_operator_id: context.claims.sub,
        target_ticket_id: id,
        target_status: status,
        target_priority: priority,
      },
    );

    if (error) throw error;
    if (data !== true) throw new Error("Support ticket update failed.");

    operationalLog("info", "support_operator_ticket_updated", {
      requestId,
      ticketId: id,
      operatorId: context.claims.sub,
      status,
      priority,
    });

    return NextResponse.json(
      { ok: true, status, priority, requestId },
      { status: 200, headers: requestIdHeaders(requestId) },
    );
  } catch (error) {
    operationalLog("error", "support_operator_update_failed", {
      requestId,
      message: safeErrorMessage(error),
    });

    return NextResponse.json(
      { error: "Support ticket could not be updated.", requestId },
      { status: 503, headers: requestIdHeaders(requestId) },
    );
  }
}
