import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";
import {
  INSTAGRAM_CAPTION_RELATIVE_PATH,
  INSTAGRAM_CARD_COPY_RELATIVE_PATH,
  INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/instagramEditorial/paths";
import { NAVER_BAND_COPY_RELATIVE_PATH } from "@/lib/marketing/publishable/naverBandCopy/paths";
import {
  NAVER_BLOG_COPY_RELATIVE_PATH,
  NAVER_BLOG_STRUCTURE_PLAN_RELATIVE_PATH,
} from "@/lib/marketing/publishable/naverBlogEditorial/paths";
import { THREADS_COPY_RELATIVE_PATH } from "@/lib/marketing/publishable/threadsCopy/paths";

export const CHANNEL_SOURCES_JSON_MEDIA_TYPE = "application/json" as const;
export const EXTERNAL_EDITORIAL_CANDIDATES_DIRECTORY = "context/channel-sources/external-editorial" as const;
export const HERMES_AUTO_SNAPSHOTS_DIRECTORY = "context/channel-sources/hermes-auto" as const;
export const CHANNEL_SOURCE_SELECTION_RELATIVE_PATH = "context/channel-source-selection.json" as const;

const IMPORT_ID_RE = /^xe_[0-9]{13}_[0-9a-f]{10}$/;

export function isValidExternalImportId(importId: string): boolean {
  return IMPORT_ID_RE.test(importId);
}

export function externalEditorialCandidateRelativePath(importId: string): string {
  if (!isValidExternalImportId(importId)) {
    throw new Error(`invalid external editorial importId: ${importId}`);
  }
  return `${EXTERNAL_EDITORIAL_CANDIDATES_DIRECTORY}/${importId}.json`;
}

export function hermesAutoSnapshotRelativePath(channel: PublishableChannel, snapshotId: string): string {
  return `${HERMES_AUTO_SNAPSHOTS_DIRECTORY}/${channel}/${snapshotId}.json`;
}

/** Specialist sidecars materialized per channel (Kakao/Shortform live only in the slot). */
export const CHANNEL_SIDECAR_RELATIVE_PATHS: Record<PublishableChannel, readonly string[]> = {
  threads: [THREADS_COPY_RELATIVE_PATH],
  instagram: [
    INSTAGRAM_CAROUSEL_PLAN_RELATIVE_PATH,
    INSTAGRAM_CARD_COPY_RELATIVE_PATH,
    INSTAGRAM_CAPTION_RELATIVE_PATH,
  ],
  naver_blog: [NAVER_BLOG_STRUCTURE_PLAN_RELATIVE_PATH, NAVER_BLOG_COPY_RELATIVE_PATH],
  naver_band: [NAVER_BAND_COPY_RELATIVE_PATH],
  kakao_channel: [],
  shortform: [],
};
