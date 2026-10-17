import { decodeCopilotEvent, type CopilotEvent, type CopilotMessage } from "./copilot-protocol.ts";

/**
 * Decodes real SSE response frames across arbitrary network/UTF-8 chunk splits.
 * Keeps no chat content after a request is finished.
 */
export class CopilotStreamParser {
  private readonly decoder = new TextDecoder();
  private buffer = "";
  private readonly maxFrameChars = 16_384;

  push(chunk: Uint8Array): CopilotEvent[] {
    this.buffer += this.decoder.decode(chunk, { stream: true });
    // Normalize CRLF after joining chunks; a CR/LF may arrive separately.
    this.buffer = this.buffer.replace(/\r\n/g, "\n");
    const events: CopilotEvent[] = [];
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary !== -1) {
      if (boundary > this.maxFrameChars) throw new Error("Copilot event too large.");
      const frame = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const event = decodeCopilotEvent(frame);
      if (event) events.push(event);
      boundary = this.buffer.indexOf("\n\n");
    }
    if (this.buffer.length > this.maxFrameChars) throw new Error("Copilot event too large.");
    return events;
  }

  finish(): void {
    this.buffer += this.decoder.decode();
    // The API always ends a valid event with a blank line.
    if (this.buffer.trim()) throw new Error("Copilot stream ended in the middle of an event.");
    this.buffer = "";
  }
}

export type HistoryMessage = CopilotMessage & {
  stage?: "retrieving" | "evidence_read" | "verifying" | "connecting" | "responding" | "done" | "stopped" | "error";
};

/** Only successful, complete turns may be sent back as contextual history. */
export function buildCopilotHistory(messages: readonly HistoryMessage[]): CopilotMessage[] {
  const pairs: CopilotMessage[] = [];
  for (let i = 0; i < messages.length - 1; i++) {
    const user = messages[i];
    const answer = messages[i + 1];
    if (user.role === "user" && answer.role === "assistant" &&
        answer.stage === "done" && user.text.trim() && answer.text.trim()) {
      pairs.push({ role: "user", text: user.text.trim().slice(0, 1200) });
      pairs.push({ role: "assistant", text: answer.text.trim().slice(0, 1600) });
      i++;
    }
  }
  return pairs.slice(-8);
}
