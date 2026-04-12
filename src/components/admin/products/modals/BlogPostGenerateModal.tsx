"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Copy, RefreshCw, X } from "lucide-react";
import type { BlogPostGenerateModalProps, BlogPostModalFetchState } from "./blogPostModal.types";
import type { BlogPostApiResponse, BlogPostType, BlogPostsThreePack } from "@/lib/blog/blogPost.types";
import { applyBlogCtaCandidate, applyBlogTitleCandidate } from "@/lib/blog/blogPost.draftEdit";

const ADMIN_EDIT_TIPS: string[] = [
  "첫 문장(제목 후보)을 브랜드 톤에 맞게 다듬으면 읽기 흐름이 좋아질 수 있습니다.",
  "가격·기간·포함 조건은 실제 상세페이지와 대조해 숫자·표현을 보정해 주세요.",
  "CTA 문장은 운영 방침에 맞게 한 번 손봐도 좋습니다.",
];

const candidateBtnClass =
  "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left text-sm leading-snug text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30";

const BLOG_POST_TABS: { id: BlogPostType; label: string }[] = [
  { id: "info", label: "정보형" },
  { id: "deal", label: "특가형" },
  { id: "compare", label: "비교형" },
];

export default function BlogPostGenerateModal({
  open,
  productId,
  productTitle,
  onClose,
  onCopied,
}: BlogPostGenerateModalProps) {
  const [state, setState] = useState<BlogPostModalFetchState>({ status: "idle" });
  const [activeType, setActiveType] = useState<BlogPostType>("info");
  const [draftByType, setDraftByType] = useState<BlogPostsThreePack | null>(null);
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
        posts: data.posts,
        metaByType: data.metaByType,
        titleCandidatesByType: data.titleCandidatesByType,
        ctaCandidates: data.ctaCandidates,
      });
      setDraftByType(data.posts);
      setActiveType("info");
    } catch {
      setState({ status: "error", message: "네트워크 오류로 불러오지 못했습니다." });
    }
  }, [productId]);

  useEffect(() => {
    if (!open) {
      queueMicrotask(() => {
        setState({ status: "idle" });
        setDraftByType(null);
        setActiveType("info");
        setCopyHint(null);
      });
      return;
    }
    queueMicrotask(() => {
      void load();
    });
  }, [open, load]);

  const currentDraft = draftByType?.[activeType] ?? "";

  const handleCopyBody = async () => {
    if (state.status !== "ok" || !draftByType) return;
    try {
      await navigator.clipboard.writeText(currentDraft);
      const label = BLOG_POST_TABS.find((t) => t.id === activeType)?.label ?? "";
      setCopyHint(`${label} 본문이 클립보드에 복사되었습니다.`);
      onCopied?.();
      setTimeout(() => setCopyHint(null), 4000);
    } catch {
      setCopyHint("클립보드 복사에 실패했습니다. 아래 영역에서 직접 선택해 복사해 주세요.");
    }
  };

  if (!open) return null;

  const meta = state.status === "ok" ? state.metaByType[activeType] : null;

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
              동일 상품 기준 정보형·특가형·비교형 3종이 생성됩니다. 미리보기·HTML·Markdown은 포함되지 않습니다.
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
                    {currentDraft.length.toLocaleString("ko-KR")}
                  </span>
                </li>
                <li>
                  본문 블록 수:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">{meta.sectionCount}</span>
                </li>
                <li>일정 요약 반영: {meta.hasTimelineSummary ? "예" : "아니오(안내 위주)"}</li>
                <li>포함·불포함 블록: {meta.hasIncludedSection ? "있음" : "생략 또는 요약만"}</li>
                <li>유의사항 블록: 생성 본문에 포함하지 않음</li>
              </ul>
              <p className="border-t border-[var(--border)] pt-2 text-[11px] leading-snug text-[var(--text-muted)]">
                탭마다 톤이 다릅니다. 네이버 블로그에 붙여넣은 뒤{" "}
                <span className="font-medium text-[var(--text-primary)]">1차 수정</span>을 권장합니다. 제목·CTA 후보는{" "}
                <span className="font-medium text-[var(--text-primary)]">현재 탭</span> 본문에만 반영됩니다.
              </p>
              <p className="text-[11px] leading-snug text-[var(--text-secondary)]">
                ※ 본 글은 유입용 요약입니다. 상세 조건은 반드시 링크에서 확인하세요.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {BLOG_POST_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveType(tab.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 ${
                      activeType === tab.id
                        ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--text-primary)]"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void handleCopyBody()}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  현재 탭 복사
                </button>
              </div>

              <div className="mb-4 space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-3">
                <div>
                  <h4 className="text-xs font-semibold text-[var(--text-primary)]">제목 후보 (현재 탭)</h4>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    클릭 시 현재 탭 본문의 첫 줄(제목)만 바뀝니다.
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {state.titleCandidatesByType[activeType].map((t, i) => (
                      <button
                        key={`title-${activeType}-${i}-${t.slice(0, 24)}`}
                        type="button"
                        className={candidateBtnClass}
                        onClick={() =>
                          setDraftByType((prev) =>
                            prev
                              ? { ...prev, [activeType]: applyBlogTitleCandidate(prev[activeType], t) }
                              : prev,
                          )
                        }
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-[var(--border)] pt-3">
                  <h4 className="text-xs font-semibold text-[var(--text-primary)]">CTA 후보 (현재 탭)</h4>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    클릭 시 본문에서 <span className="font-medium text-[var(--text-primary)]">가장 아래에 있는 👉 줄</span>이 시작하는 블록만 후보 문단(링크 포함)으로 바뀝니다. (특가형은 최종 CTA, 비교형은 비교 기준 확인 등)
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {state.ctaCandidates.map((c, i) => (
                      <button
                        key={`cta-${i}-${c.slice(0, 24)}`}
                        type="button"
                        className={candidateBtnClass}
                        onClick={() =>
                          setDraftByType((prev) =>
                            prev
                              ? { ...prev, [activeType]: applyBlogCtaCandidate(prev[activeType], c) }
                              : prev,
                          )
                        }
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="mb-1 block text-xs font-semibold text-[var(--text-primary)]">
                본문 — {BLOG_POST_TABS.find((t) => t.id === activeType)?.label} (직접 수정 가능)
              </label>
              <textarea
                value={currentDraft}
                onChange={(e) =>
                  setDraftByType((prev) =>
                    prev ? { ...prev, [activeType]: e.target.value } : prev,
                  )
                }
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
                현재 탭 본문 복사
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
