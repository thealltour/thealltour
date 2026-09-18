/**
 * CoreContentPack — the single fact/CTA contract every channel derives from.
 *
 * Channel composers used to each re-derive substance from the raw composer input,
 * so a thin research day produced the same "go check official sources" shell once
 * per channel and burned an LLM call each time. The pack fixes the core once,
 * measures whether it can actually carry a post, and lets the fan-out step decide
 * how many channels are worth generating.
 */

import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_BASELINE_CHANNELS } from "@/lib/marketing/publishable/contracts";
import type {
  PublishableComposerFact,
  PublishableComposerInput,
} from "@/lib/marketing/publishable/inputs";

export const CORE_CONTENT_PACK_CONTRACT = "core-content-pack-v1" as const;

export const CORE_CONTENT_PACK_RELATIVE_PATH = "context/core-content-pack.json" as const;

/** Minimum usable facts before a channel body can say anything concrete. */
export const CORE_FACTS_SUFFICIENT_MIN = 2;

export type CoreFactSufficiency = "sufficient" | "thin" | "insufficient";

export type CoreFact = {
  statement: string;
  confidence: string;
  epistemicType: string;
  evidenceRefIds: string[];
  /** Carries a date, month, duration, visa/entry term, or other operational anchor. */
  operational: boolean;
};

export type CoreContentPack = {
  contract: typeof CORE_CONTENT_PACK_CONTRACT;
  candidateId: string;
  businessDateKst: string;
  sourceRevision: string;
  generatedAt: string;
  topic: string;
  audience: string | null;
  angle: string | null;
  contentPromise: string | null;
  readerGain: string | null;
  specificTakeaways: string[];
  /** Ordered strongest-first; this is the only fact source composers may state. */
  coreFacts: CoreFact[];
  /** Claims that must be hedged rather than asserted. */
  hedgeOnly: string[];
  forbiddenStatements: string[];
  desiredAudienceAction: string | null;
  engagementMechanism: string | null;
  ctaIntent: string | null;
  factSufficiency: {
    verdict: CoreFactSufficiency;
    factCount: number;
    operationalFactCount: number;
    highConfidenceFactCount: number;
    reasons: string[];
  };
};

/**
 * Same operational-anchor heuristic the Marketing Value gate uses to detect a
 * verify-only shell, applied upstream to the facts themselves.
 */
export function factHasOperationalDetail(text: string): boolean {
  return /(TDAC|무비자|비자\s*면제|\d+\s*개월|\d+\s*일|\d+\s*월|섭씨|e-?Arrival|FCDO|\d+\s*[–\-〜~至到]\s*\d+\s*월|(?:우기|건기)[^\n]{0,40}\d+\s*월|\d+\s*월[^\n]{0,40}(?:우기|건기)|\d+\s*(?:시간|분|원|달러|엔|바트))/i.test(
    text,
  );
}

function factRank(fact: CoreFact): number {
  let score = 0;
  if (fact.operational) score += 4;
  if (fact.confidence === "high") score += 3;
  if (fact.epistemicType === "verified_fact") score += 2;
  if (fact.evidenceRefIds.length > 0) score += 1;
  return score;
}

function toCoreFact(fact: PublishableComposerFact): CoreFact {
  return {
    statement: fact.statement,
    confidence: String(fact.confidence),
    epistemicType: String(fact.epistemicType ?? "observed_signal"),
    evidenceRefIds: [...fact.evidenceRefIds],
    operational: factHasOperationalDetail(fact.statement),
  };
}

export function evaluateCoreFactSufficiency(facts: CoreFact[]): CoreContentPack["factSufficiency"] {
  const factCount = facts.length;
  const operationalFactCount = facts.filter((fact) => fact.operational).length;
  const highConfidenceFactCount = facts.filter((fact) => fact.confidence === "high").length;
  const reasons: string[] = [];

  if (factCount === 0) {
    reasons.push("no usable facts survived governance/confidence filtering");
    return {
      verdict: "insufficient",
      factCount,
      operationalFactCount,
      highConfidenceFactCount,
      reasons,
    };
  }

  const hasAnchor = operationalFactCount > 0 || highConfidenceFactCount > 0;
  if (factCount >= CORE_FACTS_SUFFICIENT_MIN && hasAnchor) {
    reasons.push(
      `${factCount} usable facts with ${operationalFactCount} operational / ${highConfidenceFactCount} high-confidence anchors`,
    );
    return {
      verdict: "sufficient",
      factCount,
      operationalFactCount,
      highConfidenceFactCount,
      reasons,
    };
  }

  if (factCount < CORE_FACTS_SUFFICIENT_MIN) {
    reasons.push(`only ${factCount} usable fact(s); need ${CORE_FACTS_SUFFICIENT_MIN}`);
  }
  if (!hasAnchor) {
    reasons.push("no operational or high-confidence fact to anchor a concrete takeaway");
  }
  return { verdict: "thin", factCount, operationalFactCount, highConfidenceFactCount, reasons };
}

