import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { jsonContainsForbiddenBotLeak, stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";
import type { AssignmentEvidenceRef } from "@/lib/marketing/content/types";
import type { CardNewsCard, MarketingAssetArtifact, MarketingAssetManifest, MediaBrief } from "@/lib/marketing/assets/contracts";
import { MARKETING_ASSET_MANIFEST_CONTRACT } from "@/lib/marketing/assets/contracts";
import {
  CARDNEWS_ASPECT_RATIO,
  CARDNEWS_FONT_FAMILY,
  CARDNEWS_HEIGHT,
  CARDNEWS_MEDIA_TYPE,
  CARDNEWS_RENDER_CONTRACT,
  CARDNEWS_RENDERER_VERSION,
  CARDNEWS_SAFE,
  CARDNEWS_WIDTH,
} from "@/lib/marketing/assets/cardnews/brand";
import { encodeLocalVisualDataUri, rasterizeCardNewsSvg } from "@/lib/marketing/assets/cardnews/raster";
import { buildCardNewsSvg, loadWordmarkDataUri, type CardCitation, type CardRenderModel } from "@/lib/marketing/assets/cardnews/svg";
import { fitText } from "@/lib/marketing/assets/cardnews/textLayout";
import { assertLocalVisualPath, readLocalVisualPng } from "@/lib/marketing/assets/cardnews/visuals";
import { resolveMarketingAssetRoot, type MarketingAssetEnv } from "@/lib/marketing/assets/config";
import {
  CardNewsNotApplicableError,
  CardNewsVisualError,
  MarketingAssetContractError,
} from "@/lib/marketing/assets/errors";
import { sha256Buffer, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { parseMarketingAssetManifest, parseMediaBrief } from "@/lib/marketing/assets/parse";
import {
  MARKETING_ASSET_GENERATED_DIRECTORIES,
  MARKETING_ASSET_HUMAN_EDITED_DIRECTORY,
  MARKETING_ASSET_PUBLISHED_DIRECTORY,
  ensurePackageLayout,
  resolvePackageDirectory,
  resolvePackageRelativePath,
} from "@/lib/marketing/assets/paths";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import {
  assertPackageArtifactWritable,
  describePlannedArtifact,
  writePackageArtifact,
  type PlannedPackageArtifact,
} from "@/lib/marketing/assets/writeArtifact";

export type CardNewsRenderCardMeta = {
  cardIndex: number;
  cardRole: CardNewsCard["role"];
  sourceBriefCardId: string;
  relativePath: string;
  width: number;
  height: number;
  mediaType: typeof CARDNEWS_MEDIA_TYPE;
  sha256: string;
  byteSize: number;
  visualAssetId: string | null;
  fontFamily: typeof CARDNEWS_FONT_FAMILY;
  headlineFontSize: number;
  bodyFontSize: number;
};

export type CardNewsRenderDocument = {
  contract: typeof CARDNEWS_RENDER_CONTRACT;
  rendererVersion: typeof CARDNEWS_RENDERER_VERSION;
  width: number;
  height: number;
  aspectRatio: typeof CARDNEWS_ASPECT_RATIO;
  mediaType: typeof CARDNEWS_MEDIA_TYPE;
  fontFamily: typeof CARDNEWS_FONT_FAMILY;
  fontFallback: [typeof CARDNEWS_FONT_FAMILY];
  wordmark: "thealltour_logo_trp.png" | "text:thealltour";
  graphicOnly: boolean;
  cards: CardNewsRenderCardMeta[];
};

export type RenderCardNewsPackageInput = {
  mediaBrief: MediaBrief;
  assetRoot?: string | null;
  env?: MarketingAssetEnv;
  dryRun?: boolean;
  graphicOnly?: boolean;
  visuals?: Record<string, string>;
  allowedVisualRoots?: string[];
  now?: Date;
};

export type RenderCardNewsPackageResult = {
  status: "rendered" | "not_applicable";
  reason?: "cardnews_disabled" | "no_cards";
  dryRun: boolean;
  wrote: boolean;
  reused: boolean;
  packageId: string;
  packageRoot: string;
  relativePackagePath: string;
  candidateId: string;
  businessDateKst: string;
  plannedRelativePaths: string[];
  artifacts: MarketingAssetArtifact[];
  manifest: MarketingAssetManifest | null;
  render: CardNewsRenderDocument | null;
};

const ROLE_KICKER: Record<CardNewsCard["role"], string> = {
  cover: "표지",
  information: "안내",
  evidence: "근거",
  cta: "다음 단계",
};

function cardRelativePath(index: number): string {
  return `cardnews/card-${String(index).padStart(2, "0")}.png`;
}

function evidenceCatalog(brief: MediaBrief): Map<string, AssignmentEvidenceRef> {
  return new Map(brief.evidenceRefs.map((ref) => [ref.evidenceId, ref]));
}

function hostnameFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}

function citationForCard(card: CardNewsCard, catalog: Map<string, AssignmentEvidenceRef>): CardCitation | null {
  const linked = card.evidenceRefs
    .map((id) => catalog.get(id))
    .filter((ref): ref is AssignmentEvidenceRef => ref != null);
  if (linked.length === 0) return null;
  const primary = linked[0];
  const label = primary.sourceName?.trim() || primary.sourceType?.trim() || "출처";
  const when = primary.publishedAt?.slice(0, 10) || primary.observedAt.slice(0, 10);
  const host = hostnameFromUrl(primary.url);
  const detail = [host, when].filter(Boolean).join(" · ");
  return { label, detail: detail || label };
}

function preferredSizes(role: CardNewsCard["role"]): { headline: number; body: number } {
  switch (role) {
    case "cover":
      return { headline: 58, body: 32 };
    case "cta":
      return { headline: 50, body: 30 };
    case "evidence":
      return { headline: 44, body: 30 };
    default:
      return { headline: 46, body: 30 };
  }
}

function buildRenderModel(input: {
  card: CardNewsCard;
  index: number;
  total: number;
  citation: CardCitation | null;
  visualDataUri: string | null;
  wordmarkDataUri: string | null;
}): CardRenderModel {
  const sizes = preferredSizes(input.card.role);
  const textWidth = CARDNEWS_WIDTH - CARDNEWS_SAFE.padX * 2;
  const hasVisual = Boolean(input.visualDataUri);
  const headlineMaxHeight = hasVisual ? 180 : 240;
  const bodyMaxHeight = hasVisual ? 240 : 360;
  const headline = fitText({
    text: input.card.headline,
    preferredFontSize: sizes.headline,
    minFontSize: CARDNEWS_SAFE.minHeadlinePx,
    maxWidth: textWidth,
    maxHeight: headlineMaxHeight,
    maxLines: input.card.role === "cover" ? 4 : 5,
    overflow: "error",
    cardId: input.card.cardId,
    field: "headline",
  });
  const body = fitText({
    text: input.card.body,
    preferredFontSize: sizes.body,
    minFontSize: CARDNEWS_SAFE.minBodyPx,
    maxWidth: textWidth,
    maxHeight: bodyMaxHeight,
    maxLines: input.card.role === "cta" ? 6 : 8,
    overflow: input.card.role === "cta" ? "ellipsis" : "error",
    cardId: input.card.cardId,
    field: "body",
  });
  return {
    cardId: input.card.cardId,
    role: input.card.role,
    index: input.index,
    total: input.total,
    kicker: `${String(input.index).padStart(2, "0")}  ${ROLE_KICKER[input.card.role]}`,
    headline,
    body,
    citation: input.citation,
    visualDataUri: input.visualDataUri,
    wordmarkDataUri: input.wordmarkDataUri,
  };
}

async function resolveVisualDataUri(input: {
  card: CardNewsCard;
  graphicOnly: boolean;
  visuals: Record<string, string>;
  allowedVisualRoots: string[];
}): Promise<{ dataUri: string | null; visualAssetId: string | null }> {
  if (input.graphicOnly) return { dataUri: null, visualAssetId: null };
  const raw = input.visuals[input.card.cardId];
  if (!raw) return { dataUri: null, visualAssetId: null };
  const absolute = assertLocalVisualPath({ rawPath: raw, allowedRoots: input.allowedVisualRoots });
  const png = readLocalVisualPng(absolute);
  return {
    dataUri: await encodeLocalVisualDataUri(png),
    visualAssetId: `local:${input.card.cardId}`,
  };
}

function readExistingManifest(packageRoot: string): MarketingAssetManifest | null {
  const path = join(packageRoot, "manifest.json");
  if (!existsSync(path)) return null;
  return parseMarketingAssetManifest(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

function mergeArtifacts(
  existing: MarketingAssetArtifact[],
  incoming: MarketingAssetArtifact[],
): MarketingAssetArtifact[] {
  const map = new Map(existing.map((item) => [item.relativePath, item]));
  for (const item of incoming) map.set(item.relativePath, item);
  return [...map.values()].sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function artifactsMatch(left: MarketingAssetArtifact[], right: MarketingAssetArtifact[]): boolean {
  if (left.length !== right.length) return false;
  const byPath = new Map(left.map((item) => [item.relativePath, item.sha256]));
  return right.every((item) => byPath.get(item.relativePath) === item.sha256);
}

function integrityDigest(artifacts: MarketingAssetArtifact[]): string {
  const lines = [...artifacts]
    .map((artifact) => `${artifact.relativePath}:${artifact.sha256}`)
    .sort((left, right) => left.localeCompare(right));
  return sha256Buffer(lines.join("\n"));
}

function assertClean(value: unknown): void {
  const cleaned = stripForbiddenBotData(value);
  if (jsonContainsForbiddenBotLeak(cleaned)) {
    throw new MarketingAssetContractError("cardnews render metadata contained forbidden secret fields");
  }
}

export async function renderCardNewsPackage(
  input: RenderCardNewsPackageInput,
): Promise<RenderCardNewsPackageResult> {
  const brief = parseMediaBrief(input.mediaBrief);
  const assetRoot = resolveMarketingAssetRoot({ explicitRoot: input.assetRoot, env: input.env });
  const packageRoot = resolvePackageDirectory({
    assetRoot,
    businessDateKst: brief.businessDateKst,
    candidateId: brief.candidateId,
  });
  const relativePackagePath = resolvePackageRelativePath({
    assetRoot,
    businessDateKst: brief.businessDateKst,
    candidateId: brief.candidateId,
  });
  const packageId = `map_${brief.candidateId}`;
  const base = {
    packageId,
    packageRoot,
    relativePackagePath,
    candidateId: brief.candidateId,
    businessDateKst: brief.businessDateKst,
  };

  if (!brief.formats.cardnews.enabled) {
    return {
      status: "not_applicable",
      reason: "cardnews_disabled",
      dryRun: Boolean(input.dryRun),
      wrote: false,
      reused: false,
      plannedRelativePaths: [],
      artifacts: [],
      manifest: null,
      render: null,
      ...base,
    };
  }
  if (brief.formats.cardnews.cards.length === 0) {
    return {
      status: "not_applicable",
      reason: "no_cards",
      dryRun: Boolean(input.dryRun),
      wrote: false,
      reused: false,
      plannedRelativePaths: [],
      artifacts: [],
      manifest: null,
      render: null,
      ...base,
    };
  }

  const catalog = evidenceCatalog(brief);
  const wordmarkDataUri = loadWordmarkDataUri();
  const allowedVisualRoots = input.allowedVisualRoots?.length ? input.allowedVisualRoots : [packageRoot];
  const graphicOnly = Boolean(input.graphicOnly);
  const timestamp = (input.now ?? new Date()).toISOString();

  const models: CardRenderModel[] = [];
  const visualIds: Array<string | null> = [];
  for (const [offset, card] of brief.formats.cardnews.cards.entries()) {
    const visual = await resolveVisualDataUri({
      card,
      graphicOnly,
      visuals: input.visuals ?? {},
      allowedVisualRoots,
    });
    visualIds.push(visual.visualAssetId);
    models.push(
      buildRenderModel({
        card,
        index: offset + 1,
        total: brief.formats.cardnews.cards.length,
        citation: citationForCard(card, catalog),
        visualDataUri: visual.dataUri,
        wordmarkDataUri,
      }),
    );
  }

  const pngs: Buffer[] = [];
  if (!input.dryRun) {
    for (const model of models) {
      pngs.push(await rasterizeCardNewsSvg(buildCardNewsSvg(model)));
    }
  }

  const planned: PlannedPackageArtifact[] = [
    {
      relativePath: "context/media-brief.json",
      content: stableJsonBytes(brief),
      kind: "media_brief",
      origin: "media_brief",
      mediaType: "application/json",
    },
  ];

  const cardMetas: CardNewsRenderCardMeta[] = models.map((model, offset) => {
    const relativePath = cardRelativePath(model.index);
    const content = pngs[offset] ?? Buffer.alloc(0);
    if (!input.dryRun) {
      planned.push({
        relativePath,
        content,
        kind: "cardnews",
        origin: "cardnews_render",
        mediaType: CARDNEWS_MEDIA_TYPE,
      });
    }
    return {
      cardIndex: model.index,
      cardRole: model.role,
      sourceBriefCardId: model.cardId,
      relativePath,
      width: CARDNEWS_WIDTH,
      height: CARDNEWS_HEIGHT,
      mediaType: CARDNEWS_MEDIA_TYPE,
      sha256: pngs[offset] ? sha256Buffer(pngs[offset]) : "0".repeat(64),
      byteSize: pngs[offset]?.byteLength ?? 0,
      visualAssetId: visualIds[offset],
      fontFamily: CARDNEWS_FONT_FAMILY,
      headlineFontSize: model.headline.fontSize,
      bodyFontSize: model.body.fontSize,
    };
  });

  const render: CardNewsRenderDocument = {
    contract: CARDNEWS_RENDER_CONTRACT,
    rendererVersion: CARDNEWS_RENDERER_VERSION,
    width: CARDNEWS_WIDTH,
    height: CARDNEWS_HEIGHT,
    aspectRatio: CARDNEWS_ASPECT_RATIO,
    mediaType: CARDNEWS_MEDIA_TYPE,
    fontFamily: CARDNEWS_FONT_FAMILY,
    fontFallback: [CARDNEWS_FONT_FAMILY],
    wordmark: wordmarkDataUri ? "thealltour_logo_trp.png" : "text:thealltour",
    graphicOnly,
    cards: cardMetas,
  };
  assertClean(render);

  if (!input.dryRun) {
    planned.push({
      relativePath: "cardnews/render.json",
      content: stableJsonBytes(render),
      kind: "context",
      origin: "cardnews_render",
      mediaType: "application/json",
    });
  }

  const plannedRelativePaths = [
    ...planned.map((item) => item.relativePath),
    ...cardMetas.map((item) => item.relativePath).filter((path) => input.dryRun),
    "manifest.json",
  ];

  if (input.dryRun) {
    return {
      status: "rendered",
      dryRun: true,
      wrote: false,
      reused: false,
      plannedRelativePaths: [...cardMetas.map((item) => item.relativePath), "cardnews/render.json", "manifest.json"],
      artifacts: [],
      manifest: null,
      render,
      ...base,
    };
  }

  const existingManifest = readExistingManifest(packageRoot);
  for (const item of planned) {
    assertPackageArtifactWritable({ packageRoot, planned: item });
  }
  ensurePackageLayout(packageRoot);

  const written: MarketingAssetArtifact[] = [];
  for (const item of planned) {
    const createdAt =
      existingManifest?.artifacts.find((artifact) => artifact.relativePath === item.relativePath)?.createdAt ??
      timestamp;
    written.push(writePackageArtifact({ packageRoot, planned: item, createdAt }).artifact);
  }

  const merged = mergeArtifacts(existingManifest?.artifacts ?? [], written);
  const createdAt = existingManifest?.createdAt ?? timestamp;
  const identical =
    existingManifest != null &&
    artifactsMatch(existingManifest.artifacts, merged) &&
    existingManifest.mediaBrief.candidateId === brief.candidateId;

  const manifest = parseMarketingAssetManifest({
    contract: MARKETING_ASSET_MANIFEST_CONTRACT,
    packageId,
    candidateId: brief.candidateId,
    businessDateKst: brief.businessDateKst,
    createdAt,
    updatedAt: identical ? existingManifest.updatedAt : timestamp,
    stage: "source",
    mediaBrief: brief,
    artifacts: merged,
    provenance: existingManifest?.provenance ?? {
      exportedFrom: "completed-marketing-candidate",
      candidateContract: brief.provenance.candidateContract,
      assignmentId: brief.provenance.assignmentId,
      generatedDirectories: [...MARKETING_ASSET_GENERATED_DIRECTORIES],
      humanEditedDirectory: MARKETING_ASSET_HUMAN_EDITED_DIRECTORY,
      publishedDirectory: MARKETING_ASSET_PUBLISHED_DIRECTORY,
    },
    integrity: {
      algorithm: "sha256",
      artifactCount: merged.length,
      digest: integrityDigest(merged),
    },
  });
  assertClean(manifest);
  if (!identical) {
    atomicWriteFile(join(packageRoot, "manifest.json"), stableJsonBytes(manifest));
  }

  return {
    status: "rendered",
    dryRun: false,
    wrote: !identical,
    reused: identical,
    plannedRelativePaths,
    artifacts: merged,
    manifest: identical && existingManifest ? existingManifest : manifest,
    render,
    ...base,
  };
}

export function assertCardNewsApplicable(brief: MediaBrief): void {
  if (!brief.formats.cardnews.enabled) throw new CardNewsNotApplicableError("cardnews_disabled");
  if (brief.formats.cardnews.cards.length === 0) throw new CardNewsNotApplicableError("no_cards");
}

export { CardNewsVisualError };
