/**
 * Build Shared Visual Planner LLM input from Canonical + present channel outputs.
 * Channel Worker visual metadata is nested under visualHints (advisory only).
 * Instagram Visual Role Plan (when present) is stronger Instagram semantic authority
 * than legacy visualHints — SVP still owns final master orchestration.
 * Presence = channel content exists (body or cardPlan) — not Worker visual hints.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import type { InstagramVisualRolePlan } from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import {
  buildSourceChannelSnapshot,
  isChannelPresentForVisualPlanning,
} from "@/lib/marketing/publishable/sharedVisualPlan/sourceChannelSnapshot";

function clip(text: string | null | undefined, max = 1200): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

const VISUAL_HINTS_AUTHORITY_NOTE =
  "visualHints are non-authoritative suggestions from channel adapters. " +
  "You may ignore, merge, split, override, or replace them when designing the " +
  "cross-channel master visual strategy. Channel content (title/body/cards) is primary input.";

const VISUAL_ROLE_PLAN_AUTHORITY_NOTE =
  "instagramVisualRolePlan (when present) is the Instagram per-card visual semantics authority " +
  "(role/density/generationPreference/concreteVisualIntent). It outranks legacy visualHints. " +
  "You still own final master count, grouping, usages, generatedVisualNeeded, visualMode, " +
  "and master visualIntent. Prefer explaining overrides in strategySummary.";

export function buildSharedVisualPlannerInput(input: {
  approvedAsset: CanonicalMarketingAsset;
  bundle: PublishableContentBundle;
  /** Prefer Visual Role Plan over legacy publishable visual.* hints for Instagram. */
  instagramVisualRolePlan?: InstagramVisualRolePlan | null;
}): {
  task: "shared_visual_plan";
  authority: Record<string, string>;
  canonical: Record<string, unknown>;
  channels: Record<string, unknown>;
  instagramVisualRolePlan: Record<string, unknown> | null;
  sourceChannelSnapshot: ReturnType<typeof buildSourceChannelSnapshot>;
  outputSchema: Record<string, unknown>;
} {
  const asset = input.approvedAsset;
  const bundle = input.bundle;
  const channels: Record<string, unknown> = {};
  const visualRolePlan = input.instagramVisualRolePlan ?? null;

  if (isChannelPresentForVisualPlanning(bundle.threads)) {
    const mediaPlan = bundle.threads.mediaPlan ?? null;
    channels.threads = {
      content: {
        title: clip(bundle.threads.title, 200),
        body: clip(bundle.threads.body, 800),
      },
      visualHints: mediaPlan
        ? {
            recommended: Boolean(mediaPlan.recommended),
            imageCount: mediaPlan.imageCount ?? 0,
            requests: (mediaPlan.visuals ?? []).map((v, i) => ({
              slotIndex: i,
              sourceVisualId: v.visualId ?? null,
              role: v.role ?? null,
              visualIntent: v.visualIntent ?? null,
              reusableOnInstagram: Boolean(v.reusableOnInstagram),
            })),
            note: "imageCount/recommended/sourceVisualId/reusableOn* are advisory only",
          }
        : {
            recommended: false,
            imageCount: 0,
            requests: [],
            note: "no worker mediaPlan — Planner may still assign Threads slot 0 when useful",
          },
    };
  }

  if (isChannelPresentForVisualPlanning(bundle.instagram)) {
    const cards = bundle.instagram!.instagramMeta?.cardPlan ?? [];
    channels.instagram = {
      content: {
        caption: clip(bundle.instagram!.body, 800),
        cards: cards.map((c) => ({
          cardId: c.cardId,
          role: c.role,
          headline: clip(c.headline, 200),
          body: clip(c.body, 400),
          cardVisualIntent: c.visualIntent ?? null,
        })),
      },
      visualHints: {
        cards: cards.map((c) => ({
          cardId: c.cardId,
          sourceVisualId: c.visual?.visualId ?? null,
          visualMode: c.visual?.visualMode ?? null,
          generatedVisualNeeded: c.visual?.generatedVisualNeeded ?? null,
          reusableOnThreads: c.visual?.reusableOnThreads ?? null,
          visualIntent: c.visual?.visualIntent ?? c.visualIntent ?? null,
        })),
        note: visualRolePlan
          ? "legacy advisory only — prefer instagramVisualRolePlan for Instagram semantics"
          : "generatedVisualNeeded/visualMode/reusableOn*/sourceVisualId are advisory only — card content alone is enough for planning",
      },
    };
  }

  if (isChannelPresentForVisualPlanning(bundle.naver_blog)) {
    channels.naver_blog = {
      content: {
        title: clip(bundle.naver_blog!.title, 200),
        body: clip(bundle.naver_blog!.body, 600),
        blogMeta: bundle.naver_blog!.blogMeta
          ? {
              searchIntent: bundle.naver_blog!.blogMeta.searchIntent,
              sectionPlan: bundle.naver_blog!.blogMeta.sectionPlan,
            }
          : null,
      },
      visualHints: {
        note: "No formal hero placement contract yet — do not invent Blog usages",
      },
    };
  }

  if (isChannelPresentForVisualPlanning(bundle.naver_band)) {
    channels.naver_band = {
      content: {
        title: clip(bundle.naver_band!.title, 200),
        body: clip(bundle.naver_band!.body, 500),
      },
      visualHints: { note: "No visual attachment contract — omit Band from usages" },
    };
  }

  if (isChannelPresentForVisualPlanning(bundle.kakao_channel)) {
    channels.kakao_channel = {
      content: {
        title: clip(bundle.kakao_channel!.title, 200),
        body: clip(bundle.kakao_channel!.body, 500),
      },
      visualHints: { note: "No visual attachment contract — omit Kakao from usages" },
    };
  }

  if (isChannelPresentForVisualPlanning(bundle.shortform)) {
    channels.shortform = {
      content: {
        body: clip(bundle.shortform.body, 500),
        narrationSegments: (bundle.shortform.narrationSegments ?? []).slice(0, 8).map((s, i) => ({
          i,
          segmentId: s.segmentId,
          text: clip(s.narrationText, 160),
          visualIntent: clip(s.visualIntent, 120),
        })),
      },
      visualHints: { note: "No shared-static attachment contract — omit Shortform from usages" },
    };
  }

  const instagramVisualRolePlanPayload = visualRolePlan
    ? {
        contract: visualRolePlan.contract,
        rhythmSummary: visualRolePlan.rhythmSummary,
        cards: visualRolePlan.cards.map((c) => ({
          cardId: c.cardId,
          visualRole: c.visualRole,
          visualPurpose: c.visualPurpose,
          visualPriority: c.visualPriority,
          visualDensity: c.visualDensity,
          generationPreference: c.generationPreference,
          visualModePreference: c.visualModePreference,
          reusePreference: c.reusePreference,
          presentationPreference: c.presentationPreference,
          concreteVisualIntent: clip(c.concreteVisualIntent, 400),
          evidenceRefs: c.evidenceRefs,
        })),
        note: VISUAL_ROLE_PLAN_AUTHORITY_NOTE,
      }
    : null;

  return {
    task: "shared_visual_plan",
    authority: {
      finalVisualAuthority: "shared_visual_planner",
      instagramVisualSemantics: visualRolePlan
        ? "instagram_visual_role_plan"
        : "legacy_visual_hints_or_content",
      channelVisualMetadata: "advisory_hint_only",
      evidenceAuthority: "approved_canonical",
      visualHintsNote: VISUAL_HINTS_AUTHORITY_NOTE,
      visualRolePlanNote: VISUAL_ROLE_PLAN_AUTHORITY_NOTE,
    },
    canonical: {
      titleKo: asset.titleKo ?? null,
      openingHookKo: asset.openingHookKo ?? null,
      bodyKo: clip(asset.bodyKo, 1600),
      keyTakeawaysKo: asset.keyTakeawaysKo ?? null,
      decisionGuidanceKo: asset.decisionGuidanceKo ?? null,
      editorialArchetype: asset.editorialArchetype ?? null,
      supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo ?? null,
      limitationsKo: asset.limitationsKo ?? null,
      forbiddenClaimsKo: asset.forbiddenClaimsKo ?? null,
      supportVerdict: asset.storySupportVerdict ?? null,
    },
    channels,
    instagramVisualRolePlan: instagramVisualRolePlanPayload,
    sourceChannelSnapshot: buildSourceChannelSnapshot(bundle),
    outputSchema: {
      strategySummary:
        "string — why this master set; shared/split cards; Threads reuse; note overrides",
      decisionTrace: {
        overrides: [
          {
            cardId: "card_2",
            field: "generationPreference | visualModePreference | reusePreference | grouping | other",
            requested: "VRA preference value",
            final: "SVP decision value",
            reason: "why override — required for material VRA divergences",
          },
        ],
      },
      visuals: [
        {
          role: "string e.g. context_cover | subject_detail | architecture_detail",
          visualMode:
            "editorial_photo | object_or_detail | icon_infographic | contrast_diagram | map_context | fact_card | evidence_boundary | minimal_closing",
          generatedVisualNeeded: "boolean — YOUR decision (may override VRA generationPreference with trace)",
          visualIntent:
            "concrete master brief: subject + context + purpose + composition + evidence limits",
          usages: [
            { channel: "threads", slotIndex: 0 },
            { channel: "instagram", cardId: "card_1" },
          ],
        },
      ],
    },
  };
}

