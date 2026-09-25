/**
 * Instagram Visual Role Architect — authority, boundary, rhythm, lifecycle, SVP wiring.
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableChannelContent,
  type PublishableContentBundle,
  type PublishableInstagramCardPlan,
} from "@/lib/marketing/publishable/contracts";
import {
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import type {
  InstagramCardCopy,
  InstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  INSTAGRAM_CARD_COPY_CONTRACT,
  INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
import {
  persistInstagramCardCopy,
  persistInstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/persist";
import {
  assertNoMasterOrchestrationFields,
  InstagramVisualRoleMaterializeError,
  materializeInstagramVisualRolePlan,
} from "@/lib/marketing/publishable/instagramVisualRole/materialize";
import {
  buildInstagramVisualRoleArchitectPrompt,
  ensureInstagramVisualRolePlan,
  formatVisualRoleRepairHint,
} from "@/lib/marketing/publishable/instagramVisualRole/pipeline";
import { resolveInstagramVisualRolePlanLifecycle } from "@/lib/marketing/publishable/instagramVisualRole/lifecycle";
import { INSTAGRAM_VISUAL_ROLE_ARCHITECT_SOUL } from "@/lib/marketing/publishable/instagramVisualRole/hermesIdentity";
import {
  INSTAGRAM_VISUAL_MODE_PREFERENCES,
  INSTAGRAM_VISUAL_PRESENTATION_PREFERENCES,
  INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT,
  INSTAGRAM_VISUAL_ROLES,
} from "@/lib/marketing/publishable/instagramVisualRole/contracts";
import { buildSharedVisualPlannerInput } from "@/lib/marketing/publishable/visualOrchestration/plannerInput";
import { generateSharedVisualPlanWithLlm } from "@/lib/marketing/publishable/visualOrchestration/generateSharedVisualPlan";
import { materializeSharedVisualPlanFromLlm } from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import { resolveSharedVisualPlanLifecycle } from "@/lib/marketing/publishable/visualOrchestration/lifecycle";
import { buildInstagramVisualRoleContentFingerprint } from "@/lib/marketing/publishable/instagramVisualRole/fingerprint";

const approvedAsset = {
  assetId: "cma_dao",
  version: 1,
  approvedVersion: 1,
  titleKo: "북부 국경 Dao족과 nhà trình tường",
  openingHookKo: "해변만 떠올렸다면 북부 국경을 보세요",
  bodyKo: "랑선 일대 Dao족 마을의 전통 흙다짐 가옥.",
  keyTakeawaysKo: ["Dao족", "nhà trình tường"],
  decisionGuidanceKo: null,
  editorialArchetype: "cultural_curiosity",
  supportedClaimBoundaryKo: "공식 소개 범위의 건축·거주 배경만",
  limitationsKo: ["특정 마을 방문 가능 여부 미확인"],
  forbiddenClaimsKo: ["완벽한 오지 체험"],
  storySupportVerdict: "supported",
} as unknown as CanonicalMarketingAsset;

function daoCarousel(): InstagramCarouselPlan {
  return {
    contract: INSTAGRAM_CAROUSEL_PLAN_CONTRACT,
    assetId: "cma_dao",
    assetVersion: 1,
    sourceNarrativeFingerprint: "fp_narrative",
    cards: [
      {
        cardId: "card-01",
        role: "hook_cover",
        beatIds: ["beat_01"],
        communicationGoal: "익숙한 베트남 이미지 소환",
        visualPriority: "hero",
      },
      {
        cardId: "card-02",
        role: "reframe",
        beatIds: ["beat_03"],
        communicationGoal: "북쪽으로 올라가면 풍경이 달라진다",
        visualPriority: "strong",
      },
      {
        cardId: "card-03",
        role: "context",
        beatIds: ["beat_04"],
        communicationGoal: "랑선·Dao족 맥락",
        visualPriority: "useful",
      },
      {
        cardId: "card-04",
        role: "evidence_detail",
        beatIds: ["beat_05"],
        communicationGoal: "nhà trình tường 건축 디테일",
        visualPriority: "strong",
      },
      {
        cardId: "card-05",
        role: "closing",
        beatIds: ["beat_06"],
        communicationGoal: "프레임 전환 payoff",
        visualPriority: "optional",
      },
    ],
    provenance: {
      sourceAssetId: "cma_dao",
      sourceVersion: 1,
      modelProfile: "instagram-carousel-planner",
      generatedAt: "2026-09-18T00:00:00.000Z",
      sourceUpstreamFingerprint: "fp_narrative",
    },
  };
}

function daoCardCopy(carousel: InstagramCarouselPlan): InstagramCardCopy {
  return {
    contract: INSTAGRAM_CARD_COPY_CONTRACT,
    assetId: "cma_dao",
    assetVersion: 1,
    sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel),
    cards: [
      {
        cardId: "card-01",
        headline: "해변으로 기억하는 베트남",
        body: "다낭·푸꾸옥·리조트 이미지가 먼저 떠오릅니다",
        evidenceRefs: [],
      },
      {
        cardId: "card-02",
        headline: "북쪽으로 올라가면 풍경부터 달라집니다",
        body: "산악 국경 지대의 리듬이 남부 휴양과 다릅니다",
        evidenceRefs: [],
      },
      {
        cardId: "card-03",
        headline: "랑선 국경, Dao족 마을",
        body: "험준한 지형 속 생활 공간이 이야기를 받칩니다",
        evidenceRefs: [],
      },
      {
        cardId: "card-04",
        headline: "nhà trình tường, 흙다짐 가옥",
        body: "판축 구조가 구체적 건축 단서입니다",
        evidenceRefs: ["ev_dao_house"],
      },
      {
        cardId: "card-05",
        headline: "휴양 프레임 밖에서 읽히는 베트남",
        body: "건축·생활의 payoff",
        evidenceRefs: [],
      },
    ],
    provenance: {
      sourceAssetId: "cma_dao",
      sourceVersion: 1,
      modelProfile: "instagram-card-copy-writer",
      generatedAt: "2026-09-18T00:00:00.000Z",
      sourceUpstreamFingerprint: buildInstagramCarouselContentFingerprint(carousel),
    },
  };
}

/** Acceptance example — not production hardcode. */
function daoVraLlm() {
  return {
    rhythmSummary:
      "hero cover → bridge statement → cultural context → architecture detail → closing mood",
    cards: [
      {
        cardId: "card-01",
        visualRole: "hero_cover",
        visualPurpose: "익숙한 해변 프레임을 깨는 북부 산악 establishing",
        visualPriority: "hero",
        visualDensity: "dominant",
        visualModePreference: "editorial_photo",
        generationPreference: "required",
        presentationPreference: "full_bleed",
        reusePreference: "exclusive_preferred",
        concreteVisualIntent:
          "북부 산악 국경 지대 establishing 풍경 — 해변 리조트와 대비되는 산악 실루엣",
        evidenceRefs: [],
      },
      {
        cardId: "card-02",
        visualRole: "bridge_statement",
        visualPurpose: "풍경 전환 선언을 이미지-backed 문구로",
        visualPriority: "strong",
        visualDensity: "subtle",
        visualModePreference: "editorial_photo",
        generationPreference: "preferred",
        presentationPreference: "image_backed_statement",
        reusePreference: "derivative_ok",
        concreteVisualIntent:
          "산악으로 이어지는 도로·능선 분위기 배경 — 텍스트가 주인공인 bridge",
        evidenceRefs: [],
      },
      {
        cardId: "card-03",
        visualRole: "cultural_context",
        visualPurpose: "랑선 Dao족 마을 맥락",
        visualPriority: "useful",
        visualDensity: "strong",
        visualModePreference: "editorial_photo",
        generationPreference: "preferred",
        presentationPreference: "photo_top",
        reusePreference: "reusable",
        concreteVisualIntent:
          "북부 국경 산악 마을 생활 공간 맥락 — 특정 간판·인물 식별 금지",
        evidenceRefs: [],
      },
      {
        cardId: "card-04",
        visualRole: "architecture_detail",
        visualPurpose: "nhà trình tường 흙다짐 디테일",
        visualPriority: "strong",
        visualDensity: "strong",
        visualModePreference: "object_or_detail",
        generationPreference: "preferred",
        presentationPreference: "detail_focus",
        reusePreference: "reusable",
        concreteVisualIntent:
          "판축(rammed-earth) 벽면·구조 디테일 close-up — nhà trình tường",
        evidenceRefs: ["ev_dao_house"],
      },
      {
        cardId: "card-05",
        visualRole: "closing_mood",
        visualPurpose: "프레임 전환 mood closure",
        visualPriority: "optional",
        visualDensity: "balanced",
        visualModePreference: "atmosphere",
        generationPreference: "optional",
        presentationPreference: "background_mood",
        reusePreference: "derivative_ok",
        concreteVisualIntent:
          "산악 지대 고요한 마감 분위기 — 휴양 프레임 밖 payoff mood",
        evidenceRefs: [],
      },
    ],
  };
}

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
    sourceCandidateId: "cmc_dao",
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
    visualIntent: "intent",
    ...partial,
  };
}

