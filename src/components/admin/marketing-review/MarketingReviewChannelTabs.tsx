"use client";

import { useEffect, useMemo, useState } from "react";
import type { MorningChannelReviewView, MorningMarketingReviewContext } from "@/lib/marketing/review/morningReview/types";
import type { ReviewablePublishableChannel } from "@/lib/marketing/review/channelReviews";
import { sanitizeTextForDisplay } from "@/lib/marketing/review/textDisplay";

type Props = {
  context: MorningMarketingReviewContext;
  canEdit: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onMessage: (message: string | null) => void;
  onReload: () => Promise<void>;
  selectedChannel: string;
  onSelectChannel: (channel: ReviewablePublishableChannel | string) => void;
};

export function MarketingReviewChannelTabs({
  context,
  canEdit,
  busy,
  onBusy,
  onMessage,
  onReload,
  selectedChannel,
  onSelectChannel,
}: Props) {
  const channels = context.channelReviews ?? [];
  const active: MorningChannelReviewView | undefined =
    channels.find((c) => c.channel === selectedChannel) ?? channels[0];

  const [title, setTitle] = useState(active?.title ?? "");
  const [body, setBody] = useState(active?.body ?? "");
  const [showTitleCandidates, setShowTitleCandidates] = useState(false);
  const [showAiOriginal, setShowAiOriginal] = useState(false);

  useEffect(() => {
    if (!active) return;
    setTitle(active.title ?? "");
    setBody(active.body);
    setShowTitleCandidates(false);
    setShowAiOriginal(false);
  }, [active?.channel, active?.title, active?.body, active?.source]);

  const editable = canEdit && active && active.channel !== "shortform";

  async function saveChannel() {
    if (!active || active.channel === "shortform") return;
    onBusy(true);
    onMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(context.identity.candidateId)}/channel-draft`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: active.channel,
            title: title || null,
            body,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.message === "string" ? data.message : "save_failed");
      await onReload();
      onMessage(`${active.label} 초안을 저장했습니다.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "save_failed");
    } finally {
      onBusy(false);
    }
  }

  async function setStatus(status: "approved" | "skipped" | "needs_review") {
    if (!active) return;
    onBusy(true);
    onMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(context.identity.candidateId)}/channel-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel: active.channel, status }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.message === "string" ? data.message : "status_failed");
      await onReload();
      onMessage(`${active.label}: ${status}`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "status_failed");
    } finally {
      onBusy(false);
    }
  }

  async function regenerate(allowOverwriteHuman = false) {
    if (!active || active.channel === "shortform") return;
    onBusy(true);
    onMessage(null);
    try {
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(context.identity.candidateId)}/channel-regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: active.channel,
            allowOverwriteHuman,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const ok = window.confirm(
          "이 채널에 사람 수정본이 있습니다. AI 초안으로 덮어쓸까요?",
        );
        if (ok) {
          await regenerate(true);
        }
        return;
      }
      if (!res.ok) throw new Error(typeof data.message === "string" ? data.message : "regenerate_failed");
      await onReload();
      onMessage(`${active.label} 재생성 완료 (외부 리서치 0회).`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "regenerate_failed");
    } finally {
      onBusy(false);
    }
  }

  const summaryChips = useMemo(
    () =>
      channels.map((c) => (
        <span key={c.channel} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs">
          {c.label}: <strong>{c.statusLabel}</strong>
        </span>
      )),
    [channels],
  );

  if (channels.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] p-4 text-sm text-[var(--text-secondary)]">
        생성된 채널 publishable 결과가 없습니다. 패키지/컴포저 생성을 확인하세요.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">{summaryChips}</div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {channels.map((c) => (
          <button
            key={c.channel}
            type="button"
            onClick={() => onSelectChannel(c.channel)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              active?.channel === c.channel
                ? "bg-[var(--primary)] text-white"
                : "border border-[var(--border)]"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {active ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-secondary)]">
            <span>
              상태: <strong>{active.statusLabel}</strong>
            </span>
            <span>소스: {active.source === "human" ? "사람 수정" : "AI 초안"}</span>
            {active.marketingValue ? (
              <span
                className={
                  active.marketingValue.verdict === "strong" ||
                  active.marketingValue.verdict === "publishable"
                    ? "text-emerald-700"
                    : active.marketingValue.verdict === "needs_improvement"
                      ? "text-amber-700"
                      : "text-red-700"
                }
              >
                Value: <strong>{active.marketingValue.verdict}</strong> (
                {active.marketingValue.overallScore})
                {active.marketingValue.stale ? " · stale" : ""}
              </span>
            ) : null}
            {active.validationWarnings.length > 0 ? (
              <span className="text-amber-700">경고 {active.validationWarnings.length}건</span>
            ) : (
              <span className="text-emerald-700">검증 통과</span>
            )}
          </div>

          {active.marketingValue ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs space-y-1">
              <div className="font-medium">Marketing Value (≠ Governance)</div>
              {(active.marketingValue.reasons ?? []).slice(0, 3).map((r) => (
                <div key={r}>· {r}</div>
              ))}
              {(active.marketingValue.improvementHints ?? []).slice(0, 3).map((h) => (
                <div key={h} className="text-amber-800">
                  hint: {h}
                </div>
              ))}
            </div>
          ) : null}

          {active.validationWarnings.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-amber-800">
              {active.validationWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}

          {active.channel === "naver_blog" ? (
            <div className="space-y-2 text-sm">
              <div className="text-[var(--text-secondary)]">
                검색 의도: {active.blogMeta?.searchIntent ?? "—"} · 주제:{" "}
                {active.blogMeta?.primaryTopic ?? "—"}
              </div>
              <label className="block">
                <span className="mb-1 block text-[var(--text-secondary)]">Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!editable || busy}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                />
              </label>
              {active.blogMeta?.titleCandidates && active.blogMeta.titleCandidates.length > 1 ? (
                <div>
                  <button
                    type="button"
                    className="text-xs text-[var(--primary)] underline"
                    onClick={() => setShowTitleCandidates((v) => !v)}
                  >
                    {showTitleCandidates ? "제목 후보 숨기기" : "제목 후보 보기"}
                  </button>
                  {showTitleCandidates ? (
                    <ul className="mt-2 list-disc pl-5 text-xs text-[var(--text-secondary)]">
                      {active.blogMeta.titleCandidates.map((t) => (
                        <li key={t}>
                          <button
                            type="button"
                            className="text-left hover:underline"
                            disabled={!editable || busy}
                            onClick={() => setTitle(t)}
                          >
                            {t}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : active.channel !== "shortform" ? (
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--text-secondary)]">Title (optional)</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={!editable || busy}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
          ) : null}

          {active.channel === "shortform" ? (
            <div className="space-y-2 text-sm">
              <p className="text-[var(--text-secondary)]">
                Shortform 내레이션/렌더 상태는 아래 Shortform 패널에서 소스 PICK·렌더·미리보기를 확인하세요.
                이 탭에서는 승인만 가능하며 READY 게이트가 적용됩니다. 재생성 UI는 노출하지 않습니다.
              </p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-muted)] p-3 text-xs">
                {sanitizeTextForDisplay(active.body, 4000)}
              </pre>
            </div>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--text-secondary)]">Body</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={!editable || busy}
                rows={active.channel === "naver_blog" ? 18 : 10}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-[13px]"
              />
            </label>
          )}

          <div className="flex flex-wrap gap-2">
            {active.channel !== "shortform" ? (
              <button
                type="button"
                disabled={!editable || busy}
                onClick={() => void saveChannel()}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                채널 저장
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy || context.governance.decision === "BLOCK"}
              onClick={() => void setStatus("approved")}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              채널 승인
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void setStatus("skipped")}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
            >
              채널 Skip
            </button>
            {active.channel !== "shortform" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void regenerate(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
              >
                채널만 재생성
              </button>
            ) : null}
            <button
              type="button"
              className="text-xs text-[var(--primary)] underline"
              onClick={() => setShowAiOriginal((v) => !v)}
            >
              {showAiOriginal ? "AI 원본 숨기기" : "AI 원본 보기"}
            </button>
          </div>

          {showAiOriginal ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)]">
              {sanitizeTextForDisplay(
                `${active.aiTitle ? `${active.aiTitle}\n\n` : ""}${active.aiBody}`,
                3000,
              )}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
