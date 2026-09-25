/**
 * Force-regenerate Dao Instagram Card Copy only (reuse Narrative/Carousel).
 * Writes comparison under artifacts/ — does not overwrite production package by default.
 *
 *   npx tsx scripts/dao-card-copy-natural-korean-candidate.ts
 *   WRITE_PACKAGE=1 npx tsx scripts/dao-card-copy-natural-korean-candidate.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { invokeHermesProfileAsync } from "@/lib/marketing/cron/invokeHermesProfileAsync";
import {
  buildInstagramCardCopyWriterPayload,
  buildInstagramCardCopyWriterUserPrompt,
} from "@/lib/marketing/publishable/instagramEditorial/cardCopyPrompt";
import { INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE } from "@/lib/marketing/publishable/instagramEditorial/contracts";
import { buildInstagramCarouselContentFingerprint } from "@/lib/marketing/publishable/instagramEditorial/fingerprint";
import { ensureInstagramEditorialHermesProfilesReady } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import { materializeInstagramCardCopy } from "@/lib/marketing/publishable/instagramEditorial/materialize";
import {
  persistInstagramCardCopy,
  readEditorialNarrativePlanFromPackage,
  readInstagramCardCopyFromPackage,
  readInstagramCarouselPlanFromPackage,
} from "@/lib/marketing/publishable/instagramEditorial/persist";
import {
  DAO_CARD_COPY_OLD_PROBLEM_PHRASES,
  countProblemPhraseHits,
  scoreAbstractionCluster,
} from "@/lib/marketing/publishable/instagramEditorial/__tests__/fixtures/daoCardCopyNaturalKorean";

const PKG =
  process.env.DAO_PACKAGE_ROOT ??
  "/mnt/HDD2TB/marketing-assets/2026/09/18/cmc_daily_marketing_production_2026_09_18_e0";
const TIMEOUT_MS = Number(process.env.HERMES_TIMEOUT_MS ?? 360_000);
const OUT_DIR = join(process.cwd(), "artifacts", "dao-card-copy-natural-korean");

function extractJson(raw: string): unknown {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  return JSON.parse(t.slice(start, end + 1));
}

function clip(text: string | null | undefined, max: number): string | null {
  const t = (text ?? "").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

async function main(): Promise<void> {
  mkdirSync(OUT_DIR, { recursive: true });
  ensureInstagramEditorialHermesProfilesReady();

  const asset = readCanonicalAssetFromPackage(PKG);
  const narrative = readEditorialNarrativePlanFromPackage(PKG);
  const carousel = readInstagramCarouselPlanFromPackage(PKG);
  const oldCopy = readInstagramCardCopyFromPackage(PKG);
  if (!asset || !narrative || !carousel || !oldCopy) {
    throw new Error("missing Dao editorial artifacts");
  }

  const payload = buildInstagramCardCopyWriterPayload({
    narrative,
    carousel,
    canonicalAsset: {
      assetId: asset.assetId,
      titleKo: asset.titleKo,
      openingHookKo: clip(asset.openingHookKo, 400),
      bodyKo: clip(asset.bodyKo, 2400),
      keyTakeawaysKo: asset.keyTakeawaysKo,
      supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo,
      forbiddenClaimsKo: asset.forbiddenClaimsKo,
    },
  });
  const user = buildInstagramCardCopyWriterUserPrompt(payload);

  console.log("→ invoking Card Copy Writer (natural Korean contract)…");
  const raw = await invokeHermesProfileAsync(
    INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
    user,
    TIMEOUT_MS,
  );
  const llm = extractJson(raw);
  const fresh = materializeInstagramCardCopy({
    assetId: asset.assetId,
    assetVersion: asset.version,
    sourceCarouselFingerprint: buildInstagramCarouselContentFingerprint(carousel),
    modelProfile: INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
    expectedCardIds: carousel.cards.map((c) => c.cardId),
    llm,
  });

  const oldSurface = {
    cards: oldCopy.cards.map((c) => ({
      cardId: c.cardId,
      headline: c.headline,
      body: c.body ?? "",
    })),
  };
  const freshSurface = {
    cards: fresh.cards.map((c) => ({
      cardId: c.cardId,
      headline: c.headline,
      body: c.body ?? "",
    })),
  };

  const report = {
    packageRoot: PKG,
    generatedAt: new Date().toISOString(),
    oldProblemHits: countProblemPhraseHits(oldSurface),
    freshProblemHits: countProblemPhraseHits(freshSurface),
    oldAbstractionScore: scoreAbstractionCluster(oldSurface),
    freshAbstractionScore: scoreAbstractionCluster(freshSurface),
    problemPhrases: DAO_CARD_COPY_OLD_PROBLEM_PHRASES,
    perCard: freshSurface.cards.map((c, i) => ({
      cardId: c.cardId,
      oldHeadline: oldSurface.cards[i]?.headline,
      freshHeadline: c.headline,
      oldBody: oldSurface.cards[i]?.body,
      freshBody: c.body,
      freshProblemHits: DAO_CARD_COPY_OLD_PROBLEM_PHRASES.filter((p) =>
        `${c.headline} ${c.body}`.includes(p),
      ),
    })),
  };

  writeFileSync(join(OUT_DIR, "fresh-card-copy.json"), JSON.stringify(fresh, null, 2));
  writeFileSync(join(OUT_DIR, "comparison-report.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(OUT_DIR, "comparison-report.md"),
    [
      "# Dao Card Copy Natural Korean Candidate",
      "",
      `- old problem hits: ${report.oldProblemHits}`,
      `- fresh problem hits: ${report.freshProblemHits}`,
      `- old abstraction score: ${report.oldAbstractionScore}`,
      `- fresh abstraction score: ${report.freshAbstractionScore}`,
      "",
      ...report.perCard.flatMap((row) => [
        `## ${row.cardId}`,
        `- old HL: ${row.oldHeadline}`,
        `- fresh HL: ${row.freshHeadline}`,
        `- old body: ${row.oldBody}`,
        `- fresh body: ${row.freshBody}`,
        `- leftover problem phrases: ${row.freshProblemHits.join(", ") || "(none)"}`,
        "",
      ]),
    ].join("\n"),
  );

  if (process.env.WRITE_PACKAGE === "1") {
    persistInstagramCardCopy({ packageRoot: PKG, copy: fresh });
    console.log("wrote package instagram-card-copy.json");
  } else {
    console.log("package untouched (set WRITE_PACKAGE=1 to persist)");
  }
  console.log("report:", join(OUT_DIR, "comparison-report.md"));
  console.log(JSON.stringify({
    oldProblemHits: report.oldProblemHits,
    freshProblemHits: report.freshProblemHits,
    oldAbstractionScore: report.oldAbstractionScore,
    freshAbstractionScore: report.freshAbstractionScore,
  }));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
