/**
 * SVP Cross-Card Visual Differentiation — contract regressions (SOUL/prompt/Astra).
 *
 * No deterministic keyword-overlap reject in materialize — differentiation is Hermes judgment.
 * Tests assert contract language + that GOOD differentiated intents survive Astra enrichment.
 */
import { describe, expect, it } from "vitest";

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableChannelContent,
  type PublishableContentBundle,
  type PublishableInstagramCardPlan,
} from "@/lib/marketing/publishable/contracts";
import { SHARED_VISUAL_PLAN_CONTRACT } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  ASTRA_HANDOFF_WRITER_SOUL,
  SHARED_VISUAL_PLANNER_SOUL,
} from "@/lib/marketing/publishable/visualOrchestration/hermesIdentity";
import {
  formatAstraHandoffWriterPrompt,
  materializeManualAstraHandoffFromLlm,
} from "@/lib/marketing/publishable/visualOrchestration/generateManualAstraHandoff";
import {
  buildSharedVisualPlannerInput,
  formatSharedVisualPlannerPrompt,
} from "@/lib/marketing/publishable/visualOrchestration/plannerInput";
import { materializeSharedVisualPlanFromLlm } from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import {
  INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
  type InstagramVisualRolePlan,
} from "@/lib/marketing/publishable/instagramVisualRole/contracts";

const DAO_BRIDGE_GOOD =
  "Misty northern mountain ridges as a wide geographic transition — layered ranges signalling the shift inland; no village naming.";

const DAO_CULTURE_GOOD =
  "Highland lived environment: dwellings, footpaths, cultivated plots and settlement structure communicating habitation without identifiable faces, costumes, or staged ethnicity.";

const DAO_BRIDGE_BAD = "misty northern mountains";
const DAO_CULTURE_BAD = "terraced northern mountains";

const approvedAsset = {
  assetId: "cma_dao",
  version: 1,
  approvedVersion: 1,
  titleKo: "북부 국경 Dao족",
  bodyKo: "랑선 일대",
  forbiddenClaimsKo: ["특정 마을 단정"],
  limitationsKo: ["현장 미확인"],
  supportedClaimBoundaryKo: "공식 소개",
  storySupportVerdict: "supported",
} as unknown as CanonicalMarketingAsset;

function channel(
  overrides: Partial<PublishableChannelContent> & { channel: PublishableChannelContent["channel"] },
): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    format: "threads_text",
    title: null,
    body: "본문",
    status: "generated",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceCandidateId: "cmc_dao_diff",
    sourceRevision: "rev1",
    provenance: {
      composer: "llm",
      evidenceRefIds: [],
      commercialIntent: null,
      generationMode: "llm",
    },
    validation: { ok: true, issues: [] },
    publishableSuccess: true,
    mediaPlan: null,
    ...overrides,
  };
}

function card(
  partial: Partial<PublishableInstagramCardPlan> & { cardId: string },
): PublishableInstagramCardPlan {
  return {
    role: "cover",
    headline: "H",
    body: "B",
    visualIntent: "legacy",
    ...partial,
  };
}

function minimalBundle(): PublishableContentBundle {
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "cmc_dao_diff",
    businessDateKst: "2026-09-18",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceRevision: "rev",
    targetChannels: ["threads", "instagram"],
    sourceAssetId: "cma_dao",
    sourceAssetVersion: 1,
    threads: channel({
      channel: "threads",
      body: "북부 국경",
      mediaPlan: {
        recommended: true,
        assetFamily: "social_static",
        imageCount: 1,
        visuals: [],
      },
    }),
    shortform: channel({ channel: "shortform", format: "short_video_narration", body: "n" }),
    instagram: channel({
      channel: "instagram",
      format: "instagram_caption",
      body: "캡션",
      instagramMeta: {
        hook: "북부",
        hashtags: [],
        slideHeadlines: [],
        cta: null,
        altText: null,
        cardPlan: ["card-01", "card-02", "card-03", "card-04", "card-05"].map((cardId, i) =>
          card({ cardId, headline: `H${i}`, body: `B${i}` }),
        ),
      },
    }),
  };
}

