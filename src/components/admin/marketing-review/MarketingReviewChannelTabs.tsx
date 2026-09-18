"use client";

import { useEffect, useMemo, useState } from "react";
import type { MorningChannelReviewView, MorningMarketingReviewContext } from "@/lib/marketing/review/morningReview/types";
import type { ReviewablePublishableChannel } from "@/lib/marketing/review/channelReviews";
import {
  buildChannelCopyPayload,
  channelBodyCharCount,
  channelFoldPreview,
  channelTitleCharCount,
  type CharCount,
} from "@/lib/marketing/review/channelCopyLimits";
import { sanitizeTextForDisplay } from "@/lib/marketing/review/textDisplay";
import { CopyToClipboardButton } from "@/components/admin/marketing-review/CopyToClipboardButton";

function CharCountBadge({ count }: { count: CharCount }) {
  return (
    <span
      className={
        count.status === "over_limit"
          ? "text-red-700"
          : count.status === "near_limit"
            ? "text-amber-700"
            : "text-[var(--text-secondary)]"
      }
    >
      {count.label}
    </span>
  );
}

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

  const editable = canEdit && active && active.channel !== "shortform" && !active.awaitingGeneration;

  async function saveChannel() {
    if (!active || active.channel === "shortform" || active.awaitingGeneration) return;
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

  const bodyQualityWeak =
    active?.marketingValue?.verdict === "needs_improvement" ||
    active?.marketingValue?.verdict === "reject" ||
    active?.marketingValue?.hardFail === true;

  async function regenerate(
    allowOverwriteHuman = false,
    options?: { qualityRevision?: boolean },
  ) {
    if (!active) return;
    onBusy(true);
    onMessage(null);
    try {
      const qualityRevision = Boolean(options?.qualityRevision);
      const res = await fetch(
        `/api/admin/marketing-review/${encodeURIComponent(context.identity.candidateId)}/channel-regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: active.channel,
            allowOverwriteHuman,
            ...(qualityRevision
              ? {
                  qualityRevision: true,
                  qualityHints: (active.marketingValue?.improvementHints ?? []).slice(0, 8),
                  qualityReasons: (active.marketingValue?.reasons ?? []).slice(0, 6),
                }
              : {}),
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const code = typeof data.code === "string" ? data.code : "";
        if (code === "canonical_asset_unapproved") {
          throw new Error(
            typeof data.message === "string"
              ? data.message
              : "공통 원문 승인 후 채널을 생성하세요.",
          );
        }
        if (data.message === "human_edited_channel_requires_confirm") {
          const ok = window.confirm(
            qualityRevision
              ? "이 채널에 사람 수정본이 있습니다. Channel Editor가 Value 피드백을 반영해 Body를 덮어쓸까요?"
              : "이 채널에 사람 수정본이 있습니다. AI 초안으로 덮어쓸까요?",
          );
          if (ok) {
            await regenerate(true, options);
          }
          return;
        }
      }
      if (!res.ok) {
        const detail =
          typeof data.failureMessage === "string"
            ? data.failureMessage
            : typeof data.hint === "string"
              ? data.hint
              : null;
        const base =
          typeof data.message === "string" ? data.message : "regenerate_failed";
        throw new Error(detail ? `${base}: ${detail}` : base);
      }
      await onReload();
      onMessage(
        qualityRevision
          ? `${active.label} Body 재생성 완료 (Channel Editor · Value 힌트 반영).`
          : active.awaitingGeneration
            ? `${active.label} 생성 완료.`
            : `${active.label} 재생성 완료.`,
      );
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "regenerate_failed");
    } finally {
      onBusy(false);
    }
  }

  const copyPayload = useMemo(
    () => buildChannelCopyPayload({ title, body }),
    [title, body],
  );
  const bodyCount = active ? channelBodyCharCount(active.channel, body) : null;
  const titleCount = active ? channelTitleCharCount(active.channel, title) : null;
  const foldPreview = active ? channelFoldPreview(active.channel, body) : null;

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
            {active.awaitingGeneration ? (
              <span className="text-[var(--text-secondary)]">생성 대기 (정상)</span>
            ) : active.validationWarnings.length > 0 ? (
              <span className="text-amber-700">경고 {active.validationWarnings.length}건</span>
            ) : (
              <span className="text-emerald-700">검증 통과</span>
            )}
          </div>

          {active.stale && !active.awaitingGeneration ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-950">
              공통 원문이 갱신되어 이 채널 초안이 stale입니다. 필요하면 재생성하세요. 자동 재생성하지
              않습니다.
            </div>
          ) : null}

          {active.marketingValue && !active.awaitingGeneration ? (
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

          {active.awaitingGeneration ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2">
              <p className="text-sm text-[var(--text-secondary)]">
                아직 생성하지 않은 채널입니다. Canonical 승인만으로 자동 생성되지 않습니다. 원할 때
                Channel Editor로 이 채널만 생성하세요.
              </p>
              <button
                type="button"
                disabled={busy || context.governance.decision === "BLOCK"}
                onClick={() => void regenerate(false)}
                className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                생성
              </button>
            </div>
          ) : null}

          {bodyQualityWeak && !active.awaitingGeneration ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
              <p className="text-sm text-amber-950">
                Body 품질이 게시 기준에 못 미칩니다. Channel Editor에 Marketing Value 피드백을 넘겨
                Body만 재생성할 수 있습니다.
              </p>
              <button
                type="button"
                disabled={busy || context.governance.decision === "BLOCK"}
                onClick={() => void regenerate(false, { qualityRevision: true })}
                className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                채널 Body 재생성
              </button>
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
                <span className="mb-1 flex items-center justify-between text-[var(--text-secondary)]">
                  <span>Title</span>
                  {titleCount ? <CharCountBadge count={titleCount} /> : null}
                </span>
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
              <span className="mb-1 flex items-center justify-between text-[var(--text-secondary)]">
                <span>Body</span>
                {bodyCount ? <CharCountBadge count={bodyCount} /> : null}
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={!editable || busy}
                rows={active.channel === "naver_blog" ? 18 : 10}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono text-[13px]"
              />
            </label>
          )}

          {foldPreview ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs">
              <div className="mb-1 text-[var(--text-secondary)]">
                더보기 이전에 보이는 부분 (앞 125자)
              </div>
              <p className="whitespace-pre-wrap">
                {sanitizeTextForDisplay(foldPreview.text, 200)}
                {foldPreview.truncated ? <span className="text-[var(--text-secondary)]"> … 더 보기</span> : null}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-2">
            <span className="text-xs text-[var(--text-secondary)]">붙여넣기용 복사:</span>
            <CopyToClipboardButton label="본문" value={copyPayload.body} disabled={busy} />
            {copyPayload.hashtagLine ? (
              <>
                <CopyToClipboardButton
                  label="본문(해시태그 제외)"
                  value={copyPayload.bodyWithoutHashtags}
                  disabled={busy}
                />
                <CopyToClipboardButton
                  label={`해시태그 ${copyPayload.hashtags.length}개`}
                  value={copyPayload.hashtagLine}
                  disabled={busy}
                  title={copyPayload.hashtagLine}
                />
              </>
            ) : null}
            {copyPayload.title ? (
              <CopyToClipboardButton label="제목" value={copyPayload.title} disabled={busy} />
            ) : null}
          </div>

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
            {active.channel !== "shortform" && !active.awaitingGeneration ? (
              <button
                type="button"
                disabled={busy || context.governance.decision === "BLOCK"}
                onClick={() => void regenerate(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
              >
                채널만 재생성
              </button>
            ) : null}
            {active.channel === "shortform" && !active.awaitingGeneration ? (
              <button
                type="button"
                disabled={busy || context.governance.decision === "BLOCK"}
                onClick={() => void regenerate(false)}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
              >
                Shortform 나레이션 재생성
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
