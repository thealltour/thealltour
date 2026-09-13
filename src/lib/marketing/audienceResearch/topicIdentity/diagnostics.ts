import type { IdentityConflictDiagnostic } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";

/**
 * Lightweight structured diagnostics for identity conflicts.
 * Avoid secrets / huge prompts — rejectedText is already sanitized upstream.
 */
export function recordIdentityConflict(
  bag: IdentityConflictDiagnostic[],
  entry: IdentityConflictDiagnostic,
): void {
  bag.push({
    ...entry,
    rejectedText: entry.rejectedText.replace(/\s+/g, " ").trim().slice(0, 160),
  });
}

export function formatIdentityDiagnosticsForLog(
  diagnostics: IdentityConflictDiagnostic[],
): Array<Record<string, string | null>> {
  return diagnostics.map((d) => ({
    stage: d.stage,
    agendaId: d.agendaId,
    candidateId: d.candidateId ?? null,
    conflictDimension: d.conflictDimension,
    rejectedText: d.rejectedText,
    identitySummary: d.identitySummary,
  }));
}
