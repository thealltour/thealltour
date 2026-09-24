/**
 * One-shot Dao live regen: Carousel → Card Copy → VRA → SVP v2 (Hermes).
 * Usage: npx tsx scripts/dao-svp-v2-live-regen.ts
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { invokeHermesProfileAsync } from "@/lib/marketing/cron/invokeHermesProfileAsync";
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { readEditorialNarrativePlanFromPackage } from "@/lib/marketing/publishable/instagramEditorial/persist";
import {
  INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
  INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";
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
  readInstagramCardCopyFromPackage,
  readInstagramCarouselPlanFromPackage,
} from "@/lib/marketing/publishable/instagramEditorial/persist";
import { ensureInstagramEditorialHermesProfilesReady } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import { ensureInstagramVisualRolePlan } from "@/lib/marketing/publishable/instagramVisualRole/pipeline";
import { ensureInstagramVisualRoleArchitectHermesReady } from "@/lib/marketing/publishable/instagramVisualRole/hermesIdentity";
import { readInstagramVisualRolePlanFromPackage } from "@/lib/marketing/publishable/instagramVisualRole/persist";
import {
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { generateSharedVisualPlanWithLlm } from "@/lib/marketing/publishable/visualOrchestration/generateSharedVisualPlan";
import {
  ensureSharedVisualPlannerHermesReady,
  SHARED_VISUAL_PLANNER_HERMES_PROFILE,
} from "@/lib/marketing/publishable/visualOrchestration/hermesIdentity";
import { readSharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan";
import { overwritePackageArtifact } from "@/lib/marketing/assets/writeArtifact";
import { stableJsonBytes } from "@/lib/marketing/assets/hashing";

const PKG =
  process.env.DAO_PACKAGE_ROOT ??
  "/mnt/HDD2TB/marketing-assets/2026/09/18/cmc_daily_marketing_production_2026_09_18_e0";

const TIMEOUT_MS = Number(process.env.HERMES_TIMEOUT_MS ?? 360_000);

function extractJson(raw: string): unknown {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  return JSON.parse(t.slice(start, end + 1));
}

async function hermesJson(profile: string, text: string): Promise<unknown> {
  const raw = await invokeHermesProfileAsync(profile, text, TIMEOUT_MS);
  return extractJson(raw);
}

function readBundle(packageRoot: string): PublishableContentBundle {
  const path = join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  const raw = JSON.parse(readFileSync(path, "utf8")) as PublishableContentBundle;
  if (raw.contract !== PUBLISHABLE_CONTENT_BUNDLE_CONTRACT) {
    throw new Error("bad_publishable_contract");
  }
  return raw;
}

function syncPublishableCardIds(
  packageRoot: string,
  bundle: PublishableContentBundle,
  cardIds: string[],
): PublishableContentBundle {
  const ig = bundle.instagram;
  if (!ig?.instagramMeta?.cardPlan) return bundle;
  const nextCards = cardIds.map((cardId, i) => {
    const prev = ig.instagramMeta!.cardPlan![i] ?? ig.instagramMeta!.cardPlan![0]!;
    return {
      ...prev,
      cardId,
      // Strip legacy visual.* so SVP uses VRA semantics
      visual: undefined,
      visualIntent: undefined,
    };
  });
  const next: PublishableContentBundle = {
    ...bundle,
    instagram: {
      ...ig,
      instagramMeta: {
        ...ig.instagramMeta!,
        cardPlan: nextCards,
      },
    },
  };
  overwritePackageArtifact({
    packageRoot,
    planned: {
      relativePath: PUBLISHABLE_CONTENT_RELATIVE_PATH,
      content: stableJsonBytes(next),
      kind: "context",
      origin: "pipeline_export",
      mediaType: "application/json",
    },
    createdAt: new Date().toISOString(),
  });
  return next;
}

async function main() {
  console.log("DAO package:", PKG);
  if (!existsSync(PKG)) throw new Error(`package missing: ${PKG}`);

  const asset = readCanonicalAssetFromPackage(PKG);
  if (!asset) throw new Error("canonical missing");
  const narrative = readEditorialNarrativePlanFromPackage(PKG);
  if (!narrative) throw new Error("editorial-narrative-plan missing");

  ensureInstagramEditorialHermesProfilesReady();
  ensureInstagramVisualRoleArchitectHermesReady();
  ensureSharedVisualPlannerHermesReady();

  let carousel = readInstagramCarouselPlanFromPackage(PKG);
  if (!carousel) {
    console.log("→ generating Instagram Carousel Plan via Hermes…");
    const narrativeFp = buildEditorialNarrativeContentFingerprint(narrative);
    const llm = await hermesJson(
      INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
      [
        "Return ONLY valid JSON matching your SOUL schema.",
        "=== INPUT_JSON ===",
        JSON.stringify({
          task: "instagram_carousel_plan",
          editorialNarrativePlan: {
            narrativePromise: narrative.narrativePromise,
            audienceTakeaway: narrative.audienceTakeaway,
            beats: narrative.beats,
          },
          constraints: { minCards: 4, maxCards: 6 },
        }),
      ].join("\n"),
    );
    carousel = materializeInstagramCarouselPlan({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceNarrativeFingerprint: narrativeFp,
      modelProfile: INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
      validBeatIds: new Set(narrative.beats.map((b) => b.beatId)),
      minCards: 4,
      maxCards: 6,
      llm,
    });
    persistInstagramCarouselPlan({ packageRoot: PKG, plan: carousel });
    console.log(
      "carousel cards:",
      carousel.cards.map((c) => `${c.cardId}:${c.role}:${c.visualPriority}`).join(", "),
    );
  } else {
    console.log("carousel: reused");
  }

  let cardCopy = readInstagramCardCopyFromPackage(PKG);
  if (!cardCopy) {
    console.log("→ generating Instagram Card Copy via Hermes…");
    const carouselFp = buildInstagramCarouselContentFingerprint(carousel);
    const llm = await hermesJson(
      INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
      [
        "Return ONLY valid JSON matching your SOUL schema. cards[] must match carousel cardIds.",
        "=== INPUT_JSON ===",
        JSON.stringify({
          task: "instagram_card_copy",
          instagramCarouselPlan: {
            cards: carousel.cards.map((c) => ({
              cardId: c.cardId,
              role: c.role,
              communicationGoal: c.communicationGoal,
              beatIds: c.beatIds,
            })),
          },
          canonicalAsset: {
            titleKo: asset.titleKo,
            openingHookKo: asset.openingHookKo,
            bodyKo: (asset.bodyKo ?? "").slice(0, 2000),
            forbiddenClaimsKo: asset.forbiddenClaimsKo,
          },
        }),
      ].join("\n"),
    );
    cardCopy = materializeInstagramCardCopy({
      assetId: asset.assetId,
      assetVersion: asset.version,
      sourceCarouselFingerprint: carouselFp,
      modelProfile: INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
      expectedCardIds: carousel.cards.map((c) => c.cardId),
      llm,
    });
    persistInstagramCardCopy({ packageRoot: PKG, copy: cardCopy });
    console.log(
      "card copy:",
      cardCopy.cards.map((c) => `${c.cardId}:${c.headline}`).join(" | "),
    );
  } else {
    console.log("card copy: reused");
  }

  // Align publishable cardIds with editorial (strip legacy visual.*)
  let bundle = syncPublishableCardIds(
    PKG,
    readBundle(PKG),
    carousel.cards.map((c) => c.cardId),
  );

  console.log("→ ensuring Visual Role Plan via Hermes…");
  const vraResult = await ensureInstagramVisualRolePlan({
    packageRoot: PKG,
    approvedCanonicalAsset: asset,
    editorialNarrativePlan: narrative,
    carousel,
    cardCopy,
    forceRegenerate: true,
    invoke: async (prompt) =>
      invokeHermesProfileAsync(prompt.hermesProfile, prompt.text, TIMEOUT_MS),
  });
  if (!vraResult.ok) {
    throw new Error(`VRA failed: ${vraResult.error.code} ${vraResult.error.message}`);
  }
  const vra = vraResult.plan;
  console.log("VRA status:", vraResult.status);
  console.log(
    "VRA cards:",
    vra.cards
      .map(
        (c) =>
          `${c.cardId} ${c.visualRole}/${c.visualDensity}/${c.generationPreference}/${c.presentationPreference}`,
      )
      .join("\n  "),
  );

  console.log("→ generating Shared Visual Plan v2 via Hermes…");
  const svp = await generateSharedVisualPlanWithLlm({
    packageRoot: PKG,
    bundle,
    approvedCanonicalAsset: asset,
    invoke: (prompt) =>
      invokeHermesProfileAsync(SHARED_VISUAL_PLANNER_HERMES_PROFILE, prompt, TIMEOUT_MS),
    invokeVisualRoleArchitect: async (prompt) =>
      invokeHermesProfileAsync(prompt.hermesProfile, prompt.text, TIMEOUT_MS),
  });
  if (!svp.ok) {
    throw new Error(`SVP failed: ${svp.error.code} ${svp.error.message}`);
  }
  console.log("visualRolePlanStatus:", svp.visualRolePlanStatus);

  const plan = svp.plan;
  console.log("SVP masters:", plan.visuals.length);
  console.log("strategySummary:", (plan.strategySummary ?? "").slice(0, 400));
  console.log("decisionTrace:", JSON.stringify(plan.decisionTrace ?? null, null, 2));
  for (const v of plan.visuals) {
    console.log(
      `- ${v.visualId} role=${v.role} mode=${v.visualMode ?? "-"} gen=${v.generatedVisualNeeded} usages=${JSON.stringify(v.usages)}`,
    );
    console.log(`  intent: ${v.visualIntent.slice(0, 140)}`);
  }

  // Write a small report beside package for the PR
  const reportDir = join(PKG, "context");
  mkdirSync(reportDir, { recursive: true });
  const reportPath = join(process.cwd(), "artifacts", "svp-v2-dao-live-report.json");
  mkdirSync(join(process.cwd(), "artifacts"), { recursive: true });
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        packageRoot: PKG,
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
          decisionTrace: plan.decisionTrace ?? null,
          visuals: plan.visuals,
        },
        diskVra: Boolean(readInstagramVisualRolePlanFromPackage(PKG)),
        diskSvp: Boolean(readSharedVisualPlan(PKG)),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log("report:", reportPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
