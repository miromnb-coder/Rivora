// Phase 5.1B.4 — Presentation only: never interpret this as structured RFQ evidence.
// Model output remains untrusted plain text and React escapes every string.
export type CopilotAnswerBlock =
  | { kind: "heading" | "paragraph"; text: string }
  | { kind: "list"; items: string[] };

const KNOWN_SECTIONS = new Set([
  "Tilanne", "Rivit", "Seuraavaksi", "Perustelu", "Tarkistettavat rivit",
  "Status", "Lines", "Next step", "Reason",
]);

function headingOf(line: string): string | null {
  const cleaned = line.trim().replace(/^#{1,3}\s+/, "")
    .replace(/^\*\*/, "").replace(/\*\*:?$/, "").replace(/:$/, "");
  return KNOWN_SECTIONS.has(cleaned) ? cleaned : null;
}

/** Bounded plain text -> headings, paragraphs, and simple lists. No HTML/Markdown links. */
export function formatCopilotAnswer(text: string): CopilotAnswerBlock[] {
  if (!text.trim()) return [];
  const result: CopilotAnswerBlock[] = [];
  const lines = text.slice(0, 6000).replace(/\r\n?/g, "\n").split("\n");
  let paragraph: string[] = [];
  let bullet: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      result.push({ kind: "paragraph", text: paragraph.join(" ").trim() });
      paragraph = [];
    }
    if (bullet.length) {
      result.push({ kind: "list", items: bullet });
      bullet = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const heading = headingOf(line);
    if (heading) {
      flush();
      result.push({ kind: "heading", text: heading });
      continue;
    }
    const bulletMatch = /^(?:-|•)\s+(.+)$/.exec(line);
    if (bulletMatch) {
      if (paragraph.length) {
        result.push({ kind: "paragraph", text: paragraph.join(" ").trim() });
        paragraph = [];
      }
      bullet.push(bulletMatch[1]);
      continue;
    }
    if (bullet.length) {
      result.push({ kind: "list", items: bullet });
      bullet = [];
    }
    paragraph.push(line);
  }
  flush();
  return result;
}
