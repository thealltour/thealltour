"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, MessageCircle, RefreshCw, X } from "lucide-react";
import type {
  KakaoPostGenerateModalProps,
  KakaoPostModalFetchState,
} from "./kakaoPostModal.types";
import type { KakaoPostApiResponse } from "@/lib/blog/blogPost.types";

function applyFirstLine(fullText: string, firstLine: string): string {
  const t = firstLine.trim();
  if (!t) return fullText;

  const lines = fullText.split(/\r?\n/);
  if (lines.length === 0) return t;

  lines[0] = t;
  return lines.join("\n");
}

const candidateBtnClass =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm leading-snug text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30";

export default function KakaoPostGenerateModal({
  open,
  productId,
  productTitle,
  onClose,
  onCopied,
}: KakaoPostGenerateModalProps) {
  const [state, setState] = useState<KakaoPostModalFetchState>({ status: "idle" });
  const [draft, setDraft] = useState("");
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!productId?.trim()) return;

    setState({ status: "loading" });
    setCopyHint(null);

    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(productId.trim())}/kakao-post`, {
        method: "GET",
        credentials: "same-origin",
      });

      const data = (await res.json()) as KakaoPostApiResponse;

      if (!res.ok || !data.ok) {
        setState({
          status: "error",
          message: !data.ok ? data.message : `요청 실패 (${res.status})`,
        });
        return;
      }

      setState({
        status: "ok",
        text: data.text,
        meta: data.meta,
        hookCandidates: data.hookCandidates,
      });
      setDraft(data.text);
    } catch {
      setState({ status: "error", message: "네트워크 오류로 불러오지 못했습니다." });
    }
  }, [productId]);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setState({ status: "idle" });
        setDraft("");
        setCopyHint(null);
      });
      return;
    }

    queueMicrotask(() => {
      void load();
    });
  }, [open, load]);

  const handleCopy = async () => {
    if (!draft.trim()) return;

    try {
      await navigator.clipboard.writeText(draft);
      setCopyHint("카카오채널 게시글이 클립보드에 복사되었습니다.");
      onCopied?.();
      setTimeout(() => setCopyHint(null), 4000);
    } catch {
      setCopyHint("클립보드 복사에 실패했습니다. 아래 영역에서 직접 선택해 복사해 주세요.");
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kakao-post-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="kakao-post-modal-title"
              className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
            >
              <MessageCircle className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              카카오채널 게시글 생성
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              쇼츠·릴스 유입 뒤 바로 채팅 문의를 유도하는 초단문 게시글입니다.
            </p>
            <p className="mt-1 truncate text-sm text-[var(--text-secondary)]" title={productTitle}>
              {productTitle || "(제목 없음)"}
              {productId ? (
                <span className="ml-2 font-mono text-xs text-[var(--text-muted)]">· {productId}</span>
              ) : null}
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

        {state.status === "loading" ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">
            카카오채널 게시글을 생성하는 중입니다…
          </div>
        ) : null}

        {state.status === "error" ? (
          <div className="mx-4 my-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]">
            {state.message}
            <button
              type="button"
              onClick={() => void load()}
              className="ml-2 font-semibold underline-offset-2 hover:underline"
            >
              다시 시도
            </button>
          </div>
        ) : null}

        {state.status === "ok" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 p-3 text-xs text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">사용 방향</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>짧게 읽고 바로 채팅 문의하도록 유도하는 텍스트입니다.</li>
                <li>긴 설명이나 링크 없이 핵심 조건과 CTA만 남기는 구성을 권장합니다.</li>
                <li>첫 줄 후보를 눌러 후킹 강도를 바로 바꿀 수 있습니다.</li>
              </ul>
            </div>

            <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3 text-xs text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">생성 요약</p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                <li>서버 생성 글자 수: {state.meta.characterCount.toLocaleString("ko-KR")}</li>
                <li>줄 수: {state.meta.lineCount.toLocaleString("ko-KR")}</li>
                <li>가격 문장 포함: {state.meta.hasPrice ? "예" : "아니오"}</li>
                <li>타겟 문장 포함: {state.meta.hasTarget ? "예" : "아니오"}</li>
              </ul>
            </div>

            <div className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
              <h4 className="text-xs font-semibold text-[var(--text-primary)]">첫 줄 후보</h4>
              <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                클릭 시 본문의 첫 줄만 교체됩니다.
              </p>
              <div className="mt-2 flex flex-col gap-1.5">
                {state.hookCandidates.map((candidate, index) => (
                  <button
                    key={`${index}-${candidate.slice(0, 24)}`}
                    type="button"
                    className={candidateBtnClass}
                    onClick={() => setDraft((prev) => applyFirstLine(prev, candidate))}
                  >
                    {candidate}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-[var(--text-primary)]">
                카카오채널 게시글
              </label>
              <span className="text-[11px] text-[var(--text-muted)]">
                {draft.length.toLocaleString("ko-KR")}자
              </span>
            </div>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-[240px] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 font-sans text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap"
              spellCheck={false}
              aria-label="생성된 카카오채널 게시글"
            />

            {copyHint ? (
              <p className="mt-2 text-center text-xs font-medium text-[var(--success)]">
                {copyHint}
              </p>
            ) : null}
          </div>
        ) : null}

        <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            닫기
          </button>

          {state.status === "ok" ? (
            <>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                다시 생성
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
              >
                <Copy className="h-4 w-4" aria-hidden />
                복사
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
