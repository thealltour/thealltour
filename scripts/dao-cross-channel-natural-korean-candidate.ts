/**
 * Dao cross-channel Natural Korean syntax review helper.
 *
 * Default: read existing package channel surfaces + scan patterns + contract wiring.
 * Does NOT overwrite production package artifacts.
 *
 *   npx tsx scripts/dao-cross-channel-natural-korean-candidate.ts
 *
 * Optional future: LIVE_GENERATE=1 can call channel writers (not required for this PR).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN,
  CROSS_CHANNEL_REVIEW_SCAN_PATTERNS,
  countCrossChannelReviewPatternHits,
} from "@/lib/marketing/agentContracts/crossChannelNaturalKoreanSyntaxContract";
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { NAVER_BAND_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/naverBandCopy/hermesIdentity";
import { NAVER_BLOG_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/naverBlogEditorial/hermesIdentity";
import { kakaoChannelWritingContract } from "@/lib/marketing/publishable/kakao_channel/writingContract";
import { SHORTFORM_NARRATION_WRITING_CONTRACT } from "@/lib/marketing/publishable/shortform/writingContract";

const PKG =
  process.env.DAO_PACKAGE_ROOT ??
  "/mnt/HDD2TB/marketing-assets/2026/09/18/cmc_daily_marketing_production_2026_09_18_e0";
const OUT_DIR = join(process.cwd(), "artifacts", "dao-cross-channel-natural-korean");

function readJson(path: string): unknown | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readText(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function channelBodies(pkg: string): Record<string, string> {
  const pub = readJson(join(pkg, "context/publishable-content.json")) as
    | Record<string, { body?: string } | undefined>
    | null;
  const out: Record<string, string> = {};
  for (const ch of ["threads", "instagram", "naver_blog", "naver_band", "kakao_channel", "shortform"]) {
    const body = pub?.[ch]?.body?.trim();
    if (body) out[ch] = body;
  }
  // Prefer specialist artifacts when present
  const blog = readJson(join(pkg, "context/naver-blog-copy.json")) as { bodyMarkdown?: string } | null;
  if (blog?.bodyMarkdown?.trim()) out.naver_blog = blog.bodyMarkdown;
  const band = readJson(join(pkg, "context/naver-band-copy.json")) as { body?: string } | null;
  if (band?.body?.trim()) out.naver_band = band.body;
  const threads = readJson(join(pkg, "context/threads-copy.json")) as { body?: string } | null;
  if (threads?.body?.trim()) out.threads = threads.body;
  const caption = readText(join(pkg, "copy/instagram-caption.txt"));
  if (caption?.trim()) out.instagram_caption = caption.trim();
  return out;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const asset = readCanonicalAssetFromPackage(PKG);
  const bodies = channelBodies(PKG);
  const scans: Record<string, Record<string, number>> = {};
  for (const [ch, body] of Object.entries(bodies)) {
    scans[ch] = countCrossChannelReviewPatternHits(body);
  }

  const wiring = {
    blogSoulHasContract: /NATURAL KOREAN SYNTAX/.test(NAVER_BLOG_COPY_WRITER_SOUL),
    bandSoulHasContract: /NATURAL KOREAN SYNTAX/.test(NAVER_BAND_COPY_WRITER_SOUL),
    kakaoContractHas: /NATURAL KOREAN SYNTAX/.test(
      kakaoChannelWritingContract({ hasApprovedCanonicalAsset: true }),
    ),
    shortformContractHas: /NATURAL KOREAN SYNTAX/.test(SHORTFORM_NARRATION_WRITING_CONTRACT),
    sharedContractChars: CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN.length,
    reviewPatterns: CROSS_CHANNEL_REVIEW_SCAN_PATTERNS.map((p) => p.id),
  };

  const report = {
    packageRoot: PKG,
    canonical: asset
      ? {
          assetId: asset.assetId,
          version: asset.version,
          status: asset.status,
          titleKo: asset.titleKo,
          bodyHead: asset.bodyKo.slice(0, 180),
        }
      : null,
    channelsPresent: Object.keys(bodies),
    patternScans: scans,
    wiring,
    note:
      "Qualitative scan only — zero-count is NOT required. Fresh LLM generation left for operator LIVE_GENERATE (not run by default; no production overwrite).",
    liveGenerate: process.env.LIVE_GENERATE === "1" ? "requested_but_not_implemented_in_this_pr_default" : "skipped",
  };

  writeFileSync(join(OUT_DIR, "review-report.json"), `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Dao Cross-Channel Natural Korean — Review Report",
    "",
    `Package: \`${PKG}\``,
    "",
    "## Canonical",
    asset
      ? `- ${asset.titleKo} (v${asset.version}, ${asset.status})`
      : "- missing",
    "",
    "## Channel surfaces scanned",
    ...Object.keys(bodies).map((ch) => `- ${ch} (${bodies[ch].length} chars)`),
    "",
    "## Pattern hits (informational — not pass/fail)",
    "",
    "| channel | " + CROSS_CHANNEL_REVIEW_SCAN_PATTERNS.map((p) => p.id).join(" | ") + " |",
    "|---|---" + CROSS_CHANNEL_REVIEW_SCAN_PATTERNS.map(() => "").join("|---") + "|",
    ...Object.entries(scans).map(([ch, hits]) => {
      return `| ${ch} | ${CROSS_CHANNEL_REVIEW_SCAN_PATTERNS.map((p) => hits[p.id] ?? 0).join(" | ")} |`;
    }),
    "",
    "## Contract wiring",
    `- Blog SOUL: ${wiring.blogSoulHasContract}`,
    `- Band SOUL: ${wiring.bandSoulHasContract}`,
    `- Kakao writing contract: ${wiring.kakaoContractHas}`,
    `- Shortform writing contract: ${wiring.shortformContractHas}`,
    "",
    "Production overwrite: **not performed**.",
    "",
  ].join("\n");
  writeFileSync(join(OUT_DIR, "review-report.md"), md);
  console.log(JSON.stringify({ outDir: OUT_DIR, channels: Object.keys(bodies), wiring }, null, 2));
}

main();