export function buildCoreContentPack(input: {
  composerInput: PublishableComposerInput;
  now?: Date;
}): CoreContentPack {
  const composerInput = input.composerInput;
  const proposition = composerInput.contentProposition ?? null;

  const coreFacts = composerInput.usableFacts
    .map(toCoreFact)
    .sort((left, right) => factRank(right) - factRank(left))
    .slice(0, 8);

  const hedgeOnly = [
    ...(proposition?.proofRequirements ?? []),
    ...(composerInput.research?.limitations ?? []),
  ]
    .map((item) => String(item).trim())
    .filter(Boolean);

  return {
    contract: CORE_CONTENT_PACK_CONTRACT,
    candidateId: composerInput.candidateId,
    businessDateKst: composerInput.businessDateKst,
    sourceRevision: composerInput.sourceRevision,
    generatedAt: (input.now ?? new Date()).toISOString(),
    topic: composerInput.topic,
    audience: composerInput.audience,
    angle: proposition?.angle ?? composerInput.research?.selectedAngle ?? null,
    contentPromise: proposition?.contentPromise ?? composerInput.keyMessage ?? null,
    readerGain: proposition?.readerGain ?? null,
    specificTakeaways: (proposition?.specificTakeaways ?? []).slice(0, 5),
    coreFacts,
    hedgeOnly: [...new Set(hedgeOnly)].slice(0, 8),
    forbiddenStatements: [
      ...new Set([...composerInput.unsupportedClaims, ...composerInput.avoidedStatements]),
    ].slice(0, 12),
    desiredAudienceAction: proposition ? String(proposition.desiredAudienceAction) : null,
    engagementMechanism: proposition ? String(proposition.engagementMechanism) : null,
    ctaIntent: resolveCtaIntent(proposition?.desiredAudienceAction ?? null),
    factSufficiency: evaluateCoreFactSufficiency(coreFacts),
  };
}

function resolveCtaIntent(desiredAudienceAction: string | null): string | null {
  if (!desiredAudienceAction) return null;
  const action = desiredAudienceAction.toLowerCase();
  if (action.includes("comment")) return "질문을 던져 댓글을 유도한다";
  if (action.includes("save")) return "저장할 이유가 되는 체크리스트로 닫는다";
  if (action.includes("click") || action.includes("visit") || action.includes("site")) {
    return "사이트에서 다음 단계를 확인하도록 유도한다";
  }
  if (action.includes("share")) return "공유할 만한 한 문장으로 닫는다";
  if (action.includes("inquiry") || action.includes("consult")) return "상담/문의로 연결한다";
  return null;
}

export type CoreGateDecision = {
  allowedChannels: PublishableChannel[];
  blockedChannels: PublishableChannel[];
  sufficiency: CoreFactSufficiency;
  reason: string | null;
};

/**
 * Decide how wide the channel fan-out may go for this core.
 *
 * - sufficient: every requested channel
 * - thin: baseline only (threads + shortform); optional channels would just clone a
 *   weak core across more surfaces at 2 LLM calls each
 * - insufficient: nothing — no fact means every body would be a verify-only shell
 */
export function resolveCoreGateDecision(input: {
  pack: CoreContentPack;
  targetChannels: PublishableChannel[];
}): CoreGateDecision {
  const sufficiency = input.pack.factSufficiency.verdict;
  const requested = input.targetChannels;

  if (sufficiency === "sufficient") {
    return { allowedChannels: [...requested], blockedChannels: [], sufficiency, reason: null };
  }

  if (sufficiency === "insufficient") {
    return {
      allowedChannels: [],
      blockedChannels: [...requested],
      sufficiency,
      reason: `core_facts_insufficient: ${input.pack.factSufficiency.reasons.join("; ")}`,
    };
  }

  const baseline = new Set<string>(PUBLISHABLE_BASELINE_CHANNELS);
  const allowedChannels = requested.filter((channel) => baseline.has(channel));
  const blockedChannels = requested.filter((channel) => !baseline.has(channel));
  return {
    allowedChannels,
    blockedChannels,
    sufficiency,
    reason:
      blockedChannels.length > 0
        ? `core_facts_thin: ${input.pack.factSufficiency.reasons.join("; ")}`
        : null,
  };
}

/** Prompt block: the pack is the only fact source a composer may state. */
export function formatCoreContentPackPromptBlock(pack: CoreContentPack): string {
  const factLines = pack.coreFacts.map(
    (fact, index) =>
      `${index + 1}. ${fact.statement} [${fact.confidence}${fact.operational ? "/operational" : ""}]`,
  );

  const lines = [
    "CORE_CONTENT_PACK (single source of substance for every channel):",
    `topic: ${pack.topic}`,
    pack.angle ? `angle: ${pack.angle}` : "",
    pack.contentPromise ? `promise: ${pack.contentPromise}` : "",
    pack.readerGain ? `readerGain: ${pack.readerGain}` : "",
    pack.specificTakeaways.length ? `takeaways: ${pack.specificTakeaways.join(" | ")}` : "",
    factLines.length ? `CORE_FACTS (state these; do not invent others):\n${factLines.join("\n")}` : "",
    pack.hedgeOnly.length ? `HEDGE_ONLY (never assert): ${pack.hedgeOnly.slice(0, 5).join(" | ")}` : "",
    pack.forbiddenStatements.length
      ? `FORBIDDEN: ${pack.forbiddenStatements.slice(0, 6).join(" | ")}`
      : "",
    pack.ctaIntent ? `CTA_INTENT: ${pack.ctaIntent}` : "",
    pack.desiredAudienceAction ? `desiredAudienceAction: ${pack.desiredAudienceAction}` : "",
    "AUTHORITY: desiredAudienceAction / engagementMechanism / ctaIntent are advisory.",
    "If they conflict with APPROVED_CANONICAL_MARKETING_ASSET or editorialArchetype, the approved asset + archetype win.",
  ];

  if (pack.factSufficiency.verdict === "thin") {
    lines.push(
      `FACTS ARE THIN (${pack.factSufficiency.factCount}). Write a shorter, honest post around the facts you have.`,
      "Do NOT pad to length with '공식 채널에서 확인하세요' items — one hedge sentence at most.",
    );
  }

  return lines.filter(Boolean).join("\n");
}
