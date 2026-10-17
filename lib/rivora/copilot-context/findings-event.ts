// Phase 5.1D: convert deterministic server findings into a bounded, source-scoped
// transport event. No model-generated URLs, actions, or business data.
import type { DeterministicAnalysis } from "./analysis.ts";
import type { ContextSource } from "./types.ts";
import type { CopilotFindingsEvent, CopilotFinding } from "../copilot-protocol.ts";

export function buildVerifiedFindingsEvent(
  analysis: DeterministicAnalysis,
  verifiedSources: readonly ContextSource[],
): CopilotFindingsEvent | null {
  const bySource = new Map(verifiedSources
    .filter(source => source.sourceId === source.kind + ":" + source.recordId &&
      source.href === "/app/orders/case/" + source.kind + "/" + source.recordId)
    .map(source => [source.sourceId, source]));
  // A finding without a verified record reference is not allowed into the UI.
  const findings: CopilotFinding[] = [];
  for (const item of analysis.findings.slice(0, 5)) {
    if (!bySource.has(item.sourceId)) continue;
    findings.push({
      id: item.id.slice(0,100),
      code: item.code,
      severity: item.severity,
      title: item.title.slice(0,100),
      explanation: item.explanation.slice(0,200),
      suggestedAction: item.suggestedAction.slice(0,150),
      sourceId: item.sourceId,
    });
  }
  if (findings.length === 0) return null;
  return {
    type:"findings", kind:analysis.kind,
    // Omissions must not be hidden by a "complete" label.
    partial:analysis.partial || findings.length < analysis.findings.length,
    findings,
  };
}
