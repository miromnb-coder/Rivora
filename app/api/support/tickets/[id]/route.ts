import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthContext } from "@/lib/rivora/workspace";
import { consumePublicRateLimit } from "@/lib/rivora/rate-limit";
import { notifySupportAboutCustomerMessage } from "@/lib/rivora/support-email";
import {
  operationalLog,
  requestIdFor,
  requestIdHeaders,
  safeErrorMessage,
} from "@/lib/rivora/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function text(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function extensionFor(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function ticketForActor(
  ticketId: string,
  organizationId: string,
  actorId: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_tickets")
    .select(
      "id,ticket_number,organization_id,created_by,requester_email,subject,category,status,priority,context_path,created_at,updated_at,resolved_at,last_message_at,last_support_message_at",
    )
    .eq("id", ticketId)
    .eq("organization_id", organizationId)
    .eq("created_by", actorId)
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
    const context = await getAuthContext();
    if (!context.claims?.sub || !context.workspace) {
      return NextResponse.json(
        { error: "Authentication required.", requestId },
        { status: 401, headers: requestIdHeaders(requestId) },
      );
    }

    const { id } = await params;
    const ticket = await ticketForActor(
      id,
      context.workspace.id,
      context.claims.sub,
    );

    if (!ticket) {
      return NextResponse.json(
        { error: "Support request not found.", requestId },
        { status: 404, headers: requestIdHeaders(requestId) },
      );
    }

    const admin = createAdminClient();
    const [{ data: messages, error: messageError }, { data: attachments, error: attachmentError }] =
      await Promise.all([
        admin
          .from("support_messages")
          .select("id,author_type,body,created_at")
          .eq("ticket_id", id)
          .eq("organization_id", context.workspace.id)
          .order("created_at", { ascending: true }),
        admin
          .from("support_attachments")
          .select("id,message_id,bucket,storage_path,file_name,mime_type,size_bytes,created_at")
          .eq("ticket_id", id)
          .eq("organization_id", context.workspace.id)
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

    const { error: readError } = await admin.rpc(
      "mark_support_ticket_read_server",
      {
        target_actor_id: context.claims.sub,
        target_organization_id: context.workspace.id,
        target_ticket_id: id,
      },
    );

    if (readError) {
      operationalLog("warn", "support_ticket_mark_read_failed", {
        requestId,
        ticketNumber: Number(ticket.ticket_number),
        message: readError.message,
      });
    }

    return NextResponse.json(
      {
        ticket: {
          id: String(ticket.id),
          ticketNumber: Number(ticket.ticket_number),
          subject: String(ticket.subject),
          category: String(ticket.category),
          status: String(ticket.status),
          priority: String(ticket.priority),
          contextPath: ticket.context_path ? String(ticket.context_path) : null,
          createdAt: String(ticket.created_at),
          updatedAt: String(ticket.updated_at),
          resolvedAt: ticket.resolved_at ? String(ticket.resolved_at) : null,
          lastMessageAt: String(ticket.last_message_at || ticket.updated_at),
        },
        messages: (messages ?? []).map((message) => ({
          id: String(message.id),
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
    operationalLog("error", "support_ticket_detail_failed", {
      requestId,
      message: safeErrorMessage(error),
    });

    return NextResponse.json(
      { error: "Support request could not be loaded.", requestId },
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

    const { id } = await params;
    const ticket = await ticketForActor(
      id,
      context.workspace.id,
      context.claims.sub,
    );

    if (!ticket) {
      return NextResponse.json(
        { error: "Support request not found.", requestId },
        { status: 404, headers: requestIdHeaders(requestId) },
      );
    }

    const limit = await consumePublicRateLimit({
      scope: "support_ticket_reply_user",
      value: `${context.workspace.id}:${context.claims.sub}`,
      windowSeconds: 60 * 60,
      limit: 30,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        {
          error: "Too many support replies. Please try again later.",
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
    const message = text(formData.get("message"));
    if (message.length < 1 || message.length > 5000) {
      return NextResponse.json(
        { error: "Message must be between 1 and 5000 characters.", requestId },
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
    const { data, error } = await admin.rpc(
      "append_support_user_message_server",
      {
        target_actor_id: context.claims.sub,
        target_organization_id: context.workspace.id,
        target_ticket_id: id,
        target_message: message,
      },
    );

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const messageId = String(row?.message_id || "");
    const status = String(row?.ticket_status || ticket.status);
    if (!messageId) throw new Error("Support reply returned no message id.");

    let attachmentUploaded = true;
    if (screenshot) {
      try {
        const storagePath =
          `${context.workspace.id}/${id}/${crypto.randomUUID()}.${extensionFor(screenshot.type)}`;
        const buffer = Buffer.from(await screenshot.arrayBuffer());

        const { error: uploadError } = await admin.storage
          .from("support-attachments")
          .upload(storagePath, buffer, {
            contentType: screenshot.type,
            upsert: false,
            cacheControl: "3600",
          });

        if (uploadError) throw uploadError;

        const { error: attachmentInsertError } = await admin
          .from("support_attachments")
          .insert({
            ticket_id: id,
            organization_id: context.workspace.id,
            message_id: messageId,
            uploaded_by: context.claims.sub,
            bucket: "support-attachments",
            storage_path: storagePath,
            file_name:
              screenshot.name.slice(0, 240) ||
              `screenshot.${extensionFor(screenshot.type)}`,
            mime_type: screenshot.type,
            size_bytes: screenshot.size,
          });

        if (attachmentInsertError) {
          await admin.storage.from("support-attachments").remove([storagePath]);
          throw attachmentInsertError;
        }
      } catch (attachmentError) {
        attachmentUploaded = false;
        operationalLog("warn", "support_reply_attachment_failed", {
          requestId,
          ticketNumber: Number(ticket.ticket_number),
          message: safeErrorMessage(attachmentError),
        });
      }
    }

    const notificationSent = await notifySupportAboutCustomerMessage({
      ticketNumber: Number(ticket.ticket_number),
      workspaceName: context.workspace.name,
      requesterEmail:
        typeof context.claims.email === "string" ? context.claims.email : null,
      subject: String(ticket.subject),
      message,
      requestId,
    });

    operationalLog("info", "support_customer_reply_added", {
      requestId,
      ticketNumber: Number(ticket.ticket_number),
      organizationId: context.workspace.id,
      status,
      attachmentUploaded,
      notificationSent,
    });

    return NextResponse.json(
      {
        ok: true,
        messageId,
        status,
        attachmentUploaded,
        notificationSent,
        requestId,
      },
      { status: 201, headers: requestIdHeaders(requestId) },
    );
  } catch (error) {
    operationalLog("error", "support_customer_reply_failed", {
      requestId,
      message: safeErrorMessage(error),
    });

    return NextResponse.json(
      { error: "Support reply could not be sent.", requestId },
      { status: 503, headers: requestIdHeaders(requestId) },
    );
  }
}