function daoDifferentiationVra(): InstagramVisualRolePlan {
  return {
    contract: INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
    assetId: "cma_dao",
    assetVersion: 1,
    sourceCarouselFingerprint: "fp_c",
    sourceCardCopyFingerprint: "fp_cc",
    rhythmSummary: "hero → bridge → cultural_context → detail → closing",
    cards: [
      {
        cardId: "card-01",
        visualRole: "hero_cover",
        visualPurpose: "establishing",
        visualPriority: "hero",
        visualDensity: "dominant",
        visualModePreference: "editorial_photo",
        generationPreference: "required",
        presentationPreference: "full_bleed",
        reusePreference: "exclusive_preferred",
        concreteVisualIntent: "northern highland establishing landscape",
        evidenceRefs: [],
      },
      {
        cardId: "card-02",
        visualRole: "bridge_statement",
        visualPurpose: "bridge",
        visualPriority: "strong",
        visualDensity: "subtle",
        visualModePreference: "editorial_photo",
        generationPreference: "preferred",
        presentationPreference: "image_backed_statement",
        reusePreference: "reusable",
        concreteVisualIntent: "misty northern mountain landscape / layered ridges / geographical shift",
        evidenceRefs: [],
      },
      {
        cardId: "card-03",
        visualRole: "cultural_context",
        visualPurpose: "context",
        visualPriority: "useful",
        visualDensity: "strong",
        // VRA may prefer atmosphere; SVP may still choose editorial_photo with trace.
        visualModePreference: "atmosphere",
        generationPreference: "preferred",
        presentationPreference: "photo_top",
        reusePreference: "reusable",
        concreteVisualIntent: "terraced mountain slopes / highland terrain",
        evidenceRefs: [],
      },
      {
        cardId: "card-04",
        visualRole: "architecture_detail",
        visualPurpose: "detail",
        visualPriority: "strong",
        visualDensity: "strong",
        visualModePreference: "object_or_detail",
        generationPreference: "preferred",
        presentationPreference: "detail_focus",
        reusePreference: "reusable",
        concreteVisualIntent: "rammed-earth wall material detail",
        evidenceRefs: ["ev"],
      },
      {
        cardId: "card-05",
        visualRole: "closing_mood",
        visualPurpose: "close",
        visualPriority: "optional",
        visualDensity: "balanced",
        visualModePreference: "atmosphere",
        generationPreference: "optional",
        presentationPreference: "background_mood",
        reusePreference: "derivative_ok",
        concreteVisualIntent: "quiet highland closing mood",
        evidenceRefs: [],
      },
    ],
    provenance: {
      sourceAssetId: "cma_dao",
      sourceVersion: 1,
      modelProfile: "instagram-visual-role-architect",
      generatedAt: "2026-09-18T00:00:00.000Z",
      sourceCarouselFingerprint: "fp_c",
      sourceCardCopyFingerprint: "fp_cc",
    },
  };
}

function goodDifferentiatedLlm() {
  return {
    strategySummary:
      "4 masters: hero+Threads share; bridge = wide geographic transition ridges; " +
      "cultural_context = distinct lived highland environment (dwellings/paths/plots) not synonym scenery; " +
      "architecture detail dedicated; closing mood optional. Mode override on card-03 atmosphere→editorial_photo traced.",
    decisionTrace: {
      overrides: [
        {
          cardId: "card-03",
          field: "visualModePreference",
          requested: "atmosphere",
          final: "editorial_photo",
          reason: "Lived-environment cultural context reads clearer as editorial photo than atmosphere wash",
        },
      ],
    },
    visuals: [
      {
        role: "context_cover",
        visualMode: "editorial_photo",
        generatedVisualNeeded: true,
        visualIntent:
          "Northern highland establishing wide contextual scene for travel editorial cover — calm, evidence-safe.",
        usages: [
          { channel: "threads", slotIndex: 0 },
          { channel: "instagram", cardId: "card-01" },
        ],
      },
      {
        role: "bridge_statement",
        visualMode: "editorial_photo",
        generatedVisualNeeded: true,
        visualIntent: DAO_BRIDGE_GOOD,
        usages: [{ channel: "instagram", cardId: "card-02" }],
      },
      {
        role: "cultural_context",
        visualMode: "editorial_photo",
        generatedVisualNeeded: true,
        visualIntent: DAO_CULTURE_GOOD,
        usages: [{ channel: "instagram", cardId: "card-03" }],
      },
      {
        role: "architecture_detail",
        visualMode: "object_or_detail",
        generatedVisualNeeded: true,
        visualIntent: "Close-up of rammed-earth wall texture and structural joints — no readable signage.",
        usages: [{ channel: "instagram", cardId: "card-04" }],
      },
      {
        role: "closing_mood",
        visualMode: "minimal_closing",
        generatedVisualNeeded: false,
        visualIntent: "Quiet highland closing mood — soft light payoff without new subject invention.",
        usages: [{ channel: "instagram", cardId: "card-05" }],
      },
    ],
  };
}