function legacyDaoBundle(): PublishableContentBundle {
  return {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: "cmc_dao_vra",
    businessDateKst: "2026-09-18",
    generatedAt: "2026-09-18T00:00:00.000Z",
    sourceRevision: "rev_dao",
    targetChannels: ["instagram"],
    sourceAssetId: "cma_dao",
    sourceAssetVersion: 1,
    threads: channel({
      channel: "threads",
      body: "해변만 떠올렸다면 북부 국경",
    }),
    shortform: channel({
      channel: "shortform",
      format: "short_video_narration",
      body: "나레이션",
    }),
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
        cardPlan: [
          card({
            cardId: "card-01",
            visual: {
              visualId: "social_visual_01",
              visualMode: "editorial_photo",
              generatedVisualNeeded: true,
              reusableOnThreads: true,
              visualIntent: "hero photo",
            },
          }),
          card({
            cardId: "card-02",
            visual: {
              visualId: "social_visual_02",
              visualMode: "typography",
              generatedVisualNeeded: false,
              reusableOnThreads: false,
              visualIntent: "typography",
            },
          }),
          card({
            cardId: "card-03",
            visual: {
              visualId: "social_visual_03",
              visualMode: "editorial_photo",
              generatedVisualNeeded: true,
              reusableOnThreads: false,
              visualIntent: "photo",
            },
          }),
          card({
            cardId: "card-04",
            visual: {
              visualId: "social_visual_04",
              visualMode: "object_or_detail",
              generatedVisualNeeded: true,
              reusableOnThreads: false,
              visualIntent: "detail",
            },
          }),
          card({
            cardId: "card-05",
            visual: {
              visualId: "social_visual_05",
              visualMode: "typography",
              generatedVisualNeeded: false,
              reusableOnThreads: false,
              visualIntent: "text closing",
            },
          }),
        ],
      },
    }),
  };
}

