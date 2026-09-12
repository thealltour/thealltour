"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminCard from "@/components/admin/ui/AdminCard";

type CandidateDto = {
  candidateKey: string;
  selectionToken: string;
  origin: string;
  provider: string | null;
  providerAssetId: string | null;
  mediaType: string;
  sourcePageUrl: string | null;
  previewUrl: string | null;
  creatorName: string | null;
  rightsKind: string;
  licenseName: string | null;
  score: number;
  factualMatch: string;
  factualMatchLabel: string;
  autoPickEligible: boolean;
  reviewRequired: boolean;
  photoMotion: boolean;
  generatedPlan: boolean;
  pickBlockedReason: string | null;
};

type SceneDto = {
  sceneId: string;
  order: number;
  purpose: string;
  narrationPreview: string | null;
  visualSubject: string;
  factualVisualRequired: boolean;
  mediaPreference: string;
  status: string;
  reason: string;
  recommended: CandidateDto | null;
  candidates: CandidateDto[];
  providerAttempts: Array<{ providerId: string; status: string; candidateCount: number; label: string }>;
  existingPick: {
    sourceId: string;
    provider: string | null;
    providerAssetId: string | null;
    originLabel: string;
  } | null;
};

type ResolveDto = {
  candidateId: string;
  businessDateKst: string;
  scenes: SceneDto[];
  catalogAvailable: boolean;
  message?: string;
  code?: string;
};

type RenderStatusDto = {
  candidateId: string;
  shortformIntended: boolean;
  uiStatus: string;
  renderReady: boolean;
  reason: string;
  requiredSceneCount: number;
  pickedSceneCount: number;
  message?: string;
  job: {
    jobId: string;
    status: string;
    attemptCount: number;
    maxAttempts: number;
    errorCode: string | null;
    errorSummary: string | null;
    outputArtifactPath: string | null;
    updatedAt: string;
    completedAt: string | null;
  } | null;
  finalArtifact: {
    relativePath: string;
    exists: boolean;
    previewPath: string | null;
  };
};

function renderStatusLabel(status: string): string {
  switch (status) {
    case "not_shortform":
      return "숏폼 비대상";
    case "not_render_ready":
      return "렌더 대기 (PICK 필요)";
    case "queued":
      return "QUEUED";
    case "running":
      return "RUNNING";
    case "ready":
      return "READY";
    case "failed":
      return "FAILED";
    case "cancelled":
      return "CANCELLED";
    default:
      return status;
  }
}

function finalFileUrl(candidateId: string, relativePath: string, disposition: "inline" | "attachment") {
  const params = new URLSearchParams({ path: relativePath, disposition });
  return `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/assets/file?${params.toString()}`;
}

function originLabel(origin: string): string {
  switch (origin) {
    case "internal_catalog":
      return "내부 카탈로그";
    case "pexels":
      return "Pexels";
    case "pixabay":
      return "Pixabay";
    case "photo_motion":
      return "사진 모션";
    case "generated_video_plan":
      return "AI B-roll 계획";
    default:
      return origin;
  }
}

function CandidatePreview({ candidate }: { candidate: CandidateDto }) {
  if (candidate.generatedPlan) {
    return (
      <div className="aspect-[9/16] max-h-36 rounded-md bg-[var(--surface-muted)] px-2 py-2 text-[10px] text-[var(--text-secondary)]">
        AI B-roll 생성 가능 (실행 불가)
      </div>
    );
  }
  if (candidate.previewUrl && candidate.mediaType === "video") {
    return (
      <video
        className="aspect-[9/16] max-h-36 w-full rounded-md bg-black object-contain"
        src={candidate.previewUrl}
        poster={candidate.previewUrl}
        controls
        preload="metadata"
      />
    );
  }
  if (candidate.previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={candidate.previewUrl}
        alt=""
        className="aspect-[9/16] max-h-36 w-full rounded-md object-cover"
      />
    );
  }
  return (
    <div className="aspect-[9/16] max-h-36 rounded-md bg-[var(--surface-muted)] px-2 py-2 text-[10px] text-[var(--text-secondary)]">
      미리보기 없음
    </div>
  );
}

