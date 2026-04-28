"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Copy, RefreshCw, X } from "lucide-react";
import type { BlogPostGenerateModalProps, BlogPostModalFetchState } from "./blogPostModal.types";
import type { BlogPostApiResponse } from "@/lib/blog/blogPost.types";
import { applyBlogCtaCandidate, applyBlogTitleCandidate } from "@/lib/blog/blogPost.draftEdit";

const ADMIN_EDIT_TIPS: string[] = [
  "본문의 [사진 n: ...] 위치에 네이버 블로그 에디터에서 직접 이미지를 추가해 주세요.",
  "제목은 지역·기간·가격·포함 조건이 자연스럽게 드러나도록 다듬어 주세요.",
  "예약 유의사항과 환불 규정은 실제 상세페이지와 대조해 표현을 보정해 주세요.",
  "CTA 문장은 현재 운영 중인 문의 방식에 맞게 마지막에 한 번 더 확인해 주세요.",
];

const candidateBtnClass =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm leading-snug text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30";

export default function BlogPostGenerateModal({
  open,
  productId,
  productTitle,
  onClose,
  onCopied,
}: BlogPostGenerateModalProps) {
  const [state, setState] = useState<BlogPostModalFetchState>({ status: "idle" });
  const [draft, setDraft] = useState("");
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!productId?.trim()) return;
    setState({ status: "loading" });
    setCopyHint(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(productId.trim())}/blog-post`, {
        method: "GET",
        credentials: "same-origin",
      });
      const data = (await res.json()) as BlogPostApiResponse;
      if (!res.ok || !data.ok) {
        setState({
          status: "error",
          message: !data.ok ? data.message : `요청 실패 (${res.status})`,
        });
        return;
      }
      setState({
        status: "ok",
        post: data.post,
        meta: data.meta,
        titleCandidates: data.titleCandidates,
        ctaCandidates: data.ctaCandidates,
      });
      setDraft(data.post);
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

  const handleCopyBody = async () => {
    if (state.status !== "ok") return;
    try {
      await navigator.clipboard.writeText(draft);
      setCopyHint("블로그 본문이 클립보드에 복사되었습니다.");
      onCopied?.();
      setTimeout(() => setCopyHint(null), 4000);
    } catch {
      setCopyHint("클립보드 복사에 실패했습니다. 아래 영역에서 직접 선택해 복사해 주세요.");
    }
  };

  if (!open) return null;

  const meta = state.status === "ok" ? state.meta : null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blog-post-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,900px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="blog-post-modal-title"
              className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
            >
              <BookOpen className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              블로그 텍스트 생성
            </h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              상품 1개 기준으로 검색 유입과 문의 전환을 함께 고려한 블로그 글 1개가 생성됩니다.
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
          <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">텍스트를 생성하는 중입니다…</div>
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

        {state.status === "ok" && meta ? (
          <>
            <div className="shrink-0 space-y-2 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-3 text-xs text-[var(--text-secondary)]">
              <p className="font-semibold text-[var(--text-primary)]">생성 요약</p>
              <ul className="grid gap-1 sm:grid-cols-2">
                <li>
                  서버 생성 글자 수:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {meta.characterCount.toLocaleString("ko-KR")}
                  </span>
                </li>
                <li>
                  현재 탭 편집 글자 수:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {draft.length.toLocaleString("ko-KR")}
                  </span>
                </li>
                <li>
                  본문 블록 수:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">{meta.sectionCount}</span>
                </li>
                <li>일정 요약 반영: {meta.hasTimelineSummary ? "예" : "아니오(안내 위주)"}</li>
                <li>포함·불포함 블록: {meta.hasIncludedSection ? "있음" : "생략 또는 요약만"}</li>
                <li>유의사항 블록: {meta.hasNoticeSection ? "요약 반영" : "미반영"}</li>
              </ul>
              <p className="border-t border-[var(--border)] pt-2 text-[11px] leading-snug text-[var(--text-muted)]">
                네이버 블로그에 붙여넣은 뒤{" "}
                <span className="font-medium text-[var(--text-primary)]">1차 수정</span>을 권장합니다. 제목·CTA 후보는{" "}
                <span className="font-medium text-[var(--text-primary)]">현재 본문</span>에만 반영됩니다.
              </p>
              <p className="text-[11px] leading-snug text-[var(--text-secondary)]">
                ※ 본 글은 유입용 요약입니다. 상세 조건은 반드시 링크에서 확인하세요.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm font-semibold text-[var(--text-primary)]">
                  단일 롱폼
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyBody()}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  본문 복사
                </button>
              </div>

              <div className="mb-4 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-primary)]">제목 후보</h4>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    클릭 시 본문의 첫 줄(제목)만 바뀝니다.
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {state.titleCandidates.map((t, i) => (
                      <button
                        key={`title-${i}-${t.slice(0, 24)}`}
                        type="button"
                        className={candidateBtnClass}
                        onClick={() => setDraft((prev) => applyBlogTitleCandidate(prev, t))}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-[var(--border)] pt-3">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)]">CTA 후보</h4>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    클릭 시 본문에서 <span className="font-medium text-[var(--text-primary)]">가장 아래에 있는 👉 줄</span>이 시작하는 블록만 후보 문단(링크 포함)으로 바뀝니다.
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {state.ctaCandidates.map((c, i) => (
                      <button
                        key={`cta-${i}-${c.slice(0, 24)}`}
                        type="button"
                        className={candidateBtnClass}
                        onClick={() => setDraft((prev) => applyBlogCtaCandidate(prev, c))}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="mb-1 block text-xs font-semibold text-[var(--text-primary)]">
                본문 — 단일 롱폼 (직접 수정 가능)
              </label>
              <p className="mb-2 text-[11px] leading-snug text-[var(--text-muted)]">
                ※ [사진 n: ...] 줄은 네이버 블로그 작성 시 사진을 직접 넣기 위한 위치 가이드입니다.
                게시 전 해당 줄을 삭제하거나 사진으로 대체해 주세요.
              </p>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="h-[min(52vh,480px)] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 font-sans text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap"
                spellCheck={false}
                aria-label="생성된 블로그 본문"
              />
              {copyHint ? (
                <p className="mt-2 text-center text-xs font-medium text-[var(--success)]">{copyHint}</p>
              ) : null}

              <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--text-secondary)]">
                <p className="font-semibold text-[var(--text-primary)]">추천 수정 포인트</p>
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  아래 항목은 복사되는 본문에 포함되지 않습니다.
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {ADMIN_EDIT_TIPS.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
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
                본문 다시 생성
              </button>
              <button
                type="button"
                onClick={() => void handleCopyBody()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
              >
                <Copy className="h-4 w-4" aria-hidden />
                본문 복사
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
