function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function configuredSupportOperatorEmails() {
  const values = [
    process.env.AVEROMIRA_SUPPORT_ADMIN_EMAILS,
    process.env.AVEROMIRA_SUPPORT_EMAIL,
    process.env.AVEROMIRA_QUOTE_REPLY_TO,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(/[;,]/))
    .map(normalizeEmail)
    .filter(Boolean);

  return new Set(values);
}

export function isSupportOperatorEmail(email: unknown) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return configuredSupportOperatorEmails().has(normalized);
}
