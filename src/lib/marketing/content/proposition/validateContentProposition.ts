import type { AgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { validateAngleAgainstAgendaIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/validateAgainstIdentity";
import type {
  ContentProposition,
  PropositionStrength,
} from "@/lib/marketing/content/proposition/contracts";

const GENERIC_PLACEHOLDER_PATTERNS = [
  /여행\s*계획에\s*참고/,
  /도움이\s*되는\s*정보/,
  /관심\s*있는\s*사람/,
  /자세히\s*알아보/,
  /여행\s*준비에\s*도움/,
  /관련\s*정보를\s*정리/,
  /유용한\s*정보를\s*제공/,
  /관측됨$/,
  /참고하(면|세요|기)/,
  /도움이\s*될\s*수\s*있/,
];

export type ContentPropositionValidationIssue = {
  code: string;
  field: string;
  message: string;
};

export type ContentPropositionValidationResult = {
  ok: boolean;
  issues: ContentPropositionValidationIssue[];
  /** Strength after heuristic/downgrade (may be weaker than declared). */
  effectiveStrength: PropositionStrength;
};

function looksGeneric(text: string): boolean {
  const t = text.trim();
  if (t.length < 12) return true;
  return GENERIC_PLACEHOLDER_PATTERNS.some((re) => re.test(t));
}

function issue(code: string, field: string, message: string): ContentPropositionValidationIssue {
  return { code, field, message };
}

/**
 * Deterministic ContentProposition validation.
 * Insufficient propositions may omit some fields; others must be specific.
 */
export function validateContentProposition(
  proposition: ContentProposition | null | undefined,
  options?: {
    identity?: AgendaTopicIdentity | null;
    requireTakeawaysMin?: number;
  },
): ContentPropositionValidationResult {
  if (!proposition) {
    return {
      ok: false,
      issues: [issue("missing_proposition", "proposition", "content proposition missing")],
      effectiveStrength: "insufficient",
    };
  }

  const issues: ContentPropositionValidationIssue[] = [];
  const strength = proposition.propositionStrength;
  const requireFull = strength !== "insufficient";
  const takeawayMin = options?.requireTakeawaysMin ?? (strength === "strong" ? 2 : 1);

  if (requireFull) {
    if (!proposition.primaryAudience.trim()) {
      issues.push(issue("audience_required", "primaryAudience", "primaryAudience required"));
    } else if (looksGeneric(proposition.primaryAudience) && /여행\s*고려|한국\s*여행자|관심\s*있는/.test(proposition.primaryAudience)) {
      issues.push(issue("audience_too_generic", "primaryAudience", "primaryAudience too generic"));
    }

    if (!proposition.audienceProblem.trim()) {
      issues.push(issue("problem_required", "audienceProblem", "audienceProblem required"));
    } else if (looksGeneric(proposition.audienceProblem)) {
      issues.push(issue("problem_too_generic", "audienceProblem", "audienceProblem too generic"));
    }

    if (!proposition.contentPromise.trim()) {
      issues.push(issue("promise_required", "contentPromise", "contentPromise required"));
    } else if (looksGeneric(proposition.contentPromise)) {
      issues.push(issue("promise_too_generic", "contentPromise", "contentPromise too generic / placeholder"));
    }

    if (!proposition.readerGain.trim()) {
      issues.push(issue("reader_gain_required", "readerGain", "readerGain required"));
    } else if (looksGeneric(proposition.readerGain)) {
      issues.push(issue("reader_gain_too_generic", "readerGain", "readerGain too generic"));
    }

    if (proposition.specificTakeaways.length < takeawayMin) {
      issues.push(
        issue(
          "takeaway_required",
          "specificTakeaways",
          `at least ${takeawayMin} specific takeaway(s) required`,
        ),
      );
    } else if (proposition.specificTakeaways.every((t) => looksGeneric(t))) {
      issues.push(issue("takeaways_generic", "specificTakeaways", "takeaways are placeholder-like"));
    }

    if (!String(proposition.engagementMechanism || "").trim()) {
      issues.push(issue("engagement_required", "engagementMechanism", "engagementMechanism required"));
    }

    if (!String(proposition.desiredAudienceAction || "").trim()) {
      issues.push(issue("action_required", "desiredAudienceAction", "desiredAudienceAction required"));
    }

    if (!proposition.angle.trim()) {
      issues.push(issue("angle_required", "angle", "angle required"));
    }
  }

  if (options?.identity && proposition.angle.trim()) {
    const identityCheck = validateAngleAgainstAgendaIdentity(
      `${proposition.angle} ${proposition.contentPromise} ${proposition.keyMessage}`,
      options.identity,
    );
    if (!identityCheck.ok) {
      issues.push(
        issue(
          "identity_mismatch",
          "angle",
          identityCheck.issues.map((i) => i.reason).join("; ") || "angle conflicts with AgendaTopicIdentity",
        ),
      );
    }
  }

  let effectiveStrength = strength;
  if (issues.some((i) => i.code === "identity_mismatch")) {
    effectiveStrength = "insufficient";
  } else if (issues.length > 0 && strength === "strong") {
    effectiveStrength = "weak";
  } else if (issues.length > 0 && strength === "usable") {
    effectiveStrength = "weak";
  }

  // Non-insufficient with validation failures → not ok.
  // Insufficient with identity mismatch → not ok.
  // Insufficient without identity issues → ok (structured limitation path).
  const ok =
    strength === "insufficient"
      ? !issues.some((i) => i.code === "identity_mismatch")
      : issues.length === 0;

  return { ok, issues, effectiveStrength };
}
