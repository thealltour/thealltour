/**
 * Persist channel human edits into package publishable bundle + human-edited/ path.
 * Does not regenerate content or rerun research.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { MARKETING_ASSET_HUMAN_EDITED_DIRECTORY, resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  formatForChannel,
  type PublishableChannel,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { validatePublishableText } from "@/lib/marketing/publishable/validate";
import {
  humanEditedRelativePath,
  type ReviewablePublishableChannel,
} from "@/lib/marketing/review/channelReviews";

function tryReadBundle(packageRoot: string): PublishableContentBundle | null {
  const path = join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as PublishableContentBundle;
    if (raw?.contract !== PUBLISHABLE_CONTENT_BUNDLE_CONTRACT) return null;
    return raw;
  } catch {
    return null;
  }
}

function toPublishableChannel(channel: ReviewablePublishableChannel): PublishableChannel | null {
  if (channel === "shortform") return "shortform";
  if (channel === "threads") return "threads";
  if (channel === "naver_blog") return "naver_blog";
  if (channel === "naver_band") return "naver_band";
  if (channel === "kakao_channel") return "kakao_channel";
  return null;
}

export function persistChannelHumanEditToPackage(input: {
  candidate: CompletedMarketingCandidate;
  channel: ReviewablePublishableChannel;
  title: string | null;
  body: string;
  now?: Date;
}): { ok: boolean; reason?: string } {
  if (input.channel === "shortform") {
    // Narration human-edit export only; do not mutate rendered READY artifact.
    try {
      const assetRoot = resolveMarketingAssetRoot({});
      const packageRoot = resolvePackageDirectory({
        assetRoot,
        businessDateKst: input.candidate.businessDateKst,
        candidateId: input.candidate.candidateId,
      });
      const rel = humanEditedRelativePath("shortform");
      const abs = join(packageRoot, rel);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, `${input.body.trim()}\n`, "utf8");
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "persist_failed" };
    }
  }

  try {
    const assetRoot = resolveMarketingAssetRoot({});
    const packageRoot = resolvePackageDirectory({
      assetRoot,
      businessDateKst: input.candidate.businessDateKst,
      candidateId: input.candidate.candidateId,
    });
    const bundle = tryReadBundle(packageRoot);
    if (!bundle) return { ok: false, reason: "publishable_bundle_missing" };

    const pubChannel = toPublishableChannel(input.channel);
    if (!pubChannel) return { ok: false, reason: "unsupported_channel" };

    const nowIso = (input.now ?? new Date()).toISOString();
    const validation = validatePublishableText(input.body, {
      channel: pubChannel,
      title: input.title,
      allowHeadings: pubChannel === "naver_blog",
    });

    const prev =
      pubChannel === "threads"
        ? bundle.threads
        : pubChannel === "shortform"
          ? bundle.shortform
          : bundle[pubChannel];

    const nextContent = {
      contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
      channel: pubChannel,
      format: formatForChannel(pubChannel),
      title: input.title,
      body: input.body,
      status: "human_edited" as const,
      generatedAt: nowIso,
      sourceCandidateId: input.candidate.candidateId,
      sourceRevision: bundle.sourceRevision,
      selectedAngleRef: prev?.selectedAngleRef ?? null,
      researchBriefRef: prev?.researchBriefRef ?? null,
      provenance: {
        composer: "human" as const,
        evidenceRefIds: prev?.provenance.evidenceRefIds ?? [],
        commercialIntent:
          prev?.provenance.commercialIntent ?? input.candidate.contentAssignment.commercialIntent,
      },
      validation,
      narrationSegments: prev && "narrationSegments" in prev ? prev.narrationSegments : undefined,
      blogMeta: prev && "blogMeta" in prev ? prev.blogMeta : undefined,
    };

    const nextBundle: PublishableContentBundle = {
      ...bundle,
      generatedAt: nowIso,
      threads: pubChannel === "threads" ? nextContent : bundle.threads,
      shortform: pubChannel === "shortform" ? nextContent : bundle.shortform,
      ...(pubChannel === "naver_blog" ? { naver_blog: nextContent } : {}),
      ...(pubChannel === "naver_band" ? { naver_band: nextContent } : {}),
      ...(pubChannel === "kakao_channel" ? { kakao_channel: nextContent } : {}),
    };

    writeFileSync(
      join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH),
      `${JSON.stringify(nextBundle, null, 2)}\n`,
      "utf8",
    );

    const humanPath = join(packageRoot, humanEditedRelativePath(input.channel));
    mkdirSync(dirname(humanPath), { recursive: true });
    mkdirSync(join(packageRoot, MARKETING_ASSET_HUMAN_EDITED_DIRECTORY), { recursive: true });
    const exportText =
      input.channel === "naver_blog" && input.title
        ? input.body.startsWith("#")
          ? input.body
          : `# ${input.title}\n\n${input.body}`
        : input.body;
    writeFileSync(humanPath, `${exportText.trim()}\n`, "utf8");

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "persist_failed" };
  }
}
