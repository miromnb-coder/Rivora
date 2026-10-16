// All application records, including customer names, are untrusted data.
export function safeContextText(input: unknown, max = 120): string {
  if (typeof input !== "string") return "";
  return input.replace(/[\u0000-\u001f\u007f]/g," ")
    .replace(/[<>]/g,"").replace(/\s+/g," ").trim().slice(0,max);
}
export function safeContextDate(input: unknown): string {
  if (typeof input !== "string" || !Number.isFinite(Date.parse(input))) return "";
  return new Date(input).toISOString();
}
export function serializeContextForModel(result: import("./types").CopilotContextResult): string {
  const safe = {
    status: result.status,
    retrievedAt: result.retrievedAt,
    truncated: result.truncated,
    items: result.items.slice(0,10).map(item=>({
      sourceId: item.source + ":" + item.recordId,
      reference: safeContextText(item.reference,100) || null,
      customerName: safeContextText(item.customerName,100) || null,
      stage: item.stage, status: safeContextText(item.status,80),
      attentionRequired: item.attentionRequired,
      nextAction: safeContextText(item.nextAction,120),
      updatedAt: safeContextDate(item.updatedAt),
    })),
  };
  const json=JSON.stringify(safe);
  if (json.length>6000) throw new Error("COPILOT_CONTEXT_TOO_LARGE");
  return json;
}
