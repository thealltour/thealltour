/**
 * Ensure Instagram Visual Role Plan — Carousel + Card Copy → VRA → artifact.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import type {
  InstagramCardCopy,
  InstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import {
  readInstagramCardCopyFromPackage,
  readInstagramCarouselPlanFromPackage,
} from "@/lib/marketing/publishable/instagramEditorial/persist";
import {
  INSTAGRAM_VISUAL_MODE_PREFERENCES,
  INSTAGRAM_VISUAL_PRESENTATION_PREFERENCES,
  INSTAGRAM_VISUAL_ROLE_ARCHITECT_HERMES_PROFILE,
  INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
  INSTAGRAM_VISUAL_ROLES,
  type InstagramVisualRolePlan,
} from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { ensureInstagramVisualRoleArchitectHermesReady } from "@/lib/marketing/publishable/instagramVisualRole/hermesIdentity";
import {
  InstagramVisualRoleMaterializeError,
  materializeInstagramVisualRolePlan,
} from "@/lib/marketing/publishable/instagramVisualRole/materialize";
import {
  persistInstagramVisualRolePlan,
  readInstagramVisualRolePlanFromPackage,
} from "@/lib/marketing/publishable/instagramVisualRole/persist";
import {
  assertFingerprintSourcesInclude,
  getArtifactFailurePolicy,
  getArtifactRepairAttemptBudget,
  requireOnGenerateFail,
} from "@/lib/marketing/agentContracts/lifecycleHelpers";

export type VisualRoleArchitectInvoke = (prompt: {
  hermesProfile: string;
  text: string;
  channel: "instagram";
}) => Promise<string> | string;

/** @deprecated Prefer getArtifactRepairAttemptBudget(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT) */
export function resolveVraRepairAttemptBudget(): number {
  return getArtifactRepairAttemptBudget(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT);
}

function clip(text: string | null | undefined, max: number): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new InstagramVisualRoleMaterializeError("invalid_json", "No JSON object in VRA output");
  }
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    throw new InstagramVisualRoleMaterializeError("invalid_json", "JSON parse failed");
  }
}

/** Repair hint for contract failures — includes code, raw value, allowed enums. */
export function formatVisualRoleRepairHint(error: Error): string {
  const mat =
    error instanceof InstagramVisualRoleMaterializeError ? error : null;
  const code = mat?.code ?? "vra_invoke_failed";
  const details = mat?.details;
  const rawFromDetails =
    details?.invalidRawValue !== undefined
      ? JSON.stringify(details.invalidRawValue)
      : null;
  const rawMatch = error.message.match(/got\s+(\S+|null|undefined)/);
  const invalidRaw = rawFromDetails ?? rawMatch?.[1] ?? "(see message)";
  const cardId = details?.cardId ?? "(unknown)";
  const field = details?.field;
  const modeEnumLine = INSTAGRAM_VISUAL_MODE_PREFERENCES.join(" | ");

  if (code === "invalid_mode_pref") {
    return [
      "Previous output used an invalid visualModePreference.",
      `errorCode: ${code}`,
      `cardId: ${cardId}`,
      `field: visualModePreference`,
      `invalidRawValue: ${invalidRaw}`,
      `allowedVisualModePreference: ${modeEnumLine}`,
      "Choose exactly one allowed value.",
      "Do not invent synonyms (e.g. typography_mood, detail_shot, documentary).",
      "Preserve unrelated card decisions unless necessary.",
      "Return the full valid VRA JSON only.",
    ].join("\n");
  }

  return [
    `Previous output failed.`,
    `errorCode: ${code}`,
    `message: ${error.message}`,
    field ? `field: ${field}` : null,
    details?.cardId ? `cardId: ${details.cardId}` : null,
    `invalidRawValue: ${invalidRaw}`,
    `allowedVisualRole: ${INSTAGRAM_VISUAL_ROLES.join(" | ")}`,
    `allowedPresentationPreference: ${INSTAGRAM_VISUAL_PRESENTATION_PREFERENCES.join(" | ")}`,
    `allowedVisualModePreference: ${modeEnumLine}`,
    `Carousel role and VRA visualRole are different vocabularies.`,
    `Do not copy carousel role vocabulary into visualRole (e.g. never use reframe, context, closing, contrast, cta as visualRole).`,
    `Return valid JSON only. Match carousel cardIds. Use only allowed enum strings.`,
  ]
    .filter((line): line is string => Boolean(line))
    .join(" ");
}

