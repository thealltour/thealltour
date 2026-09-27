import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { jsonContainsForbiddenBotLeak, stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";
import type { AssignmentEvidenceRef } from "@/lib/marketing/content/types";
import type { CardNewsCard, MarketingAssetArtifact, MarketingAssetManifest, MediaBrief } from "@/lib/marketing/assets/contracts";
import { MARKETING_ASSET_MANIFEST_CONTRACT } from "@/lib/marketing/assets/contracts";
import {
  CARDNEWS_DEFAULT_ASPECT_RATIO,
  CARDNEWS_FONT_FAMILY,
  CARDNEWS_MEDIA_TYPE,
  CARDNEWS_RENDER_CONTRACT,
  CARDNEWS_RENDERER_VERSION,
  resolveCardNewsGeometry,
  type CardNewsAspectRatio,
  type CardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import { encodeLocalVisualDataUri, rasterizeCardNewsSvg } from "@/lib/marketing/assets/cardnews/raster";
import {
  buildCardNewsSvgFromSpec,
  loadWordmarkDataUri,
  type CardCitation,
} from "@/lib/marketing/assets/cardnews/svg";
import {
  assertCardPresentationArtifactContractParity,
  buildDeterministicCardPresentationPlan,
  legacyRoleToPresentationHint,
} from "@/lib/marketing/assets/cardnews/presentation/deterministic";
import { buildInstagramPresentationSourceFingerprint, buildCardPresentationContentFingerprint } from "@/lib/marketing/assets/cardnews/presentation/fingerprint";
import { persistCardPresentationPlan } from "@/lib/marketing/assets/cardnews/presentation/persist";
import { buildResolvedCardRenderSpec } from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";
import type { CardPresentationPlan } from "@/lib/marketing/assets/cardnews/presentation/contracts";
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
  overwritePackageArtifact,
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
  /** PR2 presentation template used for this card. */
  presentationTemplate?: string | null;
};

export type CardNewsRenderDocument = {
  contract: typeof CARDNEWS_RENDER_CONTRACT;
  rendererVersion: typeof CARDNEWS_RENDERER_VERSION;
  width: number;
  height: number;
  aspectRatio: CardNewsAspectRatio;
  mediaType: typeof CARDNEWS_MEDIA_TYPE;
  fontFamily: typeof CARDNEWS_FONT_FAMILY;
  fontFallback: [typeof CARDNEWS_FONT_FAMILY];
  wordmark: "thealltour_logo_trp.png" | "text:thealltour";
  graphicOnly: boolean;
  cards: CardNewsRenderCardMeta[];
  /** PR2 — presentation plan fingerprint when present. */
  presentationPlanFingerprint?: string | null;
};

export type RenderCardNewsPackageInput = {
  mediaBrief: MediaBrief;
  assetRoot?: string | null;
  env?: MarketingAssetEnv;
  dryRun?: boolean;
  graphicOnly?: boolean;
  visuals?: Record<string, string>;
  /** Optional shared-visual id per cardId (for presentation plan). */
  visualIdsByCard?: Record<string, string | null>;
  allowedVisualRoots?: string[];
  /** Overrides the brief's aspect ratio (e.g. rendering a 1:1 variant of the same cards). */
  aspectRatio?: CardNewsAspectRatio | null;
  /** Precomputed presentation plan; if absent, deterministic layout fallback is used. */
  presentationPlan?: CardPresentationPlan | null;
  /** Editorial carousel roles by cardId — preferred Presentation input when present. */
  editorialRolesByCardId?: Record<string, string>;
  /** Persist presentation plan to package when rendering (default true when package writable). */
  persistPresentationPlan?: boolean;
  /**
   * When false, do not plan/write `context/media-brief.json`.
   * Use for in-memory cardPlan copy overlays that must not replace the on-disk
   * legacy brief (sha guard + dual-SoT). Default true.
   */
  persistMediaBrief?: boolean;
  /**
   * Manifest `mediaBrief` when `persistMediaBrief` is false.
   * Prefer the on-disk brief so manifest stays aligned with the artifact.
   */
  manifestMediaBrief?: MediaBrief;
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

/**
 * @deprecated Internal role labels must never appear on rendered cards.
 * Kept only so accidental call sites fail loudly in tests if reintroduced.
 */
export function cardnewsRoleKicker(role: CardNewsCard["role"]): string {
  return ROLE_KICKER[role];
}

/** 4:5 keeps the historical flat paths; other ratios get their own subdirectory. */
function cardnewsDirectory(geometry: CardNewsGeometry): string {
  return geometry.aspectRatio === CARDNEWS_DEFAULT_ASPECT_RATIO
    ? "cardnews"
    : `cardnews/${geometry.aspectRatio.replace(":", "x")}`;
}

function cardRelativePath(index: number, geometry: CardNewsGeometry): string {
  return `${cardnewsDirectory(geometry)}/card-${String(index).padStart(2, "0")}.png`;
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

function resolvePresentationPlanForRender(input: {
  brief: MediaBrief;
  cards: CardNewsCard[];
  visuals: Record<string, string>;
  visualIdsByCard: Record<string, string | null>;
  graphicOnly: boolean;
  presentationPlan?: CardPresentationPlan | null;
  /** Prefer editorial carousel roles when available (Presentation input). */
  editorialRolesByCardId?: Record<string, string>;
}): CardPresentationPlan {
  // Phase 3C: assert policy even on reuse; missing/mismatched plan → deterministic_fallback.
  assertCardPresentationArtifactContractParity();

  if (input.presentationPlan?.cards?.length === input.cards.length) {
    const ids = new Set(input.presentationPlan.cards.map((c) => c.cardId));
    if (input.cards.every((c) => ids.has(c.cardId))) {
      return input.presentationPlan;
    }
  }

  const visualIds = input.cards.map((c) =>
    input.graphicOnly ? null : (input.visualIdsByCard[c.cardId] ?? (input.visuals[c.cardId] ? `local:${c.cardId}` : null)),
  );
  const sourceFp = buildInstagramPresentationSourceFingerprint({
    cardIds: input.cards.map((c) => c.cardId),
    headlines: input.cards.map((c) => c.headline),
    bodies: input.cards.map((c) => c.body),
    roles: input.cards.map((c) => c.role),
    visualIds,
  });

  // deterministic_fallback: LLM/optional planner unavailable or not wired → deterministic plan.
  return buildDeterministicCardPresentationPlan({
    assetId: input.brief.candidateId,
    assetVersion: 1,
    sourceInstagramFingerprint: sourceFp,
    cards: input.cards.map((card, i) => ({
      cardId: card.cardId,
      role:
        input.editorialRolesByCardId?.[card.cardId] ??
        legacyRoleToPresentationHint(card.role),
      hasVisual: !input.graphicOnly && Boolean(input.visuals[card.cardId]),
      visualId: visualIds[i],
      headlineHint: card.headline,
    })),
  });
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
  const geometry = resolveCardNewsGeometry(
    input.aspectRatio ?? brief.formats.cardnews.aspectRatio,
  );
  const wordmarkDataUri = loadWordmarkDataUri();
  const allowedVisualRoots = input.allowedVisualRoots?.length ? input.allowedVisualRoots : [packageRoot];
  const graphicOnly = Boolean(input.graphicOnly);
  const timestamp = (input.now ?? new Date()).toISOString();
  const cards = brief.formats.cardnews.cards;
  const visuals = input.visuals ?? {};
  const visualIdsByCard = input.visualIdsByCard ?? {};

  const presentationPlan = resolvePresentationPlanForRender({
    brief,
    cards,
    visuals,
    visualIdsByCard,
    graphicOnly,
    presentationPlan: input.presentationPlan,
    editorialRolesByCardId: input.editorialRolesByCardId,
  });
  const presentationByCard = new Map(presentationPlan.cards.map((c) => [c.cardId, c]));

  if (input.persistPresentationPlan !== false && !input.dryRun) {
    persistCardPresentationPlan({
      packageRoot,
      plan: presentationPlan,
      createdAt: timestamp,
    });
  }

  const specs: ReturnType<typeof buildResolvedCardRenderSpec>[] = [];
  const visualIds: Array<string | null> = [];
  for (const [offset, card] of cards.entries()) {
    const visual = await resolveVisualDataUri({
      card,
      graphicOnly,
      visuals,
      allowedVisualRoots,
    });
    visualIds.push(visual.visualAssetId);
    const presentation = presentationByCard.get(card.cardId);
    if (!presentation) {
      throw new MarketingAssetContractError(`presentation missing for ${card.cardId}`);
    }
    specs.push(
      buildResolvedCardRenderSpec({
        card,
        index: offset + 1,
        total: cards.length,
        presentation,
        citation: citationForCard(card, catalog),
        visualDataUri: visual.dataUri,
        wordmarkDataUri,
        geometry,
      }),
    );
  }

  const pngs: Buffer[] = [];
  if (!input.dryRun) {
    for (const spec of specs) {
      pngs.push(await rasterizeCardNewsSvg(buildCardNewsSvgFromSpec(spec, geometry), geometry));
    }
  }

  const planned: PlannedPackageArtifact[] = [];
  if (input.persistMediaBrief !== false) {
    planned.push({
      relativePath: "context/media-brief.json",
      content: stableJsonBytes(brief),
      kind: "media_brief",
      origin: "media_brief",
      mediaType: "application/json",
    });
  }

  const cardMetas: CardNewsRenderCardMeta[] = specs.map((spec, offset) => {
    const relativePath = cardRelativePath(spec.index, geometry);
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
      cardIndex: spec.index,
      cardRole: spec.role,
      sourceBriefCardId: spec.cardId,
      relativePath,
      width: geometry.width,
      height: geometry.height,
      mediaType: CARDNEWS_MEDIA_TYPE,
      sha256: pngs[offset] ? sha256Buffer(pngs[offset]) : "0".repeat(64),
      byteSize: pngs[offset]?.byteLength ?? 0,
      visualAssetId: visualIds[offset],
      fontFamily: CARDNEWS_FONT_FAMILY,
      headlineFontSize: spec.headline.fontSize,
      bodyFontSize: spec.body.fontSize,
      presentationTemplate: spec.layout.template,
    };
  });

  const render: CardNewsRenderDocument = {
    contract: CARDNEWS_RENDER_CONTRACT,
    rendererVersion: CARDNEWS_RENDERER_VERSION,
    width: geometry.width,
    height: geometry.height,
    aspectRatio: geometry.aspectRatio,
    mediaType: CARDNEWS_MEDIA_TYPE,
    fontFamily: CARDNEWS_FONT_FAMILY,
    fontFallback: [CARDNEWS_FONT_FAMILY],
    wordmark: wordmarkDataUri ? "thealltour_logo_trp.png" : "text:thealltour",
    graphicOnly,
    cards: cardMetas,
    presentationPlanFingerprint: buildCardPresentationContentFingerprint(presentationPlan),
  };
  assertClean(render);

  if (!input.dryRun) {
    planned.push({
      relativePath: `${cardnewsDirectory(geometry)}/render.json`,
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
      plannedRelativePaths: [
        ...cardMetas.map((item) => item.relativePath),
        `${cardnewsDirectory(geometry)}/render.json`,
        "manifest.json",
      ],
      artifacts: [],
      manifest: null,
      render,
      ...base,
    };
  }

  const existingManifest = readExistingManifest(packageRoot);
  ensurePackageLayout(packageRoot);

  const written: MarketingAssetArtifact[] = [];
  for (const item of planned) {
    const createdAt =
      existingManifest?.artifacts.find((artifact) => artifact.relativePath === item.relativePath)?.createdAt ??
      timestamp;
    const isRegenerableCardnews =
      item.kind === "cardnews" ||
      item.relativePath.endsWith("/render.json") ||
      item.relativePath === "cardnews/render.json" ||
      item.relativePath.startsWith("cardnews/");
    if (isRegenerableCardnews && item.relativePath !== "context/media-brief.json") {
      // Cardnews PNGs + render.json are derived; presentation redesign must re-render in place.
      written.push(overwritePackageArtifact({ packageRoot, planned: item, createdAt }).artifact);
      continue;
    }
    assertPackageArtifactWritable({ packageRoot, planned: item });
    written.push(writePackageArtifact({ packageRoot, planned: item, createdAt }).artifact);
  }

  const merged = mergeArtifacts(existingManifest?.artifacts ?? [], written);
  const createdAt = existingManifest?.createdAt ?? timestamp;
  const manifestBrief =
    input.persistMediaBrief === false
      ? (input.manifestMediaBrief ?? existingManifest?.mediaBrief ?? brief)
      : brief;
  const identical =
    existingManifest != null &&
    artifactsMatch(existingManifest.artifacts, merged) &&
    existingManifest.mediaBrief.candidateId === manifestBrief.candidateId;

  const manifest = parseMarketingAssetManifest({
    contract: MARKETING_ASSET_MANIFEST_CONTRACT,
    packageId,
    candidateId: brief.candidateId,
    businessDateKst: brief.businessDateKst,
    createdAt,
    updatedAt: identical ? existingManifest.updatedAt : timestamp,
    stage: "source",
    mediaBrief: manifestBrief,
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