describe("Instagram Visual Role Architect", () => {
  it("A. authority — prompt carries Canonical + carousel visualPriority/beatIds/communicationGoal", async () => {
    const carousel = daoCarousel();
    const cardCopy = daoCardCopy(carousel);
    const dir = mkdtempSync(join(tmpdir(), "vra-a-"));
    const donor = join(dir, "profiles", "instagram-carousel-planner");
    mkdirSync(donor, { recursive: true });
    writeFileSync(join(donor, "config.yaml"), "model: stub\n", "utf8");
    const invoke = vi.fn(async (prompt: { text: string; hermesProfile: string }) => {
      expect(prompt.hermesProfile).toBe("instagram-visual-role-architect");
      expect(prompt.text).toContain("approved_canonical");
      expect(prompt.text).toContain('"visualPriority":"hero"');
      expect(prompt.text).toContain('"beatIds":["beat_03"]');
      expect(prompt.text).toContain("communicationGoal");
      expect(prompt.text).toContain("cma_dao");
      return JSON.stringify(daoVraLlm());
    });
    try {
      const result = await ensureInstagramVisualRolePlan({
        packageRoot: dir,
        approvedCanonicalAsset: approvedAsset,
        carousel,
        cardCopy,
        invoke,
        hermesHome: dir,
      });
      expect(result.ok).toBe(true);
      expect(invoke).toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("B. boundary — no visualId / usages / template / master count", () => {
    expect(() =>
      assertNoMasterOrchestrationFields({ visualId: "shared_visual_01" }),
    ).toThrow(InstagramVisualRoleMaterializeError);
    expect(() =>
      assertNoMasterOrchestrationFields({ usages: [{ channel: "instagram", cardId: "card-01" }] }),
    ).toThrow(/usages/);
    expect(() => assertNoMasterOrchestrationFields({ template: "cover_full_bleed" })).toThrow(
      /template/,
    );
    expect(() => assertNoMasterOrchestrationFields({ masterVisualCount: 2 })).toThrow(/count/);

    const carousel = daoCarousel();
    const plan = materializeInstagramVisualRolePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCarouselFingerprint: "fp_c",
      sourceCardCopyFingerprint: "fp_cc",
      carousel,
      llm: daoVraLlm(),
    });
    const json = JSON.stringify(plan);
    expect(json).not.toMatch(/"visualId"/);
    expect(json).not.toMatch(/"usages"/);
    expect(plan.contract).toBe(INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT);
  });

  it("C. all-card visual — every card has role; not text-only default drop", () => {
    const carousel = daoCarousel();
    const plan = materializeInstagramVisualRolePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCarouselFingerprint: "fp_c",
      sourceCardCopyFingerprint: "fp_cc",
      carousel,
      llm: daoVraLlm(),
    });
    expect(plan.cards).toHaveLength(5);
    for (const c of plan.cards) {
      expect(c.visualRole).toBeTruthy();
      expect(c.visualDensity).toBeTruthy();
      expect(c.generationPreference).toBeTruthy();
      expect(c.concreteVisualIntent.length).toBeGreaterThan(10);
    }
    // card 2/5 have visual treatment (not absent)
    expect(plan.cards[1]!.visualRole).toBe("bridge_statement");
    expect(plan.cards[4]!.visualRole).toBe("closing_mood");
  });

  it("D. rhythm — identical role+presentation rejected", () => {
    const carousel = daoCarousel();
    const flat = {
      rhythmSummary: "flat",
      cards: carousel.cards.map((c) => ({
        cardId: c.cardId,
        visualRole: "hero_cover",
        visualPurpose: "same",
        visualPriority: "hero",
        visualDensity: "dominant",
        visualModePreference: "editorial_photo",
        generationPreference: "required",
        presentationPreference: "full_bleed",
        reusePreference: "reusable",
        concreteVisualIntent: "identical treatment repeated across cards",
        evidenceRefs: [],
      })),
    };
    expect(() =>
      materializeInstagramVisualRolePlan({
        assetId: "cma_dao",
        assetVersion: 1,
        sourceCarouselFingerprint: "fp",
        sourceCardCopyFingerprint: "fp",
        carousel,
        llm: flat,
      }),
    ).toThrow(/flat_rhythm|identical/);
    expect(INSTAGRAM_VISUAL_ROLE_ARCHITECT_SOUL).toMatch(/rhythm/i);
    expect(INSTAGRAM_VISUAL_ROLE_ARCHITECT_SOUL).toMatch(/all-card visual treatment/i);
  });

  it("E. lifecycle — reuse / carousel stale / cardCopy stale; SVP does not stale VRA", () => {
    const carousel = daoCarousel();
    const cardCopy = daoCardCopy(carousel);
    const plan = materializeInstagramVisualRolePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel),
      sourceCardCopyFingerprint: buildInstagramCardCopyContentFingerprint(cardCopy),
      carousel,
      llm: daoVraLlm(),
    });
    expect(
      resolveInstagramVisualRolePlanLifecycle({ plan, carousel, cardCopy }),
    ).toBe("fresh");

    const carouselChanged = {
      ...carousel,
      cards: carousel.cards.map((c, i) =>
        i === 0 ? { ...c, communicationGoal: "CHANGED GOAL" } : c,
      ),
    };
    expect(
      resolveInstagramVisualRolePlanLifecycle({
        plan,
        carousel: carouselChanged,
        cardCopy,
      }),
    ).toBe("stale");

    const copyChanged = {
      ...cardCopy,
      cards: cardCopy.cards.map((c, i) =>
        i === 0 ? { ...c, headline: "CHANGED HEADLINE" } : c,
      ),
    };
    // fingerprint on copyChanged object itself differs from plan.sourceCardCopyFingerprint
    const copyChangedWithFp = {
      ...copyChanged,
      // lifecycle recomputes from content
    };
    expect(
      resolveInstagramVisualRolePlanLifecycle({
        plan,
        carousel,
        cardCopy: copyChangedWithFp,
      }),
    ).toBe("stale");
  });

  it("E2. ensure reuses when fingerprints match", async () => {
    const carousel = daoCarousel();
    const cardCopy = daoCardCopy(carousel);
    const dir = mkdtempSync(join(tmpdir(), "vra-e2-"));
    const donor = join(dir, "profiles", "instagram-carousel-planner");
    mkdirSync(donor, { recursive: true });
    writeFileSync(join(donor, "config.yaml"), "model: stub\n", "utf8");
    const invoke = vi.fn(async () => JSON.stringify(daoVraLlm()));
    try {
      const first = await ensureInstagramVisualRolePlan({
        packageRoot: dir,
        approvedCanonicalAsset: approvedAsset,
        carousel,
        cardCopy,
        invoke,
        hermesHome: dir,
      });
      expect(first.ok).toBe(true);
      if (first.ok) expect(first.status).toBe("generated");
      const second = await ensureInstagramVisualRolePlan({
        packageRoot: dir,
        approvedCanonicalAsset: approvedAsset,
        carousel,
        cardCopy,
        invoke,
        hermesHome: dir,
      });
      expect(second.ok).toBe(true);
      if (second.ok) expect(second.status).toBe("reused");
      expect(invoke).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("F. SVP integration — VRA is first-class and outranks legacy hints", () => {
    const carousel = daoCarousel();
    const plan = materializeInstagramVisualRolePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCarouselFingerprint: "fp_c",
      sourceCardCopyFingerprint: "fp_cc",
      carousel,
      llm: daoVraLlm(),
    });
    const input = buildSharedVisualPlannerInput({
      approvedAsset,
      bundle: legacyDaoBundle(),
      instagramVisualRolePlan: plan,
    });
    expect(input.instagramVisualRolePlan).toBeTruthy();
    expect(input.authority.instagramVisualSemantics).toBe("instagram_visual_role_plan");
    const cards = (input.instagramVisualRolePlan as { cards: Array<{ visualRole: string }> })
      .cards;
    expect(cards[0]!.visualRole).toBe("hero_cover");
    expect(cards[1]!.visualRole).toBe("bridge_statement");
    const ig = input.channels.instagram as { visualHints: { note: string } };
    expect(ig.visualHints.note).toMatch(/legacy advisory|prefer instagramVisualRolePlan/i);
  });

  it("G. legacy — without VRA artifact, SVP uses visualHints path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "vra-g-"));
    try {
      const invoke = vi.fn(async () =>
        JSON.stringify({
          strategySummary: "legacy path",
          visuals: [
            {
              role: "context_cover",
              visualMode: "editorial_photo",
              generatedVisualNeeded: true,
              visualIntent: "북부 산악 establishing — evidence-safe landscape",
              usages: [{ channel: "instagram", cardId: "card-01" }],
            },
          ],
        }),
      );
      const result = await generateSharedVisualPlanWithLlm({
        packageRoot: dir,
        bundle: legacyDaoBundle(),
        approvedCanonicalAsset: approvedAsset,
        invoke,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.visualRolePlanStatus).toBe("skipped_legacy");
        expect(result.plan.sourceInstagramVisualRoleFingerprint == null).toBe(true);
      }
      expect(invoke).toHaveBeenCalledTimes(1);
      const noVra = buildSharedVisualPlannerInput({
        approvedAsset,
        bundle: legacyDaoBundle(),
        instagramVisualRolePlan: null,
      });
      expect(noVra.instagramVisualRolePlan).toBeNull();
      expect(noVra.authority.instagramVisualSemantics).toBe("legacy_visual_hints_or_content");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("H. fail-closed — VRA failure blocks SVP when editorial artifacts exist", async () => {
    const carousel = daoCarousel();
    const cardCopy = daoCardCopy(carousel);
    const dir = mkdtempSync(join(tmpdir(), "vra-h-"));
    const donor = join(dir, "profiles", "instagram-carousel-planner");
    mkdirSync(donor, { recursive: true });
    writeFileSync(join(donor, "config.yaml"), "model: stub\n", "utf8");
    persistInstagramCarouselPlan({ packageRoot: dir, plan: carousel });
    persistInstagramCardCopy({ packageRoot: dir, copy: cardCopy });
    const svpInvoke = vi.fn(async () =>
      JSON.stringify({
        strategySummary: "should not run",
        visuals: [
          {
            role: "x",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: "should not materialize this plan at all here",
            usages: [{ channel: "instagram", cardId: "card-01" }],
          },
        ],
      }),
    );
    try {
      const result = await generateSharedVisualPlanWithLlm({
        packageRoot: dir,
        bundle: legacyDaoBundle(),
        approvedCanonicalAsset: approvedAsset,
        invoke: svpInvoke,
        invokeVisualRoleArchitect: async () => {
          throw new Error("vra_boom");
        },
        hermesHome: dir,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/Visual Role Architect failed|fail-closed/i);
      }
      expect(svpInvoke).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("H2. fail-closed — bad VRA JSON does not silently proceed to SVP", async () => {
    const carousel = daoCarousel();
    const cardCopy = daoCardCopy(carousel);
    const dir = mkdtempSync(join(tmpdir(), "vra-h2-"));
    const donor = join(dir, "profiles", "instagram-carousel-planner");
    mkdirSync(donor, { recursive: true });
    writeFileSync(join(donor, "config.yaml"), "model: stub\n", "utf8");
    persistInstagramCarouselPlan({ packageRoot: dir, plan: carousel });
    persistInstagramCardCopy({ packageRoot: dir, copy: cardCopy });
    const svpInvoke = vi.fn(async () => "{}");
    try {
      const result = await generateSharedVisualPlanWithLlm({
        packageRoot: dir,
        bundle: legacyDaoBundle(),
        approvedCanonicalAsset: approvedAsset,
        invoke: svpInvoke,
        invokeVisualRoleArchitect: async () => "not-json",
        hermesHome: dir,
      });
      expect(result.ok).toBe(false);
      expect(svpInvoke).not.toHaveBeenCalled();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("Dao fixture acceptance roles for card-01..05", () => {
    const fixturePath = join(
      process.cwd(),
      "src/lib/marketing/publishable/instagramVisualRole/__tests__/fixtures/dao-instagram-visual-role-plan.json",
    );
    const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
    const carousel = daoCarousel();
    const plan = materializeInstagramVisualRolePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel),
      sourceCardCopyFingerprint: "fp_fixture",
      carousel,
      llm: raw,
    });
    expect(plan.cards.map((c) => c.visualRole)).toEqual([
      "hero_cover",
      "bridge_statement",
      "cultural_context",
      "architecture_detail",
      "closing_mood",
    ]);
    expect(plan.cards.map((c) => c.visualDensity)).toEqual([
      "dominant",
      "subtle",
      "strong",
      "strong",
      "balanced",
    ]);
    expect(plan.cards.map((c) => c.presentationPreference)).toEqual([
      "full_bleed",
      "image_backed_statement",
      "photo_top",
      "detail_focus",
      "background_mood",
    ]);
    expect(plan.cards.every((c) => c.generationPreference === "required")).toBe(false);
  });

  it("SVP stale when recorded VRA fingerprint changes", () => {
    const carousel = daoCarousel();
    const vra = materializeInstagramVisualRolePlan({
      assetId: "cma_dao",
      assetVersion: 1,
      sourceCarouselFingerprint: "fp_c",
      sourceCardCopyFingerprint: "fp_cc",
      carousel,
      llm: daoVraLlm(),
    });
    const fp = buildInstagramVisualRoleContentFingerprint(vra);
    const bundle = legacyDaoBundle();
    const { plan: svp } = materializeSharedVisualPlanFromLlm({
      bundle,
      llmRaw: {
        strategySummary: "with vra",
        visuals: [
          {
            role: "context_cover",
            visualMode: "editorial_photo",
            generatedVisualNeeded: true,
            visualIntent: "북부 산악 establishing landscape — evidence-safe border mountains",
            usages: [{ channel: "instagram", cardId: "card-01" }],
          },
        ],
      },
      sourceInstagramVisualRoleFingerprint: fp,
    });
    expect(svp.sourceInstagramVisualRoleFingerprint).toBe(fp);
    expect(
      resolveSharedVisualPlanLifecycle({
        plan: svp,
        bundle,
        currentInstagramVisualRoleFingerprint: fp,
      }),
    ).toBe("fresh");
    expect(
      resolveSharedVisualPlanLifecycle({
        plan: svp,
        bundle,
        currentInstagramVisualRoleFingerprint: "changed_vra_fp",
      }),
    ).toBe("stale");
  });
});

describe("VRA visualRole contract enforcement", () => {
  function withVisualRoles(
    roles: string[],
    presentationByCard?: Record<string, string>,
  ): ReturnType<typeof daoVraLlm> {
    const base = daoVraLlm();
    return {
      ...base,
      cards: base.cards.map((c, i) => ({
        ...c,
        visualRole: roles[i] ?? c.visualRole,
        presentationPreference: presentationByCard?.[c.cardId] ?? c.presentationPreference,
      })),
    };
  }

  it("A. materialize negative — reframe/context/closing → invalid_visual_role", () => {
    const carousel = daoCarousel();
    for (const bad of ["reframe", "context", "closing"] as const) {
      expect(() =>
        materializeInstagramVisualRolePlan({
          assetId: "cma_dao",
          assetVersion: 1,
          sourceCarouselFingerprint: "fp_c",
          sourceCardCopyFingerprint: "fp_cc",
          carousel,
          llm: withVisualRoles([
            "hero_cover",
            bad,
            "cultural_context",
            "architecture_detail",
            "closing_mood",
          ]),
        }),
      ).toThrow(InstagramVisualRoleMaterializeError);
      try {
        materializeInstagramVisualRolePlan({
          assetId: "cma_dao",
          assetVersion: 1,
          sourceCarouselFingerprint: "fp_c",
          sourceCardCopyFingerprint: "fp_cc",
          carousel,
          llm: withVisualRoles([
            "hero_cover",
            bad,
            "cultural_context",
            "architecture_detail",
            "closing_mood",
          ]),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(InstagramVisualRoleMaterializeError);
        expect((error as InstagramVisualRoleMaterializeError).code).toBe("invalid_visual_role");
        expect((error as Error).message).toContain(bad);
        expect((error as Error).message).toContain("card-02");
      }
    }
  });

  it("B. presentation negative — card_contained/standard_card → invalid_presentation_pref", () => {
    const carousel = daoCarousel();
    for (const bad of ["card_contained", "standard_card"] as const) {
      try {
        materializeInstagramVisualRolePlan({
          assetId: "cma_dao",
          assetVersion: 1,
          sourceCarouselFingerprint: "fp_c",
          sourceCardCopyFingerprint: "fp_cc",
          carousel,
          llm: withVisualRoles(
            [
              "hero_cover",
              "bridge_statement",
              "cultural_context",
              "architecture_detail",
              "closing_mood",
            ],
            { "card-02": bad },
          ),
        });
        expect.unreachable("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(InstagramVisualRoleMaterializeError);
        expect((error as InstagramVisualRoleMaterializeError).code).toBe(
          "invalid_presentation_pref",
        );
        expect((error as Error).message).toContain(bad);
      }
    }
  });

  it("C. repair flow — attempt1 context then attempt2 supporting_context → success", async () => {
    const carousel = daoCarousel();
    const cardCopy = daoCardCopy(carousel);
    const dir = mkdtempSync(join(tmpdir(), "vra-repair-ok-"));
    const donor = join(dir, "profiles", "instagram-carousel-planner");
    mkdirSync(donor, { recursive: true });
    writeFileSync(join(donor, "config.yaml"), "model: stub\n", "utf8");
    let attempt = 0;
    const invoke = vi.fn(async (prompt: { text: string }) => {
      attempt += 1;
      if (attempt === 1) {
        expect(prompt.text).not.toContain("errorCode:");
        return JSON.stringify(
          withVisualRoles([
            "hero_cover",
            "context",
            "cultural_context",
            "architecture_detail",
            "closing_mood",
          ]),
        );
      }
      expect(prompt.text).toContain("errorCode: invalid_visual_role");
      expect(prompt.text).toContain("invalidRawValue:");
      expect(prompt.text).toContain("allowedVisualRole:");
      expect(prompt.text).toMatch(/Do not copy carousel role vocabulary/i);
      expect(prompt.text).toContain("context");
      return JSON.stringify(
        withVisualRoles([
          "hero_cover",
          "supporting_context",
          "cultural_context",
          "architecture_detail",
          "closing_mood",
        ]),
      );
    });
    try {
      const result = await ensureInstagramVisualRolePlan({
        packageRoot: dir,
        approvedCanonicalAsset: approvedAsset,
        carousel,
        cardCopy,
        invoke,
        hermesHome: dir,
        forceRegenerate: true,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.plan.cards[1]!.visualRole).toBe("supporting_context");
      }
      expect(invoke).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("D. persistent invalid — all attempts invalid → fail-closed", async () => {
    const carousel = daoCarousel();
    const cardCopy = daoCardCopy(carousel);
    const dir = mkdtempSync(join(tmpdir(), "vra-repair-fail-"));
    const donor = join(dir, "profiles", "instagram-carousel-planner");
    mkdirSync(donor, { recursive: true });
    writeFileSync(join(donor, "config.yaml"), "model: stub\n", "utf8");
    const invoke = vi.fn(async () =>
      JSON.stringify(
        withVisualRoles([
          "hero_cover",
          "reframe",
          "cultural_context",
          "architecture_detail",
          "closing_mood",
        ]),
      ),
    );
    try {
      const result = await ensureInstagramVisualRolePlan({
        packageRoot: dir,
        approvedCanonicalAsset: approvedAsset,
        carousel,
        cardCopy,
        invoke,
        hermesHome: dir,
        forceRegenerate: true,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("invalid_visual_role");
      }
      expect(invoke).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("E. prompt/SOUL contract — allowed enums + carousel≠visualRole warning", () => {
    for (const role of INSTAGRAM_VISUAL_ROLES) {
      expect(INSTAGRAM_VISUAL_ROLE_ARCHITECT_SOUL).toContain(role);
    }
    for (const pref of INSTAGRAM_VISUAL_PRESENTATION_PREFERENCES) {
      expect(INSTAGRAM_VISUAL_ROLE_ARCHITECT_SOUL).toContain(pref);
    }
    for (const mode of INSTAGRAM_VISUAL_MODE_PREFERENCES) {
      expect(INSTAGRAM_VISUAL_ROLE_ARCHITECT_SOUL).toContain(mode);
    }
    expect(INSTAGRAM_VISUAL_ROLE_ARCHITECT_SOUL).toMatch(/Allowed visualModePreference/i);
    expect(INSTAGRAM_VISUAL_ROLE_ARCHITECT_SOUL).toMatch(/do not invent synonyms/i);
    expect(INSTAGRAM_VISUAL_ROLE_ARCHITECT_SOUL).toMatch(/different vocabularies/i);
    expect(INSTAGRAM_VISUAL_ROLE_ARCHITECT_SOUL).toMatch(/NEVER copy carousel/i);

    const prompt = buildInstagramVisualRoleArchitectPrompt({
      asset: approvedAsset,
      narrative: null,
      carousel: daoCarousel(),
      cardCopy: daoCardCopy(daoCarousel()),
    });
    for (const role of INSTAGRAM_VISUAL_ROLES) {
      expect(prompt).toContain(role);
    }
    for (const pref of INSTAGRAM_VISUAL_PRESENTATION_PREFERENCES) {
      expect(prompt).toContain(pref);
    }
    for (const mode of INSTAGRAM_VISUAL_MODE_PREFERENCES) {
      expect(prompt).toContain(mode);
    }
    expect(prompt).toMatch(/NEVER copy carousel role into visualRole/i);
    expect(prompt).toContain("vocabularyContract");
    expect(prompt).toContain("allowedVisualModePreference");

    const repair = formatVisualRoleRepairHint(
      new InstagramVisualRoleMaterializeError(
        "invalid_visual_role",
        'Invalid visualRole on card-02: got "context"',
        {
          cardId: "card-02",
          field: "visualRole",
          invalidRawValue: "context",
          allowedValues: INSTAGRAM_VISUAL_ROLES,
        },
      ),
    );
    expect(repair).toContain("errorCode: invalid_visual_role");
    expect(repair).toContain('"context"');
    expect(repair).toContain(INSTAGRAM_VISUAL_ROLES.join(" | "));
    expect(repair).toContain("allowedVisualModePreference:");
  });

  it("F. fixture parity — carousel role copy negative fixture fails materialize", () => {
    const fixturePath = join(
      process.cwd(),
      "src/lib/marketing/publishable/instagramVisualRole/__tests__/fixtures/dao-vra-carousel-role-copy-negative.json",
    );
    const raw = JSON.parse(readFileSync(fixturePath, "utf8"));
    expect(raw.cards.map((c: { visualRole: string }) => c.visualRole)).toEqual([
      "hero_cover",
      "reframe",
      "context",
      "evidence_detail",
      "closing",
    ]);
    expect(() =>
      materializeInstagramVisualRolePlan({
        assetId: "cma_dao",
        assetVersion: 1,
        sourceCarouselFingerprint: "fp_c",
        sourceCardCopyFingerprint: "fp_cc",
        carousel: daoCarousel(),
        llm: raw,
      }),
    ).toThrow(/invalid_visual_role|Invalid visualRole/i);
  });
});

describe("VRA visualModePreference contract enforcement", () => {
  function withModePrefs(modesByCard: Record<string, string>): ReturnType<typeof daoVraLlm> {
    const base = daoVraLlm();
    return {
      ...base,
      cards: base.cards.map((c) => ({
        ...c,
        visualModePreference: modesByCard[c.cardId] ?? c.visualModePreference,
      })),
    };
  }

  it("A–D. invented modes → invalid_mode_pref with exact raw", () => {
    const carousel = daoCarousel();
    for (const bad of ["typography_mood", "detail_shot", "documentary"] as const) {
      try {
        materializeInstagramVisualRolePlan({
          assetId: "cma_dao",
          assetVersion: 1,
          sourceCarouselFingerprint: "fp_c",
          sourceCardCopyFingerprint: "fp_cc",
          carousel,
          llm: withModePrefs({ "card-05": bad }),
        });
        expect.unreachable("expected throw");
      } catch (error) {
        expect(error).toBeInstanceOf(InstagramVisualRoleMaterializeError);
        const err = error as InstagramVisualRoleMaterializeError;
        expect(err.code).toBe("invalid_mode_pref");
        expect(err.message).toContain(bad);
        expect(err.message).toMatch(/got/);
        expect(err.details?.cardId).toBe("card-05");
        expect(err.details?.field).toBe("visualModePreference");
        expect(err.details?.invalidRawValue).toBe(bad);
        expect(err.details?.allowedValues).toEqual([...INSTAGRAM_VISUAL_MODE_PREFERENCES]);
      }
    }
  });

  it("E. repair hint includes invalid raw + allowedVisualModePreference", () => {
    const repair = formatVisualRoleRepairHint(
      new InstagramVisualRoleMaterializeError(
        "invalid_mode_pref",
        'Invalid visualModePreference on card-05: got "typography_mood"',
        {
          cardId: "card-05",
          field: "visualModePreference",
          invalidRawValue: "typography_mood",
          allowedValues: INSTAGRAM_VISUAL_MODE_PREFERENCES,
        },
      ),
    );
    expect(repair).toContain("errorCode: invalid_mode_pref");
    expect(repair).toContain("cardId: card-05");
    expect(repair).toContain("field: visualModePreference");
    expect(repair).toContain('"typography_mood"');
    expect(repair).toContain("allowedVisualModePreference:");
    expect(repair).toContain(INSTAGRAM_VISUAL_MODE_PREFERENCES.join(" | "));
    expect(repair).toMatch(/Do not invent synonyms/i);
  });

  it("F. repair response with valid enum → PASS", async () => {
    const carousel = daoCarousel();
    const cardCopy = daoCardCopy(carousel);
    const dir = mkdtempSync(join(tmpdir(), "vra-mode-repair-ok-"));
    const donor = join(dir, "profiles", "instagram-carousel-planner");
    mkdirSync(donor, { recursive: true });
    writeFileSync(join(donor, "config.yaml"), "model: stub\n", "utf8");
    let attempt = 0;
    const invoke = vi.fn(async (prompt: { text: string }) => {
      attempt += 1;
      if (attempt === 1) {
        expect(prompt.text).not.toContain("errorCode:");
        return JSON.stringify(withModePrefs({ "card-05": "typography_mood" }));
      }
      expect(prompt.text).toContain("errorCode: invalid_mode_pref");
      expect(prompt.text).toContain("allowedVisualModePreference:");
      expect(prompt.text).toContain('"typography_mood"');
      return JSON.stringify(withModePrefs({ "card-05": "typography" }));
    });
    try {
      const result = await ensureInstagramVisualRolePlan({
        packageRoot: dir,
        approvedCanonicalAsset: approvedAsset,
        hermesHome: dir,
        forceRegenerate: true,
        carousel,
        cardCopy,
        invoke,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.status).toBe("generated");
        expect(result.plan.cards.find((c) => c.cardId === "card-05")?.visualModePreference).toBe(
          "typography",
        );
      }
      expect(invoke).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("G. repair with another invented synonym → fail_closed", async () => {
    const carousel = daoCarousel();
    const cardCopy = daoCardCopy(carousel);
    const dir = mkdtempSync(join(tmpdir(), "vra-mode-repair-fail-"));
    const donor = join(dir, "profiles", "instagram-carousel-planner");
    mkdirSync(donor, { recursive: true });
    writeFileSync(join(donor, "config.yaml"), "model: stub\n", "utf8");
    let attempt = 0;
    const invoke = vi.fn(async () => {
      attempt += 1;
      return JSON.stringify(
        withModePrefs({
          "card-05": attempt === 1 ? "typography_mood" : "typography_focus",
        }),
      );
    });
    try {
      const result = await ensureInstagramVisualRolePlan({
        packageRoot: dir,
        approvedCanonicalAsset: approvedAsset,
        hermesHome: dir,
        forceRegenerate: true,
        carousel,
        cardCopy,
        invoke,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("invalid_mode_pref");
        expect(result.error.message).toContain("typography_focus");
      }
      expect(invoke).toHaveBeenCalledTimes(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("H. valid mode preferences materialize", () => {
    const carousel = daoCarousel();
    for (const mode of [
      "editorial_photo",
      "object_or_detail",
      "minimal_closing",
      "typography",
      "atmosphere",
    ] as const) {
      const plan = materializeInstagramVisualRolePlan({
        assetId: "cma_dao",
        assetVersion: 1,
        sourceCarouselFingerprint: "fp_c",
        sourceCardCopyFingerprint: "fp_cc",
        carousel,
        llm: withModePrefs({ "card-05": mode }),
      });
      expect(plan.cards.find((c) => c.cardId === "card-05")?.visualModePreference).toBe(mode);
    }
  });

  it("J. presentationPreference still rejects invented values with got raw", () => {
    const carousel = daoCarousel();
    try {
      materializeInstagramVisualRolePlan({
        assetId: "cma_dao",
        assetVersion: 1,
        sourceCarouselFingerprint: "fp_c",
        sourceCardCopyFingerprint: "fp_cc",
        carousel,
        llm: {
          ...daoVraLlm(),
          cards: daoVraLlm().cards.map((c) =>
            c.cardId === "card-02"
              ? { ...c, presentationPreference: "card_contained" }
              : c,
          ),
        },
      });
      expect.unreachable("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(InstagramVisualRoleMaterializeError);
      const err = error as InstagramVisualRoleMaterializeError;
      expect(err.code).toBe("invalid_presentation_pref");
      expect(err.message).toContain("card_contained");
      expect(err.details?.invalidRawValue).toBe("card_contained");
    }
  });
});
