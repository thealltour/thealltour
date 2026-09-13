import type { AgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import {
  summarizeTopicIdentity,
  type IdentityConflictDiagnostic,
} from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { validateAngleAgainstAgendaIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/validateAgainstIdentity";
import type { ContentStrategistOutput } from "@/lib/marketing/bot/organization/handoffs";

export class ContentStrategistTopicIdentityError extends Error {
  readonly failureClass = "topic_identity_violation" as const;
  readonly diagnostics: IdentityConflictDiagnostic[];

  constructor(message: string, diagnostics: IdentityConflictDiagnostic[]) {
    super(message);
    this.name = "ContentStrategistTopicIdentityError";
    this.diagnostics = diagnostics;
  }

  toPipelineMessage(): string {
    return `content_strategist_topic_identity_violation: ${this.message}`;
  }
}

/**
 * Deterministic post-CS validation: primaryAngle / keyMessage / title / proposition
 * must not contradict AgendaTopicIdentity.
 */
export function validateContentStrategistAgainstTopicIdentity(input: {
  output: ContentStrategistOutput;
  identity: AgendaTopicIdentity;
  agendaId?: string | null;
  candidateId?: string | null;
}): { ok: true } | { ok: false; diagnostics: IdentityConflictDiagnostic[]; reasons: string[] } {
  const { output, identity } = input;
  const diagnostics: IdentityConflictDiagnostic[] = [];
  const reasons: string[] = [];
  const prop = output.contentPlan?.proposition;
  const checks: Array<{ field: string; text: string }> = [
    { field: "primaryAngle", text: output.contentPlan?.primaryAngle ?? "" },
    { field: "keyMessage", text: output.contentPlan?.keyMessage ?? "" },
    { field: "title", text: output.title ?? "" },
    { field: "proposition.angle", text: prop?.angle ?? "" },
    { field: "proposition.contentPromise", text: prop?.contentPromise ?? "" },
  ];

  for (const check of checks) {
    if (!check.text.trim()) continue;
    const result = validateAngleAgainstAgendaIdentity(check.text, identity);
    if (result.ok) continue;
    for (const iss of result.issues) {
      reasons.push(`${check.field}:${iss.dimension}:${iss.reason}`);
      diagnostics.push({
        stage: `content_strategist:${check.field}`,
        agendaId: input.agendaId ?? null,
        candidateId: input.candidateId ?? null,
        conflictDimension: iss.dimension,
        rejectedText: iss.rejectedText,
        identitySummary: summarizeTopicIdentity(identity),
      });
    }
  }

  if (diagnostics.length === 0) return { ok: true };
  return { ok: false, diagnostics, reasons };
}

export class ContentStrategistPropositionError extends Error {
  readonly failureClass = "content_proposition_violation" as const;
  readonly issues: Array<{ code: string; field: string; message: string }>;
  readonly effectiveStrength: string;

  constructor(
    message: string,
    issues: Array<{ code: string; field: string; message: string }>,
    effectiveStrength: string,
  ) {
    super(message);
    this.name = "ContentStrategistPropositionError";
    this.issues = issues;
    this.effectiveStrength = effectiveStrength;
  }

  toPipelineMessage(): string {
    return `content_strategist_proposition_violation: ${this.message}`;
  }
}