describe("SVP Cross-Card Visual Differentiation contract", () => {
  it("A. SOUL encodes differentiation axes, neighbor check, BAD/GOOD Dao example", () => {
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/Cross-card visual differentiation/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/subject class/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/spatial scale/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/lived-environment/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/visual distance/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/01→02|01→02, 02→03/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/misty northern mountains/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/terraced northern mountains/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/Do \*\*not\*\* force every card to look different/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/Do \*\*not\*\* inflate master count merely for differentiation/i);
  });

  it("B. SOUL evidence-safe cultural cascade — not landscape-only fallback", () => {
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/Evidence-safe cultural/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/people → architecture → dwelling pattern → path/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/lived-environment cues/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).toMatch(/not "fall back to generic landscape/i);
    expect(SHARED_VISUAL_PLANNER_SOUL).not.toMatch(/If humans are unsafe, use landscape["']?\s*$/m);
  });

  it("C. planner prompt mirrors neighbor-aware + cultural cue contract", () => {
    const input = buildSharedVisualPlannerInput({
      approvedAsset,
      bundle: minimalBundle(),
      instagramVisualRolePlan: daoDifferentiationVra(),
    });
    const prompt = formatSharedVisualPlannerPrompt(input);
    expect(prompt).toMatch(/pixel-distinguishable|Cross-card differentiation/i);
    expect(prompt).toMatch(/01→02→03→04→05|adjacent Instagram/i);
    expect(prompt).toMatch(/lived-environment cues/i);
    expect(prompt).toMatch(/Do NOT inflate master count/i);
    const schemaVisuals = (input.outputSchema as { visuals: Array<{ visualIntent: string }> }).visuals;
    expect(schemaVisuals[0]!.visualIntent).toMatch(/pixel-distinguishable/i);
  });

  it("D. Dao GOOD differentiated plan materializes; mode override trace preserved", () => {
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: minimalBundle(),
      llmRaw: goodDifferentiatedLlm(),
      instagramVisualRolePlan: daoDifferentiationVra(),
      sourceInstagramVisualRoleFingerprint: "fp_vra",
    });
    expect(plan.contract).toBe(SHARED_VISUAL_PLAN_CONTRACT);
    const byCard = new Map<string, (typeof plan.visuals)[number]>();
    for (const v of plan.visuals) {
      for (const u of v.usages) {
        if (u.channel === "instagram") byCard.set(u.cardId, v);
      }
    }
    const bridge = byCard.get("card-02")!;
    const culture = byCard.get("card-03")!;
    expect(bridge.visualIntent).toMatch(/geographic transition|layered ranges/i);
    expect(culture.visualIntent).toMatch(/dwellings|cultivated|settlement|lived environment/i);
    expect(culture.visualIntent.toLowerCase()).not.toBe(DAO_CULTURE_BAD);
    expect(bridge.visualIntent.toLowerCase()).not.toBe(DAO_BRIDGE_BAD);
    expect(culture.visualIntent).not.toMatch(/^terraced (northern )?mountains$/i);
    expect(
      plan.decisionTrace?.overrides.some(
        (o) => o.field === "visualModePreference" && o.cardId === "card-03",
      ),
    ).toBe(true);
    expect(culture.visualMode).toBe("editorial_photo");
  });

  it("E. Astra SOUL/prompt forbid collapsing differentiated cultural intent", () => {
    expect(ASTRA_HANDOFF_WRITER_SOUL).toMatch(/Preserve SVP differentiation/i);
    expect(ASTRA_HANDOFF_WRITER_SOUL).toMatch(/collapse.*generic mountain landscape/i);
    expect(ASTRA_HANDOFF_WRITER_SOUL).toMatch(/invent a new subject to "fix"/i);
    const prompt = formatAstraHandoffWriterPrompt({ visuals: [] });
    expect(prompt).toMatch(/Preserve SVP master subject differentiation/i);
    expect(prompt).toMatch(/Do not collapse lived-environment/i);
  });

  it("F. Astra enrichment preserves differentiated cultural / bridge intents", () => {
    const { plan } = materializeSharedVisualPlanFromLlm({
      bundle: minimalBundle(),
      llmRaw: goodDifferentiatedLlm(),
      instagramVisualRolePlan: daoDifferentiationVra(),
      sourceInstagramVisualRoleFingerprint: "fp_vra",
    });
    const typedPlan = plan as SharedVisualPlan;
    const bridgeId = typedPlan.visuals.find((v) =>
      v.usages.some((u) => u.channel === "instagram" && u.cardId === "card-02"),
    )!.visualId;
    const cultureId = typedPlan.visuals.find((v) =>
      v.usages.some((u) => u.channel === "instagram" && u.cardId === "card-03"),
    )!.visualId;

    const handoff = materializeManualAstraHandoffFromLlm({
      plan: typedPlan,
      llmRaw: {
        visuals: typedPlan.visuals
          .filter((v) => v.generatedVisualNeeded)
          .map((v) => ({
            visualId: v.visualId,
            refinedVisualIntent:
              v.visualId === cultureId
                ? `${v.visualIntent} Soft dawn side-light; keep dwellings/paths readable without faces.`
                : v.visualId === bridgeId
                  ? `${v.visualIntent} Cool mist layers for geographic depth; no settlement invent.`
                  : `${v.visualIntent} — Astra composition enrichment only.`,
            compositionGuidance: "leave lower third quieter for overlay",
            textSafeArea: "lower third",
            atmosphereLighting: "soft editorial light",
            evidenceSafeConstraints: ["no readable signage", "no staged ethnic portrait"],
          })),
      },
    });

    const astraBridge = handoff.visuals.find((v) => v.visualId === bridgeId)!;
    const astraCulture = handoff.visuals.find((v) => v.visualId === cultureId)!;
    expect(astraBridge.visualIntent).toMatch(/geographic transition|layered ranges/i);
    expect(astraCulture.visualIntent).toMatch(/dwellings|paths|cultivated|settlement/i);
    expect(astraCulture.visualIntent).not.toMatch(/^generic mountain landscape/i);
    expect(astraCulture.visualIntent.toLowerCase()).not.toContain("terraced northern mountains");
  });
});
