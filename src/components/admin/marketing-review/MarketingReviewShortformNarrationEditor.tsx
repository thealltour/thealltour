"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminButton from "@/components/admin/ui/AdminButton";
import { adminToneText } from "@/components/admin/ui/adminStatusTone";
import { cn } from "@/lib/cn";
import type {
  ShortformNarrationRenderSummary,
  ShortformNarrationSaveResult,
  ShortformNarrationView,
} from "@/lib/marketing/review/shortformNarrationReview";
import { sanitizeTextForDisplay } from "@/lib/marketing/review/textDisplay";

const PURPOSE_LABELS: Record<string, string> = {
  hook: "도입",
  body: "본문",
  close: "마무리",
};

const RENDER_LABELS: Record<ShortformNarrationRenderSummary["uiStatus"], string> = {
  not_shortform: "숏폼 대상 아님",
  not_render_ready: "렌더 전",
  queued: "렌더 대기 중",
  running: "렌더 중",
  ready: "렌더 READY",
  failed: "렌더 실패",
  cancelled: "렌더 취소됨",
};

export function shortformNarrationSaveMessage(result: ShortformNarrationSaveResult): string {
  const saved = result.changed ? "저장했습니다" : "변경 사항 없이 저장했습니다";
  const { rerender, render } = result;
  if (result.target === "publishable_slot") return `${saved} · 영상 렌더 대상이 아니라 문안만 저장했습니다`;
  if (rerender.enqueued) {
    return rerender.created ? `${saved} · 재렌더를 요청했습니다` : `${saved} · 현재 내레이션 기준 렌더가 이미 있습니다`;
  }
  const reason = rerender.skippedReason ?? "";
  if (reason.startsWith("render_queue_unavailable")) return `${saved} · 렌더 대기열에 연결하지 못했습니다`;
  if (reason === "failed_requires_requeue") {
    return `${saved} · 같은 내레이션의 렌더가 실패 상태입니다. Shortform 패널에서 재시도하세요`;
  }
  if (reason === "render_key_spent_requires_input_change") {
    return `${saved} · 이 문구로는 이전 렌더 기록 때문에 다시 렌더할 수 없습니다. 문구를 조금 바꿔 다시 저장하세요`;
  }
  if (render && render.pickedSceneCount < render.requiredSceneCount) return `${saved} · PICK 완료 후 렌더됩니다`;
  return `${saved} · 렌더는 요청되지 않았습니다 (${reason || "사유 없음"})`;
}

function renderLine(render: ShortformNarrationRenderSummary): string {
  const picks =
    render.requiredSceneCount > 0 ? ` · PICK ${render.pickedSceneCount}/${render.requiredSceneCount}` : "";
  return `${RENDER_LABELS[render.uiStatus]}${picks}`;
}

/**
 * Segment-level narration editor. Saving rewrites what the render reads (media-brief) and asks for a
 * re-render once every scene is picked; segment count and order stay as generated.
 */
