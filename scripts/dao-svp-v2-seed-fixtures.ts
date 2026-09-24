/**
 * Seed Dao package editorial + VRA + SVP v2 artifacts when Hermes is unavailable.
 * Uses the same Dao acceptance fixtures as unit tests (not live LLM).
 * Usage: npx tsx scripts/dao-svp-v2-seed-fixtures.ts
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { readEditorialNarrativePlanFromPackage } from "@/lib/marketing/publishable/instagramEditorial/persist";
import {
  materializeInstagramCardCopy,
  materializeInstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/materialize";
import {
  buildEditorialNarrativeContentFingerprint,
  buildInstagramCardCopyContentFingerprint,
  buildInstagramCarouselContentFingerprint,
} from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import {
  persistInstagramCardCopy,
  persistInstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/persist";
import { materializeInstagramVisualRolePlan } from "@/lib/marketing/publishable/instagramVisualRole/materialize";
import { persistInstagramVisualRolePlan } from "@/lib/marketing/publishable/instagramVisualRole/persist";
import { buildInstagramVisualRoleContentFingerprint } from "@/lib/marketing/publishable/instagramVisualRole/fingerprint";
import {
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { materializeSharedVisualPlanFromLlm } from "@/lib/marketing/publishable/visualOrchestration/materializePlannerOutput";
import { persistSharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";

const PKG =
  process.env.DAO_PACKAGE_ROOT ??
  "/mnt/HDD2TB/marketing-assets/2026/09/18/cmc_daily_marketing_production_2026_09_18_e0";

/** Matches Instagram editorial split Dao fixture (card-01 style). */
function daoCarouselLlm() {
  return {
    cards: [
      {
        cardId: "card-01",
        role: "hook_cover",
        beatIds: ["beat_01"],
        communicationGoal: "왜 스와이프하는지 — 익숙한 베트남 이미지를 소환",
        visualPriority: "hero",
      },
      {
        cardId: "card-02",
        role: "reframe",
        beatIds: ["beat_03"],
        communicationGoal: "북쪽으로 올라가면 풍경이 달라진다는 새 정보",
        visualPriority: "strong",
      },
      {
        cardId: "card-03",
        role: "context",
        beatIds: ["beat_04"],
        communicationGoal: "랑선·Dao족 맥락 제시",
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
        communicationGoal: "스토리 payoff — 프레임이 바뀐다",
        visualPriority: "optional",
      },
    ],
  };
}

function daoCardCopyLlm() {
  return {
    cards: [
      {
        cardId: "card-01",
        headline: "해변으로 기억하는 베트남",
        body: "다낭·푸꾸옥·리조트 이미지가 먼저 떠오릅니다",
      },
      {
        cardId: "card-02",
        headline: "북쪽으로 올라가면 풍경부터 달라집니다",
        body: "산악 국경 지대의 리듬이 남부 휴양과 다릅니다",
      },
      {
        cardId: "card-03",
        headline: "랑선 국경, Dao족 마을",
        body: "험준한 지형 속 생활 공간이 이야기를 받칩니다",
      },
      {
        cardId: "card-04",
        headline: "nhà trình tường, 흙다짐 가옥",
        body: "판축(rammed-earth) 구조가 구체적 건축 단서입니다",
        evidenceRefs: ["ev_dao_house"],
      },
      {
        cardId: "card-05",
        headline: "휴양 프레임 밖에서 읽히는 베트남",
        body: "익숙한 해변 요약이 아니라 건축·생활의 payoff",
      },
    ],
  };
}

