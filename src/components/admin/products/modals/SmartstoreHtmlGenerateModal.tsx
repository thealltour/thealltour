"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileCode2, Copy, RefreshCw, X, Link2 } from "lucide-react";
import type { SmartstoreHtmlGenerateModalProps, SmartstoreHtmlModalFetchState } from "./smartstoreHtmlModal.types";
import type { SmartstoreHtmlApiResponse } from "@/lib/smartstore/smartstoreHtml.types";
import { buildChannelProductUrl } from "@/lib/analytics/utmPropagation";

type TabKey = "preview" | "source";

export default function SmartstoreHtmlGenerateModal({
  open,
  productId,
  productTitle,
  onClose,
  onCopied,
}: SmartstoreHtmlGenerateModalProps) {
  const [tab, setTab] = useState<TabKey>("preview");
  const [state, setState] = useState<SmartstoreHtmlModalFetchState>({ status: "idle" });
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!productId?.trim()) return;
    setState({ status: "loading" });
    setCopyHint(null);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(productId.trim())}/smartstore-html`, {
        method: "GET",
        credentials: "same-origin",
      });
      const data = (await res.json()) as SmartstoreHtmlApiResponse;
      if (!res.ok || !data.ok) {
        setState({
          status: "error",
          message: !data.ok ? data.message : `요청 실패 (${res.status})`,
        });
        return;
      }
      setState({ status: "ok", html: data.html, meta: data.meta });
    } catch {
      setState({ status: "error", message: "네트워크 오류로 불러오지 못했습니다." });
    }
  }, [productId]);

  useEffect(() => {
    if (!open) {
      setState({ status: "idle" });
      setTab("preview");
      setCopyHint(null);
      return;
    }
    void load();
  }, [open, load]);

  const handleCopy = async () => {
    if (state.status !== "ok") return;
    try {
      await navigator.clipboard.writeText(state.html);
      setCopyHint("HTML이 클립보드에 복사되었습니다.");
      onCopied?.();
      setTimeout(() => setCopyHint(null), 4000);
    } catch {
      setCopyHint("클립보드 복사에 실패했습니다. 원문 탭에서 직접 선택해 복사해 주세요.");
    }
  };

  if (!open) return null;

  const meta = state.status === "ok" ? state.meta : null;
  const smartstoreShareUrl = productId?.trim()
    ? buildChannelProductUrl(productId.trim(), "smartstore")
    : "";

  const handleCopyShareUrl = async () => {
    if (!smartstoreShareUrl) return;
    try {
      await navigator.clipboard.writeText(smartstoreShareUrl);
      setCopyHint("스마트스토어용 UTM 상품 URL을 복사했습니다.");
      setTimeout(() => setCopyHint(null), 4000);
    } catch {
      setCopyHint("URL 복사에 실패했습니다.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="smartstore-html-modal-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,880px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="smartstore-html-modal-title"
              className="flex items-center gap-2 text-lg font-bold text-[var(--text-primary)]"
            >
              <FileCode2 className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden />
              스마트스토어 상세설명 HTML 생성
            </h2>
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
          <div className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">HTML을 생성하는 중입니다…</div>
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
            <div className="shrink-0 space-y-3 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-4 py-3 text-xs text-[var(--text-secondary)]">
              {smartstoreShareUrl ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <p className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                    <Link2 className="h-3.5 w-3.5" aria-hidden />
                    스마트스토어 유입용 상품 URL (UTM 포함)
                  </p>
                  <p className="mt-1 break-all text-[11px] text-[var(--text-muted)]">{smartstoreShareUrl}</p>
                  <button
                    type="button"
                    onClick={() => void handleCopyShareUrl()}
                    className="mt-2 rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  >
                    URL 복사
                  </button>
                </div>
              ) : null}
              <div>
                <p className="font-semibold text-[var(--text-primary)]">네이버 업로드 안전성</p>
                <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                  <li>
                    외부 링크:{" "}
                    <span className={meta.safety.hasExternalLinks ? "font-semibold text-[var(--danger)]" : "font-semibold text-[var(--success)]"}>
                      {meta.safety.hasExternalLinks ? "탐지됨(비권장)" : "없음"}
                    </span>
                  </li>
                  <li>
                    http 이미지·속성:{" "}
                    <span
                      className={
                        meta.safety.hasHttpInAttributes ? "font-semibold text-[var(--danger)]" : "font-semibold text-[var(--success)]"
                      }
                    >
                      {meta.safety.hasHttpInAttributes ? "탐지됨" : "없음"}
                    </span>
                  </li>
                  <li>
                    금지 태그·이벤트 핸들러:{" "}
                    <span
                      className={
                        meta.safety.hasForbiddenTagsOrHandlers
                          ? "font-semibold text-[var(--danger)]"
                          : "font-semibold text-[var(--success)]"
                      }
                    >
                      {meta.safety.hasForbiddenTagsOrHandlers ? "탐지됨" : "없음"}
                    </span>
                  </li>
                  <li>
                    안전 assert:{" "}
                    <span className={meta.safety.assertPassed ? "font-semibold text-[var(--success)]" : "font-semibold text-[var(--danger)]"}>
                      {meta.safety.assertPassed ? "통과" : "실패"}
                    </span>
                  </li>
                  <li>
                    최종 https 이미지 수:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">{meta.imageCount}</span>
                  </li>
                  <li>
                    HTML 길이:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {meta.characterCount.toLocaleString("ko-KR")}자
                    </span>
                  </li>
                </ul>
                {meta.safety.hints.length > 0 ? (
                  <p className="mt-1 text-[11px] text-[var(--danger)]">힌트: {meta.safety.hints.join(", ")}</p>
                ) : null}
              </div>
              <div className="border-t border-[var(--border)] pt-2">
                <p className="font-semibold text-[var(--text-primary)]">생성 요약</p>
                <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                  <li>대표 이미지: {meta.hasHeroImage ? "포함" : "없음"}</li>
                  <li>일정 섹션: {meta.hasTimeline ? "포함" : "생략 또는 요약 없음"}</li>
                  <li>포함·불포함: {meta.hasIncludedExcluded ? "내용 있음" : "본문 없음"}</li>
                  <li>선택 관광: {meta.hasOptionalTours ? "포함" : "생략"}</li>
                </ul>
                <p className="mt-1 text-[11px] leading-snug text-[var(--text-muted)]">
                  포함 섹션: {meta.includedSections.join(" · ")}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 gap-1 border-b border-[var(--border)] px-2 pt-2">
              <button
                type="button"
                onClick={() => setTab("preview")}
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                  tab === "preview"
                    ? "bg-[var(--surface)] text-[var(--primary)] ring-1 ring-b-0 ring-[var(--border)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                미리보기
              </button>
              <button
                type="button"
                onClick={() => setTab("source")}
                className={`rounded-t-lg px-3 py-2 text-sm font-semibold ${
                  tab === "source"
                    ? "bg-[var(--surface)] text-[var(--primary)] ring-1 ring-b-0 ring-[var(--border)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                HTML 원문
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-2 pb-2 pt-2">
              {tab === "preview" ? (
                <iframe
                  title="스마트스토어 HTML 미리보기"
                  sandbox=""
                  className="h-[min(50vh,420px)] w-full rounded-lg border border-[var(--border)] bg-white"
                  srcDoc={state.html}
                />
              ) : (
                <textarea
                  readOnly
                  value={state.html}
                  className="h-[min(50vh,420px)] w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-primary)]"
                  spellCheck={false}
                />
              )}
            </div>

            {copyHint ? (
              <p className="px-4 pb-1 text-center text-xs font-medium text-[var(--success)]">{copyHint}</p>
            ) : null}
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
                다시 생성
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
              >
                <Copy className="h-4 w-4" aria-hidden />
                HTML 복사
              </button>
            </>
          ) : null}
        </footer>
      </div>
    </div>
  );
}
