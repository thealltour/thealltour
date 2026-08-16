"use client";

import { useCallback, useEffect, useState } from "react";
import { AtSign, RefreshCw, Send, X } from "lucide-react";
import {
  THREADS_MARKETING_MODES,
  type ThreadsMarketingMode,
} from "@/lib/threads/threadCopy.types";
import type { ThreadReplyDestination } from "@/lib/threads/threadReplyDestinations";

const MODE_LABELS: Record<ThreadsMarketingMode, string> = {
  TIMEDEAL: "타임딜 · 실속",
  CURATION: "큐레이션 · 타겟",
  SEASONAL_EXPERIENCE: "시즌 · 경험",
};

type GenerateOk = {
  ok: true;
  draftContent: string;
  heroImageUrl: string | null;
  copy: { targetKeyword: string };
};

type GenerateErr = { ok: false; message: string };
type PublishOk = { ok: true; threads: { permalink: string | null } };
type PublishErr = { ok: false; message: string };

export type ThreadsBlogGenerateModalProps = {
  open: boolean;
  postTitle: string;
  postLink: string;
  destinations: ThreadReplyDestination[];
  onClose: () => void;
  onPublished?: (permalink: string | null) => void;
};

export default function ThreadsBlogGenerateModal({
  open,
  postTitle,
  postLink,
  destinations,
  onClose,
  onPublished,
}: ThreadsBlogGenerateModalProps) {
  const [mode, setMode] = useState<ThreadsMarketingMode>("CURATION");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [replyDestinationUrl, setReplyDestinationUrl] = useState("");
  const [permalink, setPermalink] = useState<string | null>(null);

  const resetDraft = useCallback(() => {
    setError(null);
    setDraftContent("");
    setTargetKeyword("");
    setImageUrl("");
    setPermalink(null);
    setConfirming(false);
  }, []);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setMode("CURATION");
        setLoading(false);
        setPublishing(false);
        setReplyDestinationUrl("");
        resetDraft();
      });
      return;
    }
    queueMicrotask(() => {
      setReplyDestinationUrl((prev) => {
        if (prev && destinations.some((d) => d.url === prev)) return prev;
        return destinations[0]?.url ?? "";
      });
    });
  }, [open, resetDraft, destinations]);

  const generate = useCallback(async () => {
    if (!postLink?.trim()) return;
    setLoading(true);
    setError(null);
    setPermalink(null);
    try {
      const res = await fetch("/api/admin/threads/generate-blog", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link: postLink.trim(), marketingMode: mode }),
      });
      const data = (await res.json()) as GenerateOk | GenerateErr;
      if (!res.ok || !data.ok) {
        setError(!data.ok ? data.message : `요청 실패 (${res.status})`);
        return;
      }
      setDraftContent(data.draftContent);
      setTargetKeyword(data.copy.targetKeyword);
      setImageUrl(data.heroImageUrl ?? "");
    } catch {
      setError("네트워크 오류로 생성하지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [mode, postLink]);

  const publish = useCallback(async () => {
    if (
      !postLink?.trim() ||
      !draftContent.trim() ||
      !targetKeyword.trim() ||
      !replyDestinationUrl.trim()
    ) {
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/threads/publish-blog", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: postLink.trim(),
          draftContent: draftContent.trim(),
          targetKeyword: targetKeyword.trim(),
          imageUrl: imageUrl.trim() || undefined,
          replyDestinationUrl: replyDestinationUrl.trim(),
        }),
      });
      const data = (await res.json()) as PublishOk | PublishErr;
      if (!res.ok || !data.ok) {
        setError(!data.ok ? data.message : `게시 실패 (${res.status})`);
        return;
      }
      setPermalink(data.threads.permalink);
      setConfirming(false);
      onPublished?.(data.threads.permalink);
    } catch {
      setError("네트워크 오류로 게시하지 못했습니다.");
    } finally {
      setPublishing(false);
    }
  }, [draftContent, imageUrl, onPublished, postLink, replyDestinationUrl, targetKeyword]);

  if (!open) return null;

  const canPublish = Boolean(
    draftContent.trim() &&
      targetKeyword.trim() &&
      replyDestinationUrl.trim() &&
      destinations.length > 0 &&
      !loading &&
      !publishing,
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="threads-blog-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,840px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="threads-blog-modal-title"
              className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
            >
              <AtSign className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              블로그 Threads 카피
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              RSS 글로 초안을 만든 뒤 검수하고, 유도 URL을 고른 다음 Threads에 게시합니다.
            </p>
            <p className="mt-1 truncate text-sm text-[var(--text-secondary)]" title={postTitle}>
              {postTitle || "(제목 없음)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[12rem] flex-1 text-xs font-semibold text-[var(--text-primary)]">
              마케팅 모드
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as ThreadsMarketingMode)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-normal"
              >
                {THREADS_MARKETING_MODES.map((value) => (
                  <option key={value} value={value}>
                    {MODE_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={loading || !postLink}
              onClick={() => void generate()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              {loading ? "생성 중…" : draftContent ? "다시 생성" : "초안 생성"}
            </button>
          </div>

          {error ? (
            <div className="mb-3 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          {permalink ? (
            <div className="mb-3 rounded-lg border border-[var(--success)]/30 bg-[var(--success-bg)] px-3 py-2 text-sm text-[var(--success)]">
              게시되었습니다.{" "}
              {permalink ? (
                <a href={permalink} target="_blank" rel="noreferrer" className="font-semibold underline">
                  Threads에서 보기
                </a>
              ) : (
                "permalink는 아직 확인되지 않았습니다."
              )}
            </div>
          ) : null}

          <label className="mb-3 block text-xs font-semibold text-[var(--text-primary)]">
            자동답글 유도 URL
            {destinations.length === 0 ? (
              <p className="mt-1 text-sm font-normal text-[var(--danger)]">
                먼저 아래(또는 페이지 상단)에서 유도 URL을 추가·저장하세요.
              </p>
            ) : (
              <select
                value={replyDestinationUrl}
                onChange={(e) => setReplyDestinationUrl(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-normal"
              >
                {destinations.map((dest) => (
                  <option key={dest.id} value={dest.url}>
                    {dest.label} — {dest.url}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="mb-3 block text-xs font-semibold text-[var(--text-primary)]">
            댓글 감지 키워드
            <input
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-normal"
              placeholder="예: 발리골프"
            />
          </label>

          <label className="mb-3 block text-xs font-semibold text-[var(--text-primary)]">
            이미지 URL (선택)
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 font-mono text-xs font-normal"
              placeholder="https://"
            />
          </label>

          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="text-xs font-semibold text-[var(--text-primary)]" htmlFor="threads-blog-draft">
              게시 원고
            </label>
            <span className="text-[11px] text-[var(--text-muted)]">
              {draftContent.length.toLocaleString("ko-KR")}자
            </span>
          </div>
          <textarea
            id="threads-blog-draft"
            value={draftContent}
            onChange={(e) => setDraftContent(e.target.value)}
            className="h-[200px] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap"
            spellCheck={false}
            placeholder="초안 생성 후 여기서 검수하세요."
          />
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          {confirming ? (
            <>
              <p className="mr-auto text-xs text-[var(--text-secondary)]">
                이 원고를 Threads에 지금 게시할까요?
              </p>
              <button
                type="button"
                disabled={publishing}
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                취소
              </button>
              <button
                type="button"
                disabled={publishing}
                onClick={() => void publish()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden />
                {publishing ? "게시 중…" : "확인"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                닫기
              </button>
              <button
                type="button"
                disabled={!canPublish}
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden />
                Threads 게시
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
