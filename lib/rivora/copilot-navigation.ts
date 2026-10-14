import type { CopilotTarget, CopilotSource } from "./copilot-context.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function targetFromPath(path: string): CopilotTarget {
  if (path === "/app") return { type: "dashboard" };
  const match = /^\/app\/(rfq|quotes|products)\/([0-9a-f-]{36})$/i.exec(path);
  if (!match || !UUID.test(match[2])) return { type: "general" };
  return { type: ({ rfq: "rfq", quotes: "quote", products: "product" } as const)[match[1].toLowerCase() as "rfq" | "quotes" | "products"], id: match[2].toLowerCase() };
}

export function sourcePath(source: CopilotSource): string | null {
  if (!UUID.test(source.recordId) || (source.lineId && !UUID.test(source.lineId))) return null;
  const prefix = { rfq: "rfq", quote: "quotes", product: "products" }[source.type];
  if (!prefix || (source.type === "product" && source.lineId)) return null;
  return `/app/${prefix}/${source.recordId}${source.lineId ? `#line-${source.lineId}` : ""}`;
}