export function buildInstagramVisualRoleArchitectPrompt(input: {
  asset: CanonicalMarketingAsset;
  narrative: EditorialNarrativePlan | null;
  carousel: InstagramCarouselPlan;
  cardCopy: InstagramCardCopy;
  repair?: string | null;
}): string {
  const payload = {
    task: "instagram_visual_role_plan",
    vocabularyContract: {
      note: "Carousel role ≠ VRA visualRole. Never copy carousel role into visualRole. visualModePreference is a separate soft-preference vocabulary — use only allowedVisualModePreference.",
      allowedVisualRole: [...INSTAGRAM_VISUAL_ROLES],
      allowedPresentationPreference: [...INSTAGRAM_VISUAL_PRESENTATION_PREFERENCES],
      allowedVisualModePreference: [...INSTAGRAM_VISUAL_MODE_PREFERENCES],
      forbiddenVisualRoleExamples: ["reframe", "context", "closing", "contrast", "cta", "hook_cover"],
      forbiddenVisualModePreferenceExamples: [
        "typography_mood",
        "typography_focus",
        "typography_card",
        "documentary",
        "architectural_detail",
        "detail_shot",
        "mood_plate",
      ],
    },
    editorialAuthority: {
      factualBoundary: "approved_canonical",
      narrativeSequence: "editorial_narrative_plan",
      carouselStructure: "instagram_carousel_plan",
      cardWording: "instagram_card_copy",
      visualSemantics: "instagram_visual_role_architect",
      masterOrchestration: "shared_visual_planner",
    },
    canonicalAsset: {
      assetId: input.asset.assetId,
      assetVersion: input.asset.version,
      titleKo: input.asset.titleKo,
      openingHookKo: clip(input.asset.openingHookKo, 400),
      bodyKo: clip(input.asset.bodyKo, 2400),
      keyTakeawaysKo: input.asset.keyTakeawaysKo,
      supportedClaimBoundaryKo: input.asset.supportedClaimBoundaryKo,
      limitationsKo: input.asset.limitationsKo,
      forbiddenClaimsKo: input.asset.forbiddenClaimsKo,
      editorialArchetype: input.asset.editorialArchetype ?? null,
    },
    editorialNarrativePlan: input.narrative
      ? {
          narrativePromise: input.narrative.narrativePromise,
          audienceTakeaway: input.narrative.audienceTakeaway,
          beats: input.narrative.beats,
        }
      : null,
    instagramCarouselPlan: {
      cards: input.carousel.cards.map((c) => ({
        cardId: c.cardId,
        role: c.role,
        beatIds: c.beatIds,
        communicationGoal: c.communicationGoal,
        visualPriority: c.visualPriority,
      })),
    },
    instagramCardCopy: {
      cards: input.cardCopy.cards.map((c) => ({
        cardId: c.cardId,
        headline: c.headline,
        body: c.body ?? null,
        kicker: c.kicker ?? null,
        evidenceRefs: c.evidenceRefs ?? [],
      })),
    },
    REPAIR: input.repair ?? null,
  };
  return [
    "Return ONLY valid JSON matching the schema described in your SOUL.",
    "Carousel role and VRA visualRole are different vocabularies — NEVER copy carousel role into visualRole.",
    "=== INPUT_JSON ===",
    JSON.stringify(payload),
  ].join("\n");
}

export type EnsureInstagramVisualRolePlanResult =
  | { ok: true; plan: InstagramVisualRolePlan; status: "generated" | "reused" }
  | {
      ok: false;
      error: { code: string; message: string };
      /** True when carousel+cardCopy absent — SVP may use legacy path. */
      skippedLegacy?: boolean;
    };

/**
 * Production ensure: when editorial carousel+cardCopy exist, VRA is required (fail-closed).
 * When they are absent, returns skippedLegacy so SVP can use publishable visual hints.
 */
