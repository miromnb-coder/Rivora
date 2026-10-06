import {
  operationalLog,
  safeErrorMessage,
} from "@/lib/rivora/observability";

function supportRecipient() {
  return (
    process.env.AVEROMIRA_SUPPORT_EMAIL?.trim() ||
    process.env.AVEROMIRA_QUOTE_REPLY_TO?.trim() ||
    null
  );
}

function supportFrom() {
  return (
    process.env.AVEROMIRA_SUPPORT_FROM?.trim() ||
    process.env.AVEROMIRA_QUOTE_FROM?.trim() ||
    null
  );
}

async function sendSupportEmail({
  to,
  replyTo,
  subject,
  text,
  requestId,
  event,
}: {
  to: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  requestId: string;
  event: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = supportFrom();

  if (!apiKey || !from || !to) {
    operationalLog("info", "support_email_skipped", {
      requestId,
      event,
      configured: false,
    });
    return false;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: replyTo || undefined,
        subject,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend returned status ${response.status}.`);
    }

    return true;
  } catch (error) {
    operationalLog("warn", "support_email_failed", {
      requestId,
      event,
      message: safeErrorMessage(error),
    });
    return false;
  }
}

export async function notifySupportAboutCustomerMessage({
  ticketNumber,
  workspaceName,
  requesterEmail,
  subject,
  message,
  requestId,
}: {
  ticketNumber: number;
  workspaceName: string;
  requesterEmail: string | null;
  subject: string;
  message: string;
  requestId: string;
}) {
  const recipient = supportRecipient();
  if (!recipient) return false;

  return sendSupportEmail({
    to: recipient,
    replyTo: requesterEmail,
    subject: `Averomira support #${ticketNumber}: ${subject}`,
    text: [
      `Ticket: #${ticketNumber}`,
      `Workspace: ${workspaceName}`,
      `Requester: ${requesterEmail || "Unknown"}`,
      `Request ID: ${requestId}`,
      "",
      message,
    ].join("\n"),
    requestId,
    event: "customer_message",
  });
}

export async function notifyCustomerAboutSupportReply({
  ticketNumber,
  requesterEmail,
  subject,
  message,
  requestId,
}: {
  ticketNumber: number;
  requesterEmail: string | null;
  subject: string;
  message: string;
  requestId: string;
}) {
  if (!requesterEmail) return false;

  return sendSupportEmail({
    to: requesterEmail,
    replyTo: supportRecipient(),
    subject: `Averomira support #${ticketNumber}: ${subject}`,
    text: [
      `Ticket: #${ticketNumber}`,
      "",
      message,
      "",
      "Open Averomira and choose Help → My support requests to continue the conversation.",
    ].join("\n"),
    requestId,
    event: "support_reply",
  });
}
