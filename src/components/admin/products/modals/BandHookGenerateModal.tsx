"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, RefreshCw, Share2, X } from "lucide-react";
import type {
  BandHookGenerateModalProps,
  BandHookModalFetchState,
} from "./bandHookModal.types";
import type { BandHookApiResponse } from "@/lib/blog/blogPost.types";

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

export default function BandHookGenerateModal({
  open,
  productId,
  productTitle,
  onClose,
  onCopied,
}: BandHookGenerateModalProps) {
  const [state, setState] = useState<BandHookModalFetchState>({ status: "idle" });
  const [draft, setDraft] = useState("");
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!productId?.trim()) return;

    setState({ status: "loading" });
    setCopyHint(null);

    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(productId.trim())}/band-hook`, {
        method: "GET",
        credentials: "same-origin",
      });

      const data = (await res.json()) as BandHookApiResponse;

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
      setCopyHint("밴드 훅 문구가 클립보드에 복사되었습니다.");
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
      aria-labelledby="band-hook-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="band-hook-modal-title"
              className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
            >
              <Share2 className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              밴드 공유용 훅 생성
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              블로그 글을 밴드로 공유한 뒤, 밴드 글 수정 화면 상단에 붙일 짧은 문구입니다.
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
            밴드 훅 문구를 생성하는 중입니다…
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
              <p className="font-semibold text-[var(--text-primary)]">사용 방법</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4">
                <li>네이버 블로그 글을 밴드로 공유합니다.</li>
                <li>공유된 밴드 글 수정 화면으로 들어갑니다.</li>
                <li>아래 문구를 복사해서 공유글 상단에 붙여넣습니다.</li>
              </ol>
              <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                블로그 공유 카드는 설명용으로 유지되며, 이 문구 하단에는 상품 상세 페이지 링크가 포함됩니다.
                해당 링크를 통해 바로 조건 확인 및 문의가 가능합니다.
              </p>
            </div>

            <div className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3 text-xs text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">생성 요약</p>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                <li>서버 생성 글자 수: {state.meta.characterCount.toLocaleString("ko-KR")}</li>
                <li>줄 수: {state.meta.lineCount.toLocaleString("ko-KR")}</li>
                <li>가격 문장 포함: {state.meta.hasPrice ? "예" : "아니오"}</li>
                <li>일정 키워드 반영: {state.meta.hasScheduleKeyword ? "예" : "아니오"}</li>
                <li>타겟 문장 반영: {state.meta.hasTargetKeyword ? "예" : "아니오"}</li>
                <li>상품 링크 포함: {state.meta.hasProductLink ? "예" : "아니오"}</li>
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
                밴드 공유글 상단 문구
              </label>
              <span className="text-[11px] text-[var(--text-muted)]">
                {draft.length.toLocaleString("ko-KR")}자
              </span>
            </div>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="h-[280px] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 font-sans text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap"
              spellCheck={false}
              aria-label="생성된 밴드 훅 문구"
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
