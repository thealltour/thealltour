import type {
  ShortformFactualMatch,
  ShortformProviderAttempt,
  ShortformSceneSourceResolution,
  ShortformSourceCandidate,
  ShortformSourceResolutionPlan,
} from "@/lib/marketing/assets/shortform/resolver/contracts";
import {
  createShortformCandidateSelectionToken,
  selectionPayloadFromCandidate,
} from "@/lib/marketing/assets/shortform/review/selectionToken";
import type { MarketingMediaSourceUsageRecord } from "@/lib/marketing/assets/sourceCatalog/types";
import type { ShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/contracts";

export type ShortformSourceCandidateDto = {
  candidateKey: string;
  selectionToken: string;
  origin: ShortformSourceCandidate["origin"];
  catalogSourceId: string | null;
  provider: string | null;
  providerAssetId: string | null;
  mediaType: ShortformSourceCandidate["mediaType"];
  sourcePageUrl: string | null;
  previewUrl: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  orientation: string | null;
  creatorName: string | null;
  rightsKind: string;
  licenseName: string | null;
  attributionText: string | null;
  score: number;
  scoreBreakdown: ShortformSourceCandidate["scoreBreakdown"];
  factualMatch: ShortformFactualMatch;
  factualMatchLabel: string;
  autoPickEligible: boolean;
  reviewRequired: boolean;
  rejectionReasons: string[];
  photoMotion: boolean;
  generatedPlan: boolean;
  pickBlockedReason: string | null;
};

export type ShortformSceneResolutionDto = {
  sceneId: string;
  order: number;
  purpose: string;
  narrationPreview: string | null;
  visualSubject: string;
  searchQueries: string[];
  factualVisualRequired: boolean;
  mediaPreference: string;
  photoMotionAllowed: boolean;
  generatedVideoAllowed: boolean;
  status: ShortformSceneSourceResolution["status"];
  reason: string;
  recommended: ShortformSourceCandidateDto | null;
  candidates: ShortformSourceCandidateDto[];
  providerAttempts: Array<{
    providerId: string;
    status: string;
    candidateCount: number;
    label: string;
  }>;
  existingPick: {
    sourceId: string;
    provider: string | null;
    providerAssetId: string | null;
    originLabel: string;
  } | null;
};

export type ShortformSourcesResolveDto = {
  candidateId: string;
  businessDateKst: string;
  contract: string;
  scenes: ShortformSceneResolutionDto[];
  catalogAvailable: boolean;
};

function factualMatchLabel(match: ShortformFactualMatch): string {
  switch (match) {
    case "confirmed":
      return "실제 장소 일치 가능성 높음";
    case "probable":
      return "실제 장소일 가능성 — 확인 필요";
    case "generic":
      return "분위기용/일반 영상";
    case "unknown":
      return "일치 여부 불명";
    default:
      return match;
  }
}

function providerAttemptLabel(attempt: ShortformProviderAttempt): string {
  switch (attempt.status) {
    case "success":
      return "검색 완료";
    case "empty":
      return "결과 없음";
    case "disabled":
      return "연결 안 됨";
    case "unavailable":
      return "일시 불가";
    case "error":
      return "오류";
    case "skipped":
      return "생략";
    default:
      return attempt.status;
  }
}

function pickBlockedReason(candidate: ShortformSourceCandidate): string | null {
  if (candidate.rightsKind === "unknown") return "사용권 확인 필요 — 선택 불가";
  if (candidate.origin === "generated_video_plan") return "AI 생성은 아직 실행할 수 없습니다";
  return null;
}

export function toCandidateDto(input: {
  candidateId: string;
  sceneId: string;
  candidate: ShortformSourceCandidate;
}): ShortformSourceCandidateDto {
  const c = input.candidate;
  const selectionToken = createShortformCandidateSelectionToken(
    selectionPayloadFromCandidate({
      candidateId: input.candidateId,
      sceneId: input.sceneId,
      candidate: c,
    }),
  );
  return {
    candidateKey: c.candidateKey,
    selectionToken,
    origin: c.origin,
    catalogSourceId: c.catalogSourceId,
    provider: c.provider,
    providerAssetId: c.providerAssetId,
    mediaType: c.mediaType,
    sourcePageUrl: c.sourcePageUrl,
    previewUrl: c.previewUrl,
    width: c.width,
    height: c.height,
    durationMs: c.durationMs,
    orientation: c.orientation,
    creatorName: c.creatorName,
    rightsKind: c.rightsKind,
    licenseName: c.licenseName,
    attributionText: c.attributionText,
    score: c.score,
    scoreBreakdown: c.scoreBreakdown,
    factualMatch: c.factualMatch,
    factualMatchLabel: factualMatchLabel(c.factualMatch),
    autoPickEligible: c.autoPickEligible,
    reviewRequired: c.reviewRequired,
    rejectionReasons: c.rejectionReasons,
    photoMotion: c.origin === "photo_motion",
    generatedPlan: c.origin === "generated_video_plan",
    pickBlockedReason: pickBlockedReason(c),
  };
}

export function toResolveDto(input: {
  plan: ShortformSourceResolutionPlan;
  brief: ShortVideoBrief;
  usages: MarketingMediaSourceUsageRecord[];
  sourceLookup: Map<string, { provider: string | null; providerAssetId: string | null }>;
  catalogAvailable: boolean;
}): ShortformSourcesResolveDto {
  const usagesByScene = new Map<string, MarketingMediaSourceUsageRecord>();
  for (const usage of input.usages) {
    if (!usage.sceneKey) continue;
    if (!usagesByScene.has(usage.sceneKey)) usagesByScene.set(usage.sceneKey, usage);
  }

  const scenes = input.plan.scenes.map((resolution) => {
    const briefScene = input.brief.scenes.find((s) => s.sceneId === resolution.sceneId);
    const existing = usagesByScene.get(resolution.sceneId) ?? null;
    const existingMeta = existing ? input.sourceLookup.get(existing.sourceId) : null;
    return {
      sceneId: resolution.sceneId,
      order: briefScene?.order ?? 0,
      purpose: briefScene?.purpose ?? "",
      narrationPreview: briefScene?.narrationSegmentRefs?.join(", ") ?? null,
      visualSubject: briefScene?.visual.subject ?? "",
      searchQueries: briefScene?.visual.searchQueries ?? [],
      factualVisualRequired: briefScene?.visual.factualVisualRequired ?? false,
      mediaPreference: briefScene?.visual.mediaPreference ?? "either",
      photoMotionAllowed: briefScene?.visual.photoMotionAllowed ?? false,
      generatedVideoAllowed: briefScene?.visual.generatedVideoAllowed ?? false,
      status: resolution.status,
      reason: resolution.reason,
      recommended: resolution.recommendedCandidate
        ? toCandidateDto({
            candidateId: input.plan.candidateId,
            sceneId: resolution.sceneId,
            candidate: resolution.recommendedCandidate,
          })
        : null,
      candidates: resolution.candidates.map((candidate) =>
        toCandidateDto({
          candidateId: input.plan.candidateId,
          sceneId: resolution.sceneId,
          candidate,
        }),
      ),
      providerAttempts: resolution.attemptedSources.map((attempt) => ({
        providerId: attempt.providerId,
        status: attempt.status,
        candidateCount: attempt.candidateCount,
        label: providerAttemptLabel(attempt),
      })),
      existingPick: existing
        ? {
            sourceId: existing.sourceId,
            provider: existingMeta?.provider ?? null,
            providerAssetId: existingMeta?.providerAssetId ?? null,
            originLabel: existingMeta?.provider
              ? `${existingMeta.provider}${existingMeta.providerAssetId ? ` · ${existingMeta.providerAssetId}` : ""}`
              : existing.sourceId,
          }
        : null,
    } satisfies ShortformSceneResolutionDto;
  });

  return {
    candidateId: input.plan.candidateId,
    businessDateKst: input.plan.businessDateKst,
    contract: input.plan.contract,
    scenes,
    catalogAvailable: input.catalogAvailable,
  };
}