function main() {
  const asset = readCanonicalAssetFromPackage(PKG);
  if (!asset) throw new Error("canonical missing");
  const narrative = readEditorialNarrativePlanFromPackage(PKG);
  if (!narrative) throw new Error("narrative missing");

  const narrativeFp = buildEditorialNarrativeContentFingerprint(narrative);
  const validBeatIds = new Set(narrative.beats.map((b) => b.beatId));
  // Map fixture beat ids to whatever narrative has if names differ
  const beats = narrative.beats;
  const carouselLlm = daoCarouselLlm();
  // Remap beatIds to existing narrative beats by index when needed
  carouselLlm.cards = carouselLlm.cards.map((c, i) => ({
    ...c,
    beatIds: [beats[Math.min(i, beats.length - 1)]!.beatId],
  }));

  const carousel = materializeInstagramCarouselPlan({
    assetId: asset.assetId,
    assetVersion: asset.version,
    sourceNarrativeFingerprint: narrativeFp,
    modelProfile: "instagram-carousel-planner:fixture-seed",
    validBeatIds,
    minCards: 4,
    maxCards: 6,
    llm: carouselLlm,
  });
  persistInstagramCarouselPlan({ packageRoot: PKG, plan: carousel });

  const carouselFp = buildInstagramCarouselContentFingerprint(carousel);
  const cardCopy = materializeInstagramCardCopy({
    assetId: asset.assetId,
    assetVersion: asset.version,
    sourceCarouselFingerprint: carouselFp,
    modelProfile: "instagram-card-copy-writer:fixture-seed",
    expectedCardIds: carousel.cards.map((c) => c.cardId),
    llm: daoCardCopyLlm(),
  });
  persistInstagramCardCopy({ packageRoot: PKG, copy: cardCopy });

  const vraFixture = JSON.parse(
    readFileSync(
      join(
        process.cwd(),
        "src/lib/marketing/publishable/instagramVisualRole/__tests__/fixtures/dao-instagram-visual-role-plan.json",
      ),
      "utf8",
    ),
  );
  // Fixture uses card_1 style in comments but card-01 in editorial — align to carousel
  vraFixture.cards = vraFixture.cards.map(
    (c: { cardId: string }, i: number) => ({
      ...c,
      cardId: carousel.cards[i]!.cardId,
    }),
  );

  const cardCopyFp = buildInstagramCardCopyContentFingerprint(cardCopy);
  const vra = materializeInstagramVisualRolePlan({
    assetId: asset.assetId,
    assetVersion: asset.version,
    sourceCarouselFingerprint: carouselFp,
    sourceCardCopyFingerprint: cardCopyFp,
    carousel,
    modelProfile: "instagram-visual-role-architect:fixture-seed",
    llm: vraFixture,
  });
  persistInstagramVisualRolePlan({ packageRoot: PKG, plan: vra });

  const bundlePath = join(PKG, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  const bundle = JSON.parse(readFileSync(bundlePath, "utf8")) as PublishableContentBundle;
  if (bundle.contract !== PUBLISHABLE_CONTENT_BUNDLE_CONTRACT) {
    throw new Error("bad bundle");
  }
  const ig = bundle.instagram!;
  const nextBundle: PublishableContentBundle = {
    ...bundle,
    instagram: {
      ...ig,
      instagramMeta: {
        ...ig.instagramMeta!,
        cardPlan: carousel.cards.map((c, i) => {
          const prev = ig.instagramMeta?.cardPlan?.[i];
          return {
            cardId: c.cardId,
            role: c.role,
            headline: cardCopy.cards[i]!.headline,
            body: cardCopy.cards[i]!.body ?? "",
            visualIntent: undefined,
            visual: undefined,
            ...(prev && "kicker" in prev ? {} : {}),
          };
        }),
      },
    },
  };
  overwritePackageArtifact({
    packageRoot: PKG,
    planned: {
      relativePath: PUBLISHABLE_CONTENT_RELATIVE_PATH,
      content: stableJsonBytes(nextBundle),
      kind: "context",
      origin: "pipeline_export",
      mediaType: "application/json",
    },
    createdAt: new Date().toISOString(),
  });

  const ids = carousel.cards.map((c) => c.cardId);
  const llmPlan = {
    strategySummary:
      "SVP v2 fixture seed (Hermes HTTP 401 blocked live invoke): 5 masters — Threads+hero share; bridge local/derivative; culture & architecture split for distinct subjects; closing mood optional. Respects VRA required/preferred/optional; no forced collapse.",
    decisionTrace: {
      overrides: [
        {
          cardId: ids[0],
          field: "reusePreference",
          requested: "exclusive_preferred",
          final: "shared_with_threads_slot0",
          reason: "Hero establishing is the Threads representative visual — cross-channel reuse, still exclusive among IG cards",
        },
      ],
    },
    visuals: [
      {
        role: "context_cover",
        visualMode: "editorial_photo",
        generatedVisualNeeded: true,
        visualIntent:
          "북부 산악 국경지대의 지형과 전통 흙다짐 주거 환경을 차분한 여행 에디토리얼 맥락으로 보여주는 wide contextual scene",
        usages: [
          { channel: "threads", slotIndex: 0 },
          { channel: "instagram", cardId: ids[0] },
        ],
      },
      {
        role: "bridge_statement",
        visualMode: "editorial_photo",
        generatedVisualNeeded: false,
        visualIntent:
          "산악으로 이어지는 능선 분위기 배경 — 텍스트가 주인공인 image-backed bridge (reuse/derivative of mountain establishing allowed)",
        usages: [{ channel: "instagram", cardId: ids[1] }],
      },
      {
        role: "cultural_context",
        visualMode: "editorial_photo",
        generatedVisualNeeded: true,
        visualIntent:
          "북부 국경 산악 마을 생활 공간 맥락 — 특정 간판·인물 식별 금지",
        usages: [{ channel: "instagram", cardId: ids[2] }],
      },
      {
        role: "architecture_detail",
        visualMode: "object_or_detail",
        generatedVisualNeeded: true,
        visualIntent:
          "판축(rammed-earth) 벽면·구조 디테일 close-up — nhà trình tường",
        usages: [{ channel: "instagram", cardId: ids[3] }],
      },
      {
        role: "closing_mood",
        visualMode: "minimal_closing",
        generatedVisualNeeded: false,
        visualIntent:
          "산악 지대 고요한 마감 분위기 — 휴양 프레임 밖 payoff mood treatment",
        usages: [{ channel: "instagram", cardId: ids[4] }],
      },
    ],
  };

  const vraFp = buildInstagramVisualRoleContentFingerprint(vra);
  const { plan, warnings } = materializeSharedVisualPlanFromLlm({
    bundle: nextBundle,
    llmRaw: llmPlan,
    forbiddenClaimsKo: asset.forbiddenClaimsKo ?? null,
    sourceInstagramVisualRoleFingerprint: vraFp,
    instagramVisualRolePlan: vra,
  });
  persistSharedVisualPlan({ packageRoot: PKG, plan });

  const reportPath = join(process.cwd(), "artifacts", "svp-v2-dao-live-report.json");
  mkdirSync(join(process.cwd(), "artifacts"), { recursive: true });
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        mode: "fixture_seed_hermes_401",
        note: "Live Hermes oneshot returned HTTP 401 unauthorized for all profiles; seeded editorial+VRA+SVP via acceptance fixtures + materialize validation.",
        packageRoot: PKG,
        warnings,
        vra: vra.cards.map((c) => ({
          cardId: c.cardId,
          visualRole: c.visualRole,
          visualDensity: c.visualDensity,
          generationPreference: c.generationPreference,
          visualModePreference: c.visualModePreference,
          presentationPreference: c.presentationPreference,
          reusePreference: c.reusePreference,
          concreteVisualIntent: c.concreteVisualIntent,
        })),
        svp: {
          masterCount: plan.visuals.length,
          strategySummary: plan.strategySummary,
          decisionTrace: plan.decisionTrace,
          visuals: plan.visuals.map((v) => ({
            visualId: v.visualId,
            role: v.role,
            visualMode: v.visualMode ?? null,
            generatedVisualNeeded: v.generatedVisualNeeded,
            usages: v.usages,
            visualIntent: v.visualIntent,
          })),
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log("seeded package:", PKG);
  console.log("report:", reportPath);
  console.log(
    "VRA:",
    vra.cards.map((c) => `${c.cardId}:${c.visualRole}/${c.generationPreference}`).join(", "),
  );
  console.log(
    "SVP:",
    plan.visuals
      .map(
        (v) =>
          `${v.visualId} gen=${v.generatedVisualNeeded} ${JSON.stringify(v.usages)}`,
      )
      .join("\n  "),
  );
}

main();