export async function ensureInstagramVisualRolePlan(input: {
  packageRoot: string;
  approvedCanonicalAsset: CanonicalMarketingAsset;
  editorialNarrativePlan?: EditorialNarrativePlan | null;
  invoke: VisualRoleArchitectInvoke;
  hermesHome?: string;
  forceRegenerate?: boolean;
  now?: Date;
  carousel?: InstagramCarouselPlan | null;
  cardCopy?: InstagramCardCopy | null;
}): Promise<EnsureInstagramVisualRolePlanResult> {
  const carousel =
    input.carousel ?? readInstagramCarouselPlanFromPackage(input.packageRoot);
  const cardCopy = input.cardCopy ?? readInstagramCardCopyFromPackage(input.packageRoot);

  if (!carousel || !cardCopy) {
    return {
      ok: false,
      skippedLegacy: true,
      error: {
        code: "editorial_artifacts_missing",
        message: "instagram carousel/card-copy missing — legacy SVP visualHints path",
      },
    };
  }

  const carouselFp = buildInstagramCarouselContentFingerprint(carousel);
  const cardCopyFp = buildInstagramCardCopyContentFingerprint(cardCopy);
  // Contract-driven fingerprint + failure policy (Phase 3B) — behavior unchanged.
  assertFingerprintSourcesInclude(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT, [
    "sourceCarouselFingerprint",
    "sourceCardCopyFingerprint",
  ]);
  requireOnGenerateFail(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT, "fail_closed");
  const vraFailurePolicy = getArtifactFailurePolicy(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT);
  if (vraFailurePolicy.materializeInRepairLoop !== true) {
    throw new Error(
      "Artifact contract drift: instagram-visual-role-plan-v1 requires materializeInRepairLoop=true",
    );
  }
  const maxAttempts = getArtifactRepairAttemptBudget(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT);

  const existing =
    !input.forceRegenerate ? readInstagramVisualRolePlanFromPackage(input.packageRoot) : null;

  if (
    existing &&
    existing.sourceCarouselFingerprint === carouselFp &&
    existing.sourceCardCopyFingerprint === cardCopyFp &&
    existing.assetId === input.approvedCanonicalAsset.assetId &&
    existing.assetVersion === input.approvedCanonicalAsset.version
  ) {
    return { ok: true, plan: existing, status: "reused" };
  }

  const nowIso = (input.now ?? new Date()).toISOString();
  try {
    ensureInstagramVisualRoleArchitectHermesReady(input.hermesHome);
    let lastError: Error | null = null;
    let plan: InstagramVisualRolePlan | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const raw = await input.invoke({
          hermesProfile: INSTAGRAM_VISUAL_ROLE_ARCHITECT_HERMES_PROFILE,
          channel: "instagram",
          text: buildInstagramVisualRoleArchitectPrompt({
            asset: input.approvedCanonicalAsset,
            narrative: input.editorialNarrativePlan ?? null,
            carousel,
            cardCopy,
            repair:
              attempt > 1 && lastError ? formatVisualRoleRepairHint(lastError) : null,
          }),
        });
        const llm = extractJsonObject(typeof raw === "string" ? raw : String(raw));
        // materializeInRepairLoop=true — validate inside the retry loop
        plan = materializeInstagramVisualRolePlan({
          assetId: input.approvedCanonicalAsset.assetId,
          assetVersion: input.approvedCanonicalAsset.version,
          sourceCarouselFingerprint: carouselFp,
          sourceCardCopyFingerprint: cardCopyFp,
          carousel,
          modelProfile: INSTAGRAM_VISUAL_ROLE_ARCHITECT_HERMES_PROFILE,
          generatedAt: nowIso,
          llm,
        });
        lastError = null;
        break;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        plan = null;
      }
    }
    if (lastError || !plan) {
      throw lastError ?? new Error("vra_invoke_failed");
    }

    persistInstagramVisualRolePlan({
      packageRoot: input.packageRoot,
      plan,
      createdAt: nowIso,
    });
    return { ok: true, plan, status: "generated" };
  } catch (error) {
    // fail_closed — do not preserve a half-written / invalid plan
    const message = error instanceof Error ? error.message : String(error);
    const code =
      error instanceof InstagramVisualRoleMaterializeError
        ? error.code
        : "instagram_visual_role_failed";
    return { ok: false, error: { code, message } };
  }
}
