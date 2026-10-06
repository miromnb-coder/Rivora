import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/rivora/workspace";
import { notifySupportAboutCustomerMessage } from "@/lib/rivora/support-email";
import {
  consumePublicRateLimit,
} from "@/lib/rivora/rate-limit";
import {
  operationalLog,
  requestIdFor,
  requestIdHeaders,
  safeErrorMessage,
} from "@/lib/rivora/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = new Set([
  "product",
  "integration",
  "billing",
  "account",
  "other",
]);

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function GET(request: Request) {
  const requestId = requestIdFor(request);

  try {
    const context = await getAuthContext();
    if (!context.claims?.sub || !context.workspace) {
      return NextResponse.json(
        { error: "Authentication required.", requestId },
        { status: 401, headers: requestIdHeaders(requestId) },
      );
    }

    const admin = createAdminClient();
    const { data: tickets, error: ticketError } = await admin
      .from("support_tickets")
      .select(
        "id,ticket_number,subject,category,status,priority,created_at,updated_at,last_message_at,last_support_message_at",
      )
      .eq("organization_id", context.workspace.id)
      .eq("created_by", context.claims.sub)
      .order("last_message_at", { ascending: false })
      .limit(50);

    if (ticketError) throw ticketError;

    const ticketIds = (tickets ?? []).map((ticket) => String(ticket.id));
    const reads =
      ticketIds.length === 0
        ? []
        : (
            await admin
              .from("support_ticket_reads")
              .select("ticket_id,last_read_at")
              .eq("organization_id", context.workspace.id)
              .eq("user_id", context.claims.sub)
              .in("ticket_id", ticketIds)
          ).data ?? [];

    const readByTicket = new Map(
      reads.map((item) => [String(item.ticket_id), String(item.last_read_at)]),
    );

    const items = (tickets ?? []).map((ticket) => {
      const lastReadAt = readByTicket.get(String(ticket.id)) ?? null;
      const lastSupportAt = ticket.last_support_message_at
        ? String(ticket.last_support_message_at)
        : null;
      const unread = Boolean(
        lastSupportAt &&
          (!lastReadAt ||
            new Date(lastSupportAt).getTime() > new Date(lastReadAt).getTime()),
      );

      return {
        id: String(ticket.id),
        ticketNumber: Number(ticket.ticket_number),
        subject: String(ticket.subject),
        category: String(ticket.category),
        status: String(ticket.status),
        priority: String(ticket.priority),
        createdAt: String(ticket.created_at),
        updatedAt: String(ticket.updated_at),
        lastMessageAt: String(ticket.last_message_at || ticket.updated_at),
        unread,
      };
    });

    return NextResponse.json(
      {
        tickets: items,
        unreadCount: items.filter((item) => item.unread).length,
        requestId,
      },
      { status: 200, headers: requestIdHeaders(requestId) },
    );
  } catch (error) {
    operationalLog("error", "support_ticket_list_failed", {
      requestId,
      message: safeErrorMessage(error),
    });

    return NextResponse.json(
      { error: "Support requests could not be loaded.", requestId },
      { status: 503, headers: requestIdHeaders(requestId) },
    );
  }
}