export function MarketingReviewShortformNarrationEditor(props: {
  candidateId: string;
  canEdit: boolean;
  fallbackBody: string;
  onSaved?: () => Promise<void>;
}) {
  const { candidateId, canEdit, fallbackBody, onSaved } = props;
  const [view, setView] = useState<ShortformNarrationView | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [openAi, setOpenAi] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const endpoint = `/api/admin/marketing-review/${encodeURIComponent(candidateId)}/shortform-narration`;

  const apply = useCallback((next: ShortformNarrationView) => {
    setView(next);
    setDrafts(Object.fromEntries(next.segments.map((segment) => [segment.segmentId, segment.text])));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const data = (await res.json()) as ShortformNarrationView & { message?: string };
      if (!res.ok) {
        setMessage(data.message ?? "숏폼 내레이션을 불러오지 못했습니다.");
        return;
      }
      apply(data);
      setMessage(null);
    } catch {
      setMessage("숏폼 내레이션을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [apply, endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () => (view?.segments ?? []).some((segment) => (drafts[segment.segmentId] ?? "").trim() !== segment.text),
    [drafts, view],
  );

  async function save() {
    if (!view) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          segments: view.segments.map((segment) => ({
            segmentId: segment.segmentId,
            text: drafts[segment.segmentId] ?? segment.text,
          })),
        }),
      });
      const data = (await res.json()) as ShortformNarrationSaveResult & { message?: string };
      if (!res.ok) {
        setMessage(data.message ?? "내레이션 저장에 실패했습니다.");
        return;
      }
      apply(data);
      setMessage(shortformNarrationSaveMessage(data));
      await onSaved?.();
    } catch {
      setMessage("내레이션 저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  const fallback = (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-muted)] p-3 text-xs">
      {sanitizeTextForDisplay(fallbackBody, 4000)}
    </pre>
  );

  if (loading && !view) return fallback;
  if (!view?.applicable) {
    const reason = message ?? view?.blockedReason ?? null;
    return (
      <div className="space-y-2">
        {fallback}
        {reason ? <p className="text-sm text-[var(--text-secondary)]">{reason}</p> : null}
      </div>
    );
  }

  const editable = canEdit && view.editable && !busy;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-[var(--text-secondary)]">
          세그먼트 {view.segments.length}개 · 자막도 같은 문구로 바뀝니다
        </span>
        {view.render ? (
          <span
            className={cn(
              "rounded-lg border border-[var(--border)] px-2 py-0.5",
              view.render.uiStatus === "ready" ? adminToneText.success : adminToneText.warning,
            )}
          >
            {renderLine(view.render)}
          </span>
        ) : null}
      </div>
      {view.target === "publishable_slot" ? (
        <p className="text-xs text-[var(--text-secondary)]">
          이 후보는 숏폼 영상 제작(렌더) 대상이 아니어서 수정한 문안만 저장됩니다.
        </p>
      ) : null}
      {view.render?.narrationStale ? (
        <p className={cn("text-xs", adminToneText.warning)}>
          현재 영상은 이전 내레이션 기준입니다. 현재 문구로 렌더가 READY가 되어야 승인할 수 있습니다.
        </p>
      ) : null}
      {view.blockedReason ? (
        <p className={cn("text-xs", adminToneText.warning)}>{view.blockedReason}</p>
      ) : null}

      <ol className="space-y-3">
        {view.segments.map((segment, index) => {
          const value = drafts[segment.segmentId] ?? segment.text;
          const length = value.trim().length;
          const edited = value.trim() !== segment.aiText;
          return (
            <li key={segment.segmentId} className="space-y-1 rounded-lg border border-[var(--border)] p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
                <span>
                  {index + 1}. {PURPOSE_LABELS[segment.purpose] ?? segment.purpose}
                  {segment.sceneId ? <span className="font-mono"> · {segment.sceneId}</span> : null}
                </span>
                <span className="flex items-center gap-2">
                  {edited ? <span className={adminToneText.warning}>사람 수정</span> : null}
                  <span className={length === 0 || length > view.maxLength ? adminToneText.danger : undefined}>
                    {length}/{view.maxLength}
                  </span>
                </span>
              </div>
              <textarea
                aria-label={`내레이션 ${index + 1}`}
                value={value}
                rows={3}
                disabled={!editable}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [segment.segmentId]: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
              {edited ? (
                <div className="text-xs text-[var(--text-secondary)]">
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setOpenAi((prev) => ({ ...prev, [segment.segmentId]: !prev[segment.segmentId] }))}
                  >
                    {openAi[segment.segmentId] ? "AI 원문 숨기기" : "AI 원문 보기"}
                  </button>
                  {openAi[segment.segmentId] ? (
                    <p className="mt-1 whitespace-pre-wrap">{segment.aiText}</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <AdminButton type="button" disabled={!editable || !dirty} onClick={() => void save()}>
          내레이션 저장
        </AdminButton>
        {dirty ? <span className="text-xs text-[var(--text-secondary)]">저장하지 않은 수정이 있습니다.</span> : null}
      </div>
      {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
    </div>
  );
}
