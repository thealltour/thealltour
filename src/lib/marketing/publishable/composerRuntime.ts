/**
 * MQ-4 — shared bounded LLM compose helpers for channel-native publishable composers.
 * Max 2 invocations per channel (initial + one repair). No web search.
 */

import type {
  ContentProposition,
} from "@/lib/marketing/content/proposition/contracts";
import type {
  PublishableChannelContent,
  PublishableContentStatus,
  PublishableGenerationFailureCategory,
  PublishableValidationResult,
} from "@/lib/marketing/publishable/contracts";
import { formatCoreContentPackPromptBlock } from "@/lib/marketing/publishable/core/coreContentPack";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";
import {
  APPROVED_ASSET_COMPOSER_RULES,
  buildApprovedAssetPromptSlice,
} from "@/lib/marketing/publishable/approvedAsset";
import type { ChannelComposerPromptParts } from "@/lib/marketing/publishable/channelEditorIdentity";
import {
  assembleChannelComposerPromptParts,
  formatStoryLockForPrompt,
} from "@/lib/marketing/publishable/channelEditorIdentity";
import { channelTreatAsDiscoveryLike, channelTreatAsDecisionPractical } from "@/lib/marketing/publishable/editorialArchetype";

export const PUBLISHABLE_MAX_INVOCATIONS_PER_CHANNEL = 2 as const;

/**
 * Every channel derives from the same core. Emitting this block first keeps the
 * channels from independently inventing (or omitting) substance.
 */
export function formatCorePackPromptBlock(input: PublishableComposerInput): string {
  return input.corePack ? formatCoreContentPackPromptBlock(input.corePack) : "";
}