export async function POST(request: Request) {
  const requestId = requestIdFor(request);
  let ticketNumber: number | null = null;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Unsupported request.", requestId },
        { status: 415, headers: requestIdHeaders(requestId) },
      );
    }

    const context = await getAuthContext();
    if (!context.claims?.sub || !context.workspace) {
      return NextResponse.json(
        { error: "Authentication required.", requestId },
        { status: 401, headers: requestIdHeaders(requestId) },
      );
    }

    const limit = await consumePublicRateLimit({
      scope: "support_ticket_user",
      value: `${context.workspace.id}:${context.claims.sub}`,
      windowSeconds: 60 * 60,
      limit: 10,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Too many support requests. Please try again later.",
          requestId,
        },
        {
          status: 429,
          headers: {
            ...requestIdHeaders(requestId),
            "Retry-After": String(limit.retryAfterSeconds),
          },
        },
      );
    }

    const formData = await request.formData();
    const category = text(formData.get("category")).toLowerCase();
    const subject = text(formData.get("subject"));
    const message = text(formData.get("message"));
    const rawContextPath = text(formData.get("contextPath"));
    const contextPath =
      rawContextPath &&
      rawContextPath.startsWith("/app") &&
      rawContextPath.length <= 500
        ? rawContextPath
        : null;

    if (!CATEGORIES.has(category)) {
      return NextResponse.json(
        { error: "Invalid support category.", requestId },
        { status: 400, headers: requestIdHeaders(requestId) },
      );
    }

    if (subject.length < 3 || subject.length > 160) {
      return NextResponse.json(
        { error: "Subject must be between 3 and 160 characters.", requestId },
        { status: 400, headers: requestIdHeaders(requestId) },
      );
    }

    if (message.length < 10 || message.length > 5000) {
      return NextResponse.json(
        { error: "Message must be between 10 and 5000 characters.", requestId },
        { status: 400, headers: requestIdHeaders(requestId) },
      );
    }

    const screenshotValue = formData.get("screenshot");
    const screenshot =
      screenshotValue instanceof File && screenshotValue.size > 0
        ? screenshotValue
        : null;

    if (screenshot) {
      if (!IMAGE_TYPES.has(screenshot.type)) {
        return NextResponse.json(
          { error: "Screenshot must be PNG, JPEG or WebP.", requestId },
          { status: 400, headers: requestIdHeaders(requestId) },
        );
      }

      if (screenshot.size > 5 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Screenshot must be 5 MB or smaller.", requestId },
          { status: 400, headers: requestIdHeaders(requestId) },
        );
      }
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("create_support_ticket_server", {
      target_actor_id: context.claims.sub,
      target_organization_id: context.workspace.id,
      target_category: category,
      target_subject: subject,
      target_message: message,
      target_context_path: contextPath,
      target_request_id: requestId,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const ticketId = String(row?.ticket_id || "");
    ticketNumber = Number(row?.ticket_number);

    if (!ticketId || !Number.isFinite(ticketNumber)) {
      throw new Error("Support ticket creation returned an invalid result.");
    }

    let attachmentUploaded = true;

    if (screenshot) {
      try {
        const storagePath =
          `${context.workspace.id}/${ticketId}/${crypto.randomUUID()}.${extensionFor(screenshot.type)}`;
        const buffer = Buffer.from(await screenshot.arrayBuffer());

        const { error: uploadError } = await admin.storage
          .from("support-attachments")
          .upload(storagePath, buffer, {
            contentType: screenshot.type,
            upsert: false,
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;

        const { error: attachmentError } = await admin
          .from("support_attachments")
          .insert({
            ticket_id: ticketId,
            organization_id: context.workspace.id,
            uploaded_by: context.claims.sub,
            bucket: "support-attachments",
            storage_path: storagePath,
            file_name: screenshot.name.slice(0, 240) || `screenshot.${extensionFor(screenshot.type)}`,
            mime_type: screenshot.type,
            size_bytes: screenshot.size,
          });

        if (attachmentError) {
          await admin.storage.from("support-attachments").remove([storagePath]);
          throw attachmentError;
        }
      } catch (attachmentError) {
        attachmentUploaded = false;
        operationalLog("warn", "support_attachment_failed", {
          requestId,
          ticketNumber,
          message: safeErrorMessage(attachmentError),
        });
      }
    }

    let notificationSent = false;
    try {
      notificationSent = await notifySupportAboutCustomerMessage({
        ticketNumber,
        workspaceName: context.workspace.name,
        requesterEmail:
          typeof context.claims.email === "string"
            ? context.claims.email
            : null,
        subject,
        message: [
          `Category: ${category}`,
          contextPath ? `Context: ${contextPath}` : null,
          "",
          message,
        ]
          .filter(Boolean)
          .join("\n"),
        requestId,
      });
    } catch (notificationError) {
      operationalLog("warn", "support_notification_failed", {
        requestId,
        ticketNumber,
        message: safeErrorMessage(notificationError),
      });
    }

    operationalLog("info", "support_ticket_created", {
      requestId,
      ticketNumber,
      organizationId: context.workspace.id,
      attachmentUploaded,
      notificationSent,
    });

    return NextResponse.json(
      {
        ok: true,
        ticketNumber,
        attachmentUploaded,
        notificationSent,
        requestId,
      },
      { status: 201, headers: requestIdHeaders(requestId) },
    );
  } catch (error) {
    operationalLog("error", "support_ticket_failed", {
      requestId,
      ticketNumber,
      message: safeErrorMessage(error),
    });

    return NextResponse.json(
      {
        error: "Support request could not be created.",
        requestId,
      },
      { status: 503, headers: requestIdHeaders(requestId) },
    );
  }
}
