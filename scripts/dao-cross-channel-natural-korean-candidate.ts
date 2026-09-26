/**
 * Dao cross-channel Natural Korean + no-forced-abstract-synthesis review helper.
 *
 * Default: read existing package channel surfaces + scan patterns + contract wiring.
 * Does NOT overwrite production package artifacts.
 *
 *   npx tsx scripts/dao-cross-channel-natural-korean-candidate.ts
 *
 * Fresh channel regeneration is operator-driven after this PR lands — not run here.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import {
  CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN,
  CROSS_CHANNEL_NO_FORCED_ABSTRACT_SYNTHESIS_EN,
  CROSS_CHANNEL_REVIEW_SCAN_PATTERNS,
  countCrossChannelReviewPatternHits,
} from "@/lib/marketing/agentContracts/crossChannelNaturalKoreanSyntaxContract";
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { INSTAGRAM_CAPTION_WRITER_SOUL } from "@/lib/marketing/publishable/instagramEditorial/hermesIdentity";
import { NAVER_BAND_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/naverBandCopy/hermesIdentity";
import {
  NAVER_BLOG_COPY_WRITER_SOUL,
  NAVER_BLOG_STRUCTURE_PLANNER_SOUL,
} from "@/lib/marketing/publishable/naverBlogEditorial/hermesIdentity";
import { kakaoChannelWritingContract } from "@/lib/marketing/publishable/kakao_channel/writingContract";
import { SHORTFORM_NARRATION_WRITING_CONTRACT } from "@/lib/marketing/publishable/shortform/writingContract";
import { THREADS_COPY_WRITER_SOUL } from "@/lib/marketing/publishable/threadsCopy/hermesIdentity";

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

function closingTail(text: string, n = 2): string {
  const parts = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.slice(-n).join("\n");
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  const asset = readCanonicalAssetFromPackage(PKG);
  const bodies = channelBodies(PKG);
  const scans: Record<string, Record<string, number>> = {};
  const closingSnippets: Record<string, string> = {};
  for (const [ch, body] of Object.entries(bodies)) {
    scans[ch] = countCrossChannelReviewPatternHits(body);
    closingSnippets[ch] = closingTail(body, 2);
  }

  const wiring = {
    sharedNoForcedAbstractSynthesis:
      CROSS_CHANNEL_NATURAL_KOREAN_SYNTAX_CONTRACT_EN.includes(
        CROSS_CHANNEL_NO_FORCED_ABSTRACT_SYNTHESIS_EN,
      ),
    threadsSoulHasContract: /NATURAL KOREAN SYNTAX/.test(THREADS_COPY_WRITER_SOUL),
    threadsConcreteEnding: /concrete observation/.test(THREADS_COPY_WRITER_SOUL),
    captionSoulHasContract: /NATURAL KOREAN SYNTAX/.test(INSTAGRAM_CAPTION_WRITER_SOUL),
    blogStructureNoRequiredPerspectiveExpansion:
      /Do NOT require perspective expansion/.test(NAVER_BLOG_STRUCTURE_PLANNER_SOUL),
    blogSoulHasContract: /NATURAL KOREAN SYNTAX/.test(NAVER_BLOG_COPY_WRITER_SOUL),
    bandConcreteTakeaway: /One concrete takeaway or observation/.test(NAVER_BAND_COPY_WRITER_SOUL),
    kakaoArchetypeAware: /ARCHETYPE-AWARE CLOSE/.test(
      kakaoChannelWritingContract({ hasApprovedCanonicalAsset: true }),
    ),
    shortformConcreteArc: /hook → concrete fact\/context/.test(SHORTFORM_NARRATION_WRITING_CONTRACT),
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
    closingSnippetsForManualReview: closingSnippets,
    wiring,
    regenerationPrep: {
      productionOverwrite: false,
      freshCandidateReady: true,
      manualReviewChannels: [
        "threads",
        "instagram_caption",
        "instagram_card_copy",
        "naver_blog",
        "naver_band",
        "kakao_channel",
        "shortform",
      ],
      focus: "closing 1–2 sentences vs prior abstract synthesis",
    },
    note:
      "Qualitative scan only — zero-count is NOT required. Do NOT overwrite production package. Fresh LLM regen is operator-driven after merge/deploy.",
    liveGenerate: process.env.LIVE_GENERATE === "1" ? "requested_but_not_implemented_in_this_pr_default" : "skipped",
  };

  writeFileSync(join(OUT_DIR, "review-report.json"), `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Dao Cross-Channel — Natural Korean + No Forced Abstract Synthesis",
    "",
    `Package: \`${PKG}\``,
    "",
    "## Canonical",
    asset
      ? `- ${asset.titleKo} (v${asset.version}, ${asset.status})`
      : "- missing",
    "",
    "## Wiring (instruction readiness)",
    ...Object.entries(wiring).map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`),
    "",
    "## Channel surfaces scanned (existing — not overwritten)",
    ...Object.keys(bodies).map((ch) => `- ${ch} (${bodies[ch].length} chars)`),
    "",
    "## Closing tails (manual review focus)",
    ...Object.entries(closingSnippets).map(([ch, snip]) => `### ${ch}\n\`\`\`\n${snip}\n\`\`\``),
    "",
    "## Pattern hits (informational — not pass/fail)",
    ...Object.entries(scans).map(
      ([ch, hits]) =>
        `- **${ch}**: ${Object.entries(hits)
          .filter(([, n]) => n > 0)
          .map(([id, n]) => `${id}=${n}`)
          .join(", ") || "(none)"}`,
    ),
    "",
    "## Regeneration",
    "- Production package overwrite: **forbidden** in this PR",
    "- Fresh candidate generation: prepare after checks PASS; compare closing 1–2 sentences",
    "",
  ].join("\n");

  writeFileSync(join(OUT_DIR, "review-report.md"), md);
  console.log(JSON.stringify({ outDir: OUT_DIR, channels: Object.keys(bodies), wiring }, null, 2));
}

main();