/** Human-review Marketing Value → Channel Editor quality repair block (archetype-aware). */
export function formatQualityRevisionPromptBlock(
  quality: PublishableComposerInput["qualityRevision"],
  editorialArchetype?: string | null,
): string {
  if (!quality || (!quality.hints?.length && !quality.priorBody && !quality.reasons?.length)) {
    return "";
  }
  const discovery = channelTreatAsDiscoveryLike(editorialArchetype);
  const decision = channelTreatAsDecisionPractical(editorialArchetype);
  const prior = quality.priorBody ?? "";
  const priorLooksDiscovery =
    !decision &&
    /(하지만|그런데|알고\s*보면|익숙한|맥락|시선|대비|달라집니다|보여줍|흥미)/.test(prior);
  const suppressChecklistHints = discovery || priorLooksDiscovery;
  const repairGuidance = discovery
    ? [
        "Rewrite Body for discovery value: stronger hook, more concrete insight/detail, clearer contrast or recognition, preserve reader payoff.",
        "Do NOT inject a checklist, compare/verify frame, or forced A-vs-B preference question.",
        "Natural observation / relevant experience / no CTA are valid closes for discovery.",
      ]
    : decision
      ? [
          "Rewrite Body so it is worth saving — concrete checklist, criteria, or numbered takeaways grounded in usableFacts / approved asset.",
          "CTA may use compare / verify / consult when grounded in the approved asset.",
        ]
      : [
          "Rewrite Body for clearer specificity, stronger hook, and reader payoff grounded in the approved asset.",
          "Do not invent a new Story. Prefer concrete detail over generic advice. Do not force a checklist unless the Story is practical/decision-like.",
        ];
  const filteredHints = (quality.hints ?? []).filter((hint) => {
    if (!suppressChecklistHints) return true;
    return !/checklist|save-worthy checklist|numbered takeaway/i.test(hint);
  });
  return [
    "QUALITY_REVISION (from Marketing Value / human review):",
    ...repairGuidance,
    "Do not replace facts with '공식 채널에서 확인하세요' shells. Put known supported points in the body; hedge only where facts are missing.",
    "desiredAudienceAction / engagementMechanism are advisory — approved Canonical + editorialArchetype win on conflict.",
    quality.reasons?.length ? `Issues: ${quality.reasons.slice(0, 4).join(" | ")}` : "",
    filteredHints.length ? `Hints: ${filteredHints.slice(0, 6).join(" | ")}` : "",
    quality.priorBody ? `PRIOR_BODY_TO_IMPROVE:\n${quality.priorBody.slice(0, 1200)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export type ComposeAttemptOutcome =
  | {
      ok: true;
      raw: string;
      attempt: number;
    }
  | {
      ok: false;
      attempt: number;
      category: PublishableGenerationFailureCategory;
      message: string;
      raw?: string;
    };

export function classifyPublishableLlmFailure(error: unknown): {
  category: PublishableGenerationFailureCategory;
  message: string;
} {
  const message = error instanceof Error ? error.message : String(error ?? "unknown");
  const lower = message.toLowerCase();
  if (/timeout|etimedout|aborted|deadline/i.test(lower)) {
    return { category: "timeout", message: message.slice(0, 240) };
  }
  if (/unauthorized|auth|api[_ -]?key|forbidden|401|403/i.test(lower)) {
    return { category: "auth", message: message.slice(0, 240) };
  }
  if (/no (llm )?provider|no models provided|returned no usable model output|channel_editor_hermes_config_missing/i.test(lower)) {
    return { category: "auth", message: message.slice(0, 240) };
  }
  if (/rate.?limit|429|too many requests/i.test(lower)) {
    return { category: "rate_limited", message: message.slice(0, 240) };
  }
  if (/5\d\d|internal server|bad gateway|service unavailable/i.test(lower)) {
    return { category: "upstream_5xx", message: message.slice(0, 240) };
  }
  if (/econnrefused|enotfound|network|fetch failed|socket/i.test(lower)) {
    return { category: "network", message: message.slice(0, 240) };
  }
  if (/json|parse|syntax/i.test(lower)) {
    return { category: "invalid_json", message: message.slice(0, 240) };
  }
  return { category: "unknown", message: message.slice(0, 240) };
}

export function buildPropositionPromptSlice(
  proposition: ContentProposition | null | undefined,
  mode: "approved_asset_adapter" | "legacy_proposition_driven" = "legacy_proposition_driven",
): Record<string, unknown> | null {
  if (!proposition) return null;
  if (mode === "approved_asset_adapter") {
    // Consistency lock only — no angle/whyNow/keyMessage creative drivers.
    return {
      role: "CONSISTENCY_LOCK",
      contract: proposition.contract,
      primaryAudience: proposition.primaryAudience,
      audienceProblem: proposition.audienceProblem,
      audienceTension: proposition.audienceTension,
      contentPromise: proposition.contentPromise,
      readerGain: proposition.readerGain,
      specificTakeaways: (proposition.specificTakeaways ?? []).slice(0, 5),
      desiredAudienceAction: proposition.desiredAudienceAction,
      limitations: (proposition.limitations ?? []).slice(0, 8),
    };
  }
  return {
    contract: proposition.contract,
    primaryAudience: proposition.primaryAudience,
    audienceProblem: proposition.audienceProblem,
    audienceTension: proposition.audienceTension,
    whyNow: proposition.whyNow,
    contentPromise: proposition.contentPromise,
    readerGain: proposition.readerGain,
    specificTakeaways: (proposition.specificTakeaways ?? []).slice(0, 5),
    proofRequirements: (proposition.proofRequirements ?? []).slice(0, 8),
    contentGapUsed: proposition.contentGapUsed,
    engagementMechanism: proposition.engagementMechanism,
    desiredAudienceAction: proposition.desiredAudienceAction,
    angle: proposition.angle,
    keyMessage: proposition.keyMessage,
    commercialIntent: proposition.commercialIntent,
    propositionStrength: proposition.propositionStrength,
    limitations: (proposition.limitations ?? []).slice(0, 8),
    channelIntentHints: proposition.channelIntentHints ?? null,
  };
}

export const PROPOSITION_COMPOSER_RULES = [
  "CONTENT_PROPOSITION is the value contract — embody it in the copy; do not treat it as metadata.",
  "CORE_CONTENT_PACK.CORE_FACTS is the ONLY substance you may state as fact. Every channel derives from the same core; do not add facts this channel alone knows.",
  "Deliver contentPromise + readerGain. Include at least one specificTakeaway concept when present.",
  "CORE_FACTS are the payload: write the concrete visa/season/procedure facts they contain into the body.",
  "Verify language is only a hedge for claims NOT covered by CORE_FACTS — never fill the checklist with 'go check official sources' alone.",
  "Respect proofRequirements: do not invent operational facts (direct flight status, live prices, seats, boarding rules) beyond usableFacts.",
  "Align CTA/close with desiredAudienceAction and engagementMechanism (comment → experience question; click/site → soft next step; save → worth-saving checklist).",
  "Forbidden as core substance: '관측됨', '참고해 두세요', 'Meta hook seed', research narration.",
  "Do NOT call web search or invent sources.",
].join("\n");

export const PROPOSITION_CONSISTENCY_LOCK_RULES = [
  "CONTENT_PROPOSITION is a CONSISTENCY_LOCK only — not editorial authority.",
  "It must NOT override APPROVED_CANONICAL_MARKETING_ASSET.",
  "It must NOT create a new angle, replace decisionAtStake, create new CTA intent, revive whyNow, or revive Agenda framing.",
  "If a proposition field is not represented in the approved asset, do not force it into final copy.",
  "Approved asset wins over any conflicting proposition field (including desiredAudienceAction).",
  "Do NOT call web search or invent sources.",
].join("\n");

export const CHANNEL_INPUT_AUTHORITY_VERSION = "channel-input-authority-v2" as const;

export function channelComposerRules(input: PublishableComposerInput): string {
  if (input.approvedCanonicalAsset || input.compositionMode === "approved_asset_adapter") {
    return [
      "=== APPROVED_ASSET_AUTHORITY_RULES ===",
      APPROVED_ASSET_COMPOSER_RULES,
      "=== EDITORIAL_NARRATIVE_AUTHORITY ===",
      "When editorialNarrativePlan is provided, it owns story progression (promise → beats → takeaway).",
      "Do not invent a new premise or redesign the narrative arc; you may compress or select beats for this channel.",
      "ContentPlan / media-brief creative fields (hook, outline, keyMessage, recommendedFormats) are NOT authority for channel generation.",
      "=== CONSISTENCY_LOCK_RULES ===",
      PROPOSITION_CONSISTENCY_LOCK_RULES,
      "=== CORE_PACK_AUTHORITY ===",
      "desiredAudienceAction / engagementMechanism / ctaIntent from CoreContentPack are advisory consistency context.",
      "If they conflict with APPROVED_CANONICAL_MARKETING_ASSET or editorialArchetype, the approved asset + archetype win.",
      "Example: discovery + save_worthy_checklist must NOT force a checklist; discovery + comment must NOT force A-vs-B preference questions.",
      "=== SAFETY_BOUNDARY ===",
      "Respect supportedClaimBoundaryKo, forbiddenClaimsKo, and limitationsKo from the approved asset.",
      "Do NOT invent booking-timing, future-price, urgency, or supply-competition angles unless present in the approved asset.",
    ].join("\n");
  }
  return PROPOSITION_COMPOSER_RULES;
}

export function buildChannelComposerInputJson(input: PublishableComposerInput): Record<string, unknown> {
  const mode =
    input.compositionMode ??
    (input.approvedCanonicalAsset ? "approved_asset_adapter" : "legacy_proposition_driven");

  if (mode === "approved_asset_adapter") {
    const narrative = input.editorialNarrativePlan ?? null;
    return {
      compositionMode: "approved_asset_adapter",
      inputAuthorityVersion: CHANNEL_INPUT_AUTHORITY_VERSION,
      editorialArchetype: input.storyLock?.editorialArchetype ?? null,
      channelFormatContext: {
        commercialIntent: input.commercialIntent,
        governanceDecision: input.governanceDecision,
      },
      topic: input.approvedCanonicalAsset?.titleKo ?? input.topic,
      audience: input.audience,
      hookHint: input.approvedCanonicalAsset?.openingHookKo ?? input.hookHint,
      keyMessage: input.approvedCanonicalAsset?.titleKo ?? input.keyMessage,
      approvedCanonicalAsset: buildApprovedAssetPromptSlice(input.approvedCanonicalAsset),
      storyLock: input.storyLock ?? null,
      editorialNarrativePlan: narrative
        ? {
            narrativePromise: narrative.narrativePromise,
            audienceTakeaway: narrative.audienceTakeaway,
            beats: narrative.beats,
          }
        : null,
      editorialAuthority: {
        factualBoundary: "approved_canonical",
        narrativeSequence: narrative ? "editorial_narrative_plan" : null,
        channelStructure: "channel_worker",
        wording: "channel_worker",
      },
      contentProposition: buildPropositionPromptSlice(input.contentProposition, mode),
      safetyBoundary: {
        avoidedStatements: input.avoidedStatements,
        unsupportedClaims: input.unsupportedClaims,
        evidenceRefIds: input.evidenceRefIds,
        researchVerdict: input.research?.researchVerdict ?? null,
        researchLimitations: input.research?.limitations ?? [],
      },
      provenance: {
        sourceAssetId: input.approvedCanonicalAsset?.assetId ?? null,
        sourceAssetVersion:
          input.approvedCanonicalAsset?.approvedVersion ??
          input.approvedCanonicalAsset?.version ??
          null,
        sourceRevision: input.sourceRevision,
        storyPointId: input.storyLock?.storyPointId ?? input.approvedCanonicalAsset?.storyPointId ?? null,
        storyPointHash:
          input.storyLock?.storyPointHash ?? input.approvedCanonicalAsset?.storyPointHash ?? null,
      },
      // Explicitly omit Agenda/ACRB creative fields (selectedAngle, searchIntent, usableFacts, destinations).
    };
  }

  return {
    compositionMode: "legacy_proposition_driven",
    inputAuthorityVersion: CHANNEL_INPUT_AUTHORITY_VERSION,
    editorialArchetype: input.storyLock?.editorialArchetype ?? null,
    topic: input.topic,
    audience: input.audience,
    commercialIntent: input.commercialIntent,
    hookHint: input.hookHint,
    keyMessage: input.keyMessage,
    destinations: input.destinations,
    approvedCanonicalAsset: buildApprovedAssetPromptSlice(input.approvedCanonicalAsset),
    contentProposition: buildPropositionPromptSlice(input.contentProposition, mode),
    usableFacts: input.usableFacts.map((f) => ({
      statement: f.statement,
      confidence: f.confidence,
      type: f.epistemicType ?? null,
    })),
    avoidedStatements: input.avoidedStatements,
    unsupportedClaims: input.unsupportedClaims,
    governanceDecision: input.governanceDecision,
    research: {
      selectedAngle: input.research?.selectedAngle,
      selectedAngleTension: input.research?.selectedAngleTension,
      contentGaps: input.research?.contentGaps,
      limitations: input.research?.limitations,
    },
  };
}

export function buildChannelComposerPromptParts(input: {
  channel: PublishableChannel;
  writingContract: string;
  composerInput: PublishableComposerInput;
  repairHint?: string | null;
}): ChannelComposerPromptParts {
  const inputJson = buildChannelComposerInputJson(input.composerInput);
  return assembleChannelComposerPromptParts({
    channel: input.channel,
    writingContract: input.writingContract,
    channelRules: channelComposerRules(input.composerInput),
    repairHint: input.repairHint,
    inputJson,
    storyLockText: formatStoryLockForPrompt(
      inputJson.storyLock as Record<string, unknown> | null | undefined,
    ),
  });
}

export function propositionBlocksPolishedGeneration(
  proposition: ContentProposition | null | undefined,
): boolean {
  return proposition?.propositionStrength === "insufficient";
}

export function buildPropositionProvenance(
  input: PublishableComposerInput,
): PublishableChannelContent["provenance"]["proposition"] {
  const prop = input.contentProposition;
  if (!prop) return null;
  return {
    contract: prop.contract,
    selectedAngleRef: input.research?.selectedAngleId ?? null,
    contentPromise: (prop.contentPromise ?? "").slice(0, 240),
    readerGain: (prop.readerGain ?? "").slice(0, 240),
    takeawayBasis: (prop.specificTakeaways ?? []).slice(0, 5),
    desiredAudienceAction: String(prop.desiredAudienceAction),
    engagementMechanism: String(prop.engagementMechanism),
    propositionStrength: prop.propositionStrength,
  };
}

/**
 * Lightweight check that body reflects at least one takeaway concept (non-brittle).
 */
export function bodyReflectsPropositionTakeaway(
  body: string,
  proposition: ContentProposition | null | undefined,
): boolean {
  if (!proposition?.specificTakeaways?.length) return true;
  const hay = body.replace(/\s+/g, "").toLowerCase();
  for (const takeaway of proposition.specificTakeaways) {
    const tokens = takeaway
      .replace(/[·\/|,]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)
      .slice(0, 4);
    if (tokens.length === 0) continue;
    const hits = tokens.filter((t) => hay.includes(t.toLowerCase())).length;
    if (hits >= Math.min(2, tokens.length)) return true;
  }
  // Soft: if promise keywords appear, accept
  const promiseTokens = proposition.contentPromise
    .split(/[\s·\/,]+/)
    .filter((t) => t.length >= 3)
    .slice(0, 6);
  const promiseHits = promiseTokens.filter((t) => hay.includes(t.toLowerCase())).length;
  return promiseHits >= 2;
}

/**
 * Shortform hook/payoff: if hook promises N things / one rule / checklist, body should deliver.
 */
export function checkShortformHookPayoff(input: {
  segments: Array<{ purpose: string; narrationText: string }>;
  body: string;
}): { ok: boolean; reason?: string } {
  const hook = input.segments.find((s) => /hook/i.test(s.purpose))?.narrationText ?? "";
  const rest = input.segments
    .filter((s) => !/hook/i.test(s.purpose))
    .map((s) => s.narrationText)
    .join("\n");
  const full = `${input.body}\n${rest}`;
  if (!hook.trim()) return { ok: true };

  const nMatch = hook.match(/(\d+)\s*가지|체크\s*(\d+)|(\d+)\s*개/);
  if (nMatch) {
    const n = Number(nMatch[1] || nMatch[2] || nMatch[3]);
    if (Number.isFinite(n) && n >= 2 && n <= 7) {
      // crude: look for numbered markers or enough distinct sentence breaks
      const numbered = (full.match(/(?:^|\n)\s*(?:\d+[.)]|[①-⑦]|먼저|둘째|셋째)/gm) ?? []).length;
      if (numbered < Math.min(n, 2) && full.replace(/\s+/g, "").length < 40) {
        return { ok: false, reason: "hook_promises_n_items_but_body_thin" };
      }
    }
  }

  if (/이\s*한\s*가지만\s*기억|하나만\s*기억|한\s*가지\s*만/.test(hook)) {
    const bodySansHook = full.replace(hook, "").trim();
    if (bodySansHook.length < 12) {
      return { ok: false, reason: "hook_promises_one_thing_unpaid" };
    }
  }

  return { ok: true };
}

export async function invokeWithBoundedRepair(input: {
  invoke: PublishableLlmInvoke;
  channel: PublishableChannel;
  buildPrompt: (repairHint?: string | null) => ChannelComposerPromptParts | string;
  parseAndValidate: (raw: string) => {
    ok: boolean;
    category?: PublishableGenerationFailureCategory;
    message?: string;
  };
}): Promise<{
  success: boolean;
  raw: string | null;
  attemptCount: number;
  failureCategory?: PublishableGenerationFailureCategory;
  failureMessage?: string;
}> {
  let attemptCount = 0;
  let lastCategory: PublishableGenerationFailureCategory = "unknown";
  let lastMessage = "compose_failed";
  let lastRaw: string | null = null;

  for (let attempt = 1; attempt <= PUBLISHABLE_MAX_INVOCATIONS_PER_CHANNEL; attempt++) {
    attemptCount = attempt;
    const repairHint =
      attempt === 2
        ? `REPAIR: previous output failed (${lastCategory}: ${lastMessage}). Return valid JSON only. Remove internal headings, UUIDs, unsupported prices/urgency, and inventing facts. Do NOT invent a new Story or angle.`
        : null;
    try {
      const built = input.buildPrompt(repairHint);
      const prompt =
        typeof built === "string"
          ? { channel: input.channel, text: built, system: "", user: built }
          : built;
      const raw = await input.invoke(prompt);
      lastRaw = typeof raw === "string" ? raw : String(raw);
      const checked = input.parseAndValidate(lastRaw);
      if (checked.ok) {
        return { success: true, raw: lastRaw, attemptCount };
      }
      lastCategory = checked.category ?? "schema_validation";
      lastMessage = checked.message ?? "validation_failed";
      // Do not repair auth-like issues (shouldn't appear here)
      if (lastCategory === "topic_identity_conflict" || lastCategory === "evidence_violation") {
        break;
      }
    } catch (error) {
      const classified = classifyPublishableLlmFailure(error);
      lastCategory = classified.category;
      lastMessage = classified.message;
      if (
        lastCategory === "auth" ||
        lastCategory === "timeout" ||
        lastCategory === "rate_limited"
      ) {
        break;
      }
    }
  }

  return {
    success: false,
    raw: lastRaw,
    attemptCount,
    failureCategory: lastCategory,
    failureMessage: lastMessage,
  };
}

export function resolveSuccessStatus(
  validation: PublishableValidationResult,
): Extract<PublishableContentStatus, "generated" | "validation_failed"> {
  return validation.ok ? "generated" : "validation_failed";
}

export function resolveFailureStatus(input: {
  llmAttempted: boolean;
  category?: PublishableGenerationFailureCategory;
}): Extract<PublishableContentStatus, "generation_failed" | "validation_failed" | "fallback_generated"> {
  if (!input.llmAttempted) return "fallback_generated";
  if (
    input.category === "schema_validation" ||
    input.category === "publishability_validation" ||
    input.category === "invalid_json" ||
    input.category === "topic_identity_conflict" ||
    input.category === "evidence_violation"
  ) {
    return "validation_failed";
  }
  return "generation_failed";
}