export function formatSharedVisualPlannerPrompt(
  plannerInput: ReturnType<typeof buildSharedVisualPlannerInput>,
  options?: { repair?: string | null },
): string {
  const hasVra = Boolean(plannerInput.instagramVisualRolePlan);
  const lines = [
    "TASK: Orchestrate the smallest *sufficient* Shared Visual Plan (SVP v2).",
    "You own master count, grouping/reuse, final generatedVisualNeeded, visualMode, usages.",
    "You do NOT redesign Instagram visual meanings — that is Visual Role Architect.",
    "",
    "AUTHORITY:",
    "- Instagram semantics precedence: instagramVisualRolePlan > content > legacy visualHints.",
    "- When VRA is present, cover EVERY VRA cardId with exactly one Instagram usage.",
    "- Multiple Instagram cards MAY share one master when subjects/roles align.",
    "- Threads slot 0 ↔ Instagram hero_cover is a reuse candidate — not automatic.",
    "- generationPreference required → true unless decisionTrace override.",
    "- exclusive_preferred merge → decisionTrace override required.",
    "- Material visualModePreference change → decisionTrace override required.",
    "- Example (allowed only WITH trace — not a directive to change mode): VRA architecture_detail + visualModePreference=editorial_photo may become SVP visualMode=object_or_detail only when decisionTrace.overrides includes { field: visualModePreference, cardId, requested: editorial_photo, final: object_or_detail, reason }.",
    "- generatedVisualNeeded=false does NOT mean no visual treatment.",
    "- all-card visual treatment ≠ all-card independent generation.",
    "- Do NOT minimize master count at the expense of meaning fidelity / rhythm.",
    "- Channel visualHints are ADVISORY ONLY.",
    "- You MUST NOT invent nonexistent channel slots/cardIds or Blog/Band/Kakao/Shortform usages.",
    "- Do NOT treat Worker sourceVisualId as master identity.",
    "- Prefer explaining decisions in strategySummary; put material overrides in decisionTrace.",
    "",
    "Return ONLY JSON:",
    "{ strategySummary, decisionTrace?: { overrides: [{ cardId?, field, requested, final, reason }] }, visuals: [...] }",
    "field enum: generationPreference | visualModePreference | reusePreference | grouping | other",
    "Supported usages ONLY: threads.slotIndex (0 when Threads exists) or instagram.cardId from content/VRA.",
    "visualIntent must be concrete master-level brief — reject vague intents.",
    hasVra
      ? "VRA PRESENT: full card coverage + structured overrides for material divergences are mandatory."
      : "VRA ABSENT: legacy visualHints path — still prefer smallest sufficient shared set.",
    "",
    "INPUT_JSON:",
    JSON.stringify(plannerInput, null, 2),
  ];
  const repair = options?.repair?.trim();
  if (repair) {
    lines.push("", "## CONTRACT REPAIR", repair);
  }
  return lines.join("\n");
}