function CandidateCard(props: {
  candidate: CandidateDto;
  busy: boolean;
  onPick: (candidate: CandidateDto) => void;
  isRecommended?: boolean;
}) {
  const { candidate, busy, onPick, isRecommended } = props;
  const blocked = Boolean(candidate.pickBlockedReason);
  return (
    <div className="flex min-w-0 flex-col space-y-1.5 rounded-lg border border-[var(--border)] p-2">
      {isRecommended ? (
        <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
          추천 소스
        </div>
      ) : null}
      <CandidatePreview candidate={candidate} />
      <div className="truncate text-xs font-medium" title={originLabel(candidate.origin)}>
        {originLabel(candidate.origin)}
        {candidate.photoMotion ? " · 모션" : ""}
        {candidate.reviewRequired ? " · 확인" : ""}
      </div>
      <div
        className="line-clamp-2 text-[10px] text-[var(--text-secondary)]"
        title={
          `${candidate.creatorName ?? "작성자 미상"}${candidate.providerAssetId ? ` · ${candidate.providerAssetId}` : ""}`
        }
      >
        {candidate.creatorName ?? "작성자 미상"}
        {candidate.providerAssetId ? ` · ${candidate.providerAssetId}` : ""}
      </div>
      <div className="text-[10px] text-[var(--text-secondary)]">
        Score {candidate.score.toFixed(2)} · {candidate.factualMatchLabel}
      </div>
      <div className="mt-auto flex flex-col gap-1">
        {!candidate.generatedPlan ? (
          <button
            type="button"
            disabled={busy || blocked}
            onClick={() => onPick(candidate)}
            className="w-full rounded-md bg-[var(--primary)] px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
          >
            이 장면에 사용
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="w-full rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--text-secondary)]"
          >
            생성 (준비 중)
          </button>
        )}
        {candidate.sourcePageUrl ? (
          <a
            href={candidate.sourcePageUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full rounded-md border border-[var(--border)] px-2 py-1 text-center text-xs"
          >
            소스 페이지
          </a>
        ) : null}
      </div>
      {candidate.pickBlockedReason ? (
        <p className="text-[10px] text-[var(--danger, #b91c1c)]">{candidate.pickBlockedReason}</p>
      ) : null}
    </div>
  );
}

export function MarketingReviewShortformSourcesPanel(props: { candidateId: string }) {
  const { candidateId } = props;
  const [data, setData] = useState<ResolveDto | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatusDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [requeueBusy, setRequeueBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [expandedScenes, setExpandedScenes] = useState<Record<string, boolean>>({});

  const loadRenderStatus = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/shortform/render`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as RenderStatusDto;
      if (res.ok) setRenderStatus(json);
    } catch {
      /* non-fatal */
    }
  }, [candidateId]);

  const resolve = useCallback(async (opts?: { forceRefresh?: boolean }) => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/shortform/sources/resolve`,
        {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceRefresh: opts?.forceRefresh === true }),
        },
      );
      const json = (await res.json()) as ResolveDto;
      if (!res.ok) {
        setData(null);
        setMessage(json.message ?? "소스 검색에 실패했습니다.");
        return;
      }
      setData(json);
      if (!json.catalogAvailable) {
        setMessage("카탈로그 DB가 아직 준비되지 않았습니다. 검색은 가능하지만 선택 저장은 불가할 수 있습니다.");
      }
      await loadRenderStatus();
    } catch {
      setData(null);
      setMessage("소스 검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [candidateId, loadRenderStatus]);

  const autoResolved = useRef(false);
  useEffect(() => {
    if (autoResolved.current) return;
    autoResolved.current = true;
    void resolve({ forceRefresh: false });
  }, [resolve]);

  async function pick(sceneId: string, candidate: CandidateDto) {
    setBusyKey(`${sceneId}:${candidate.candidateKey}`);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/shortform/sources/pick`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneId,
            selectionToken: candidate.selectionToken,
          }),
        },
      );
      const json = (await res.json()) as {
        message?: string;
        ok?: boolean;
        renderEnqueue?: { enqueued?: boolean; created?: boolean; status?: string | null; reason?: string };
      };
      if (!res.ok) {
        setMessage(json.message ?? "선택에 실패했습니다.");
        return;
      }
      const enqueueNote = json.renderEnqueue?.enqueued
        ? json.renderEnqueue.created
          ? ` · 렌더 작업 등록 (${json.renderEnqueue.status ?? "QUEUED"})`
          : ` · 렌더 작업 유지 (${json.renderEnqueue.status ?? "기존"})`
        : json.renderEnqueue?.reason
          ? ` · 렌더: ${json.renderEnqueue.reason}`
          : "";
      setMessage((json.message ?? "선택했습니다.") + enqueueNote);
      await resolve({ forceRefresh: false });
      await loadRenderStatus();
    } catch {
      setMessage("선택에 실패했습니다.");
    } finally {
      setBusyKey(null);
    }
  }

  async function requeueFailed() {
    setRequeueBusy(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/shortform/render`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "requeue" }),
        },
      );
      const json = (await res.json()) as { message?: string; ok?: boolean };
      if (!res.ok) {
        setMessage(json.message ?? "재시도에 실패했습니다.");
        return;
      }
      setMessage(json.message ?? "렌더를 다시 대기열에 넣었습니다.");
      await loadRenderStatus();
    } catch {
      setMessage("재시도에 실패했습니다.");
    } finally {
      setRequeueBusy(false);
    }
  }

  return (
    <AdminCard className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Shortform Sources</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            일일 생산 파이프라인이 ShortVideoBrief·소스 검색을 준비합니다. 자동 선택은 하지 않으며, 장면별
            명시적 PICK만 지원합니다.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void resolve({ forceRefresh: true })}
          className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {loading ? "검색 중…" : data ? "다시 검색" : "소스 검색"}
        </button>
      </div>

      {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}

      {renderStatus?.shortformIntended ? (
        <div className="space-y-2 rounded-lg border border-[var(--border)] p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-medium">렌더 상태:</span>{" "}
              {renderStatusLabel(renderStatus.uiStatus)}
              {renderStatus.job ? (
                <span className="text-xs text-[var(--text-secondary)]">
                  {" "}
                  · 시도 {renderStatus.job.attemptCount}/{renderStatus.job.maxAttempts}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              className="text-xs underline"
              onClick={() => void loadRenderStatus()}
            >
              상태 새로고침
            </button>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            PICK {renderStatus.pickedSceneCount}/{renderStatus.requiredSceneCount}
            {renderStatus.renderReady ? " · 렌더 준비 완료" : " · 모든 장면 PICK 후 자동 큐잉"}
          </p>
          {renderStatus.uiStatus === "failed" ? (
            <div className="space-y-2">
              <p className="text-xs text-[var(--danger,#b91c1c)]">
                {renderStatus.job?.errorSummary ?? renderStatus.job?.errorCode ?? "렌더 실패"}
              </p>
              <button
                type="button"
                disabled={requeueBusy}
                onClick={() => void requeueFailed()}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {requeueBusy ? "재시도 중…" : "실패 작업 재시도 (requeue)"}
              </button>
            </div>
          ) : null}
          {renderStatus.uiStatus === "ready" && renderStatus.finalArtifact.exists && renderStatus.finalArtifact.previewPath ? (
            <div className="space-y-2">
              <video
                className="max-h-72 w-full rounded-md bg-black object-contain"
                src={finalFileUrl(candidateId, renderStatus.finalArtifact.previewPath, "inline")}
                controls
                preload="metadata"
              />
              <a
                href={finalFileUrl(candidateId, renderStatus.finalArtifact.previewPath, "attachment")}
                className="text-xs text-[var(--primary)] underline-offset-2 hover:underline"
              >
                shortform.mp4 다운로드
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      {!data && !loading ? (
        <p className="text-sm text-[var(--text-secondary)]">
          ShortVideoBrief가 준비되면 장면별 소스 옵션이 자동으로 표시됩니다. Brief가 없으면 이 후보는
          shortform 비대상이거나 아직 생성 중입니다.
        </p>
      ) : null}

      {data?.scenes.map((scene) => {
        const showAlts = expandedScenes[scene.sceneId] ?? false;
        const alternatives = scene.candidates.filter(
          (c) => c.candidateKey !== scene.recommended?.candidateKey,
        );
        return (
          <div key={scene.sceneId} className="space-y-3 border-t border-[var(--border)] pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">
                Scene {scene.order} / {data.scenes.length}
              </h3>
              {scene.factualVisualRequired ? (
                <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs font-medium">
                  실제 장소 확인 필요
                </span>
              ) : null}
              {scene.existingPick ? (
                <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs">
                  ✓ 선택됨 · {scene.existingPick.originLabel}
                </span>
              ) : null}
            </div>
            <div className="space-y-1 text-sm">
              <div>목적: {scene.purpose || "—"}</div>
              {scene.narrationPreview ? <div>Narration refs: {scene.narrationPreview}</div> : null}
              <div>Visual: {scene.visualSubject}</div>
              <div className="text-xs text-[var(--text-secondary)]">
                {scene.mediaPreference.toUpperCase()} preferred
                {scene.factualVisualRequired ? " · AI Generated 불가" : ""}
              </div>
            </div>

            {scene.providerAttempts.length > 0 ? (
              <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                {scene.providerAttempts.map((attempt) => (
                  <span key={attempt.providerId} className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5">
                    {attempt.providerId} · {attempt.label}
                  </span>
                ))}
              </div>
            ) : null}

            {scene.status === "generation_fallback_available" && !scene.factualVisualRequired ? (
              <p className="text-xs text-[var(--text-secondary)]">
                실사/스톡 후보를 찾지 못했습니다. AI B-roll 생성 가능 (실행은 아직 불가)
              </p>
            ) : null}

            {scene.recommended ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                <CandidateCard
                  candidate={scene.recommended}
                  isRecommended
                  busy={busyKey === `${scene.sceneId}:${scene.recommended.candidateKey}`}
                  onPick={(c) => void pick(scene.sceneId, c)}
                />
                {showAlts
                  ? alternatives.map((candidate) => (
                      <CandidateCard
                        key={candidate.candidateKey}
                        candidate={candidate}
                        busy={busyKey === `${scene.sceneId}:${candidate.candidateKey}`}
                        onPick={(c) => void pick(scene.sceneId, c)}
                      />
                    ))
                  : null}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)]">추천 후보 없음 ({scene.reason})</p>
            )}

            {alternatives.length > 0 ? (
              <div className="space-y-2">
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() =>
                    setExpandedScenes((prev) => ({
                      ...prev,
                      [scene.sceneId]: !showAlts,
                    }))
                  }
                >
                  {showAlts ? "다른 후보 접기" : `다른 후보 ${alternatives.length}개 보기`}
                </button>
                {!scene.recommended && showAlts ? (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                    {alternatives.map((candidate) => (
                      <CandidateCard
                        key={candidate.candidateKey}
                        candidate={candidate}
                        busy={busyKey === `${scene.sceneId}:${candidate.candidateKey}`}
                        onPick={(c) => void pick(scene.sceneId, c)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </AdminCard>
  );
}
