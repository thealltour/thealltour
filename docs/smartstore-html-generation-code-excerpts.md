# 스마트스토어 HTML 생성 관련 코드 발췌

아래는 스마트스토어 HTML 생성 로직 개편을 위해 직접 수정 가능한 수준으로 모아둔 관련 코드 발췌입니다.

- 스마트스토어 HTML 생성 코어
- 관리자 페이지 버튼/모달/API 호출부
- 입력 `Product` 타입과 공지/일정/이미지 보조 타입
- `Product -> SmartstoreHtmlViewModel -> HTML string` 변환 체인

---

## 1. 관리자 페이지 호출부

### 파일 경로
`src/components/admin/products/modals/smartstoreHtmlModal.types.ts`

```ts
import type { SmartstoreHtmlBuildMeta } from "@/lib/smartstore/smartstoreHtml.types";

export type SmartstoreHtmlGenerateModalProps = {
  open: boolean;
  productId: string | null;
  productTitle: string;
  onClose: () => void;
  /** 복사 성공 시 (토스트 등) */
  onCopied?: () => void;
};

export type SmartstoreHtmlModalFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; html: string; meta: SmartstoreHtmlBuildMeta };
```

### 파일 경로
`src/components/admin/products/modals/SmartstoreHtmlGenerateModal.tsx`

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { FileCode2, Copy, RefreshCw, X } from "lucide-react";
import type { SmartstoreHtmlGenerateModalProps, SmartstoreHtmlModalFetchState } from "./smartstoreHtmlModal.types";
import type { SmartstoreHtmlApiResponse } from "@/lib/smartstore/smartstoreHtml.types";

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
```

### 파일 경로
`src/components/admin/products/AdminProductsQuickActions.tsx`

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  Download,
  ExternalLink,
  FileCode2,
  FileImage,
  Pencil,
  Trash2,
  Power,
} from "lucide-react";
import type { Product } from "@/types/product";
import type { StoredImageDownloadPreset } from "@/lib/images/imageDownloadPreset.storage";
import ProductImageDownloadMenu from "@/components/admin/products/dropdowns/ProductImageDownloadMenu";

type AdminProductsQuickActionsProps = {
  product: Product;
  pendingToggleId: string | null;
  pendingDeleteId: string | null;
  pendingDownloadId?: string | null;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleActive: (product: Product) => void;
  /** 스마트스토어 상세 HTML 생성 모달 */
  onSmartstoreHtml?: (product: Product) => void;
  /** 네이버 블로그용 텍스트 생성 모달 */
  onBlogPost?: (product: Product) => void;
  /** 옵션 모달만 열기 (레거시 단일 버튼용) */
  onOpenDownloadOptions?: (product: Product) => void;
  /** preset 선택 메뉴 + 즉시 실행 */
  downloadPresets?: StoredImageDownloadPreset[];
  downloadDefaultPresetId?: string | null;
  downloadRecentPresetIds?: string[];
  onRunProductImageDownloadWithPreset?: (product: Product, preset: StoredImageDownloadPreset) => void;
  /** preset 관리 모달 */
  onOpenDownloadPresetManager?: () => void;
  /** 이미지 선택 다운로드 모달 */
  onOpenImageSelector?: (product: Product) => void;
  /** A4 유인물 빌더 모달 */
  onFlyer?: (product: Product) => void;
  /** 모바일 등에서 텍스트 라벨 표시 */
  compact?: boolean;
  /** 목록 한 줄 행용 더 작은 버튼 */
  dense?: boolean;
};

export default function AdminProductsQuickActions({
  product,
  pendingToggleId,
  pendingDeleteId,
  pendingDownloadId = null,
  onEdit,
  onDelete,
  onToggleActive,
  onSmartstoreHtml,
  onBlogPost,
  onOpenDownloadOptions,
  downloadPresets,
  downloadDefaultPresetId,
  downloadRecentPresetIds,
  onRunProductImageDownloadWithPreset,
  onOpenDownloadPresetManager,
  onOpenImageSelector,
  onFlyer,
  compact = false,
  dense = false,
}: AdminProductsQuickActionsProps) {
  const rowDownloadBusy = pendingDownloadId === product.id;
  const busy =
    pendingToggleId === product.id || pendingDeleteId === product.id || rowDownloadBusy;
  const anyZipDownloadPending = pendingDownloadId != null;
  const downloadDisabled =
    busy || (anyZipDownloadPending && !rowDownloadBusy);
  const active = product.is_active !== false;

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const downloadMenuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!downloadMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = downloadMenuWrapRef.current;
      if (el && !el.contains(e.target as Node)) {
        setDownloadMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDownloadMenuOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [downloadMenuOpen]);

  const showDownloadMenu =
    onOpenDownloadOptions != null &&
    onRunProductImageDownloadWithPreset != null &&
    downloadPresets != null &&
    downloadRecentPresetIds != null &&
    onOpenDownloadPresetManager != null &&
    onOpenImageSelector != null;

  const btnBase = dense
    ? "inline-flex items-center justify-center gap-0.5 rounded border text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
    : "inline-flex items-center justify-center gap-1 rounded-md border text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  const iconBtn = compact || dense ? "h-7 w-7 p-0" : "px-2 py-1";
  const icoCls = "h-3.5 w-3.5 shrink-0";

  return (
    <div className="flex shrink-0 flex-nowrap items-center justify-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => onEdit(product)}
        className={`${btnBase} ${iconBtn} border-[var(--primary)]/35 bg-[var(--primary-soft)] text-[var(--primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 focus-visible:ring-offset-1`}
        title="편집 화면으로"
      >
        <Pencil className={icoCls} aria-hidden />
        {!compact && !dense ? <span>편집</span> : null}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onToggleActive(product)}
        className={`${btnBase} ${iconBtn} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35 focus-visible:ring-offset-1 ${
          active
            ? "border-amber-200/80 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
            : "border-[var(--success)]/40 bg-[var(--success-bg)] text-[var(--success)]"
        }`}
        title={active ? "비노출로 전환" : "노출로 전환"}
      >
        <Power className={icoCls} aria-hidden />
        {!compact && !dense ? <span>{active ? "비활성" : "활성"}</span> : null}
      </button>
      {onSmartstoreHtml ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSmartstoreHtml(product)}
          className={`${btnBase} ${iconBtn} border-sky-200/80 bg-sky-50 text-sky-900 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-offset-1 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100`}
          title="스마트스토어 상세 HTML 생성"
        >
          <FileCode2 className={icoCls} aria-hidden />
          {!compact && !dense ? <span className="max-w-[4.5rem] truncate">HTML 생성</span> : null}
        </button>
      ) : null}
      {onBlogPost ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onBlogPost(product)}
          className={`${btnBase} ${iconBtn} border-emerald-200/80 bg-emerald-50 text-emerald-900 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40 focus-visible:ring-offset-1 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100`}
          title="블로그 텍스트 생성"
        >
          <BookOpen className={icoCls} aria-hidden />
          {!compact && !dense ? (
            <span className="max-w-[7.5rem] truncate">블로그 텍스트</span>
          ) : null}
        </button>
      ) : null}
      {showDownloadMenu ? (
        <div ref={downloadMenuWrapRef} className="relative shrink-0">
          <button
            type="button"
            disabled={downloadDisabled}
            aria-expanded={downloadMenuOpen}
            aria-haspopup="menu"
            onClick={() => {
              if (downloadDisabled) return;
              setDownloadMenuOpen((v) => !v);
            }}
            className={`${btnBase} ${iconBtn} border-indigo-200/80 bg-indigo-50 text-indigo-900 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 focus-visible:ring-offset-1 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100`}
            title={
              rowDownloadBusy
                ? "이미지 ZIP 생성 중"
                : anyZipDownloadPending
                  ? "다른 상품 ZIP 작업 진행 중"
                  : "이미지 ZIP 다운로드"
            }
          >
            <Download className={icoCls} aria-hidden />
            {!compact && !dense ? (
              <span className="max-w-[4rem] truncate">이미지 ZIP</span>
            ) : null}
            <ChevronDown
              className={`${icoCls} opacity-70 ${downloadMenuOpen ? "rotate-180" : ""} transition-transform`}
              aria-hidden
            />
          </button>
          {downloadMenuOpen ? (
            <div className="absolute right-0 top-full z-[70] mt-0.5 w-[min(100vw-1rem,17.5rem)]">
              <ProductImageDownloadMenu
                product={product}
                presets={downloadPresets}
                defaultPresetId={downloadDefaultPresetId ?? null}
                recentPresetIds={downloadRecentPresetIds}
                onRunWithPreset={(preset) => {
                  onRunProductImageDownloadWithPreset?.(product, preset);
                  setDownloadMenuOpen(false);
                }}
                onOpenOptions={(p) => {
                  onOpenDownloadOptions?.(p);
                  setDownloadMenuOpen(false);
                }}
                onOpenPresetManager={() => {
                  onOpenDownloadPresetManager?.();
                  setDownloadMenuOpen(false);
                }}
                onOpenImageSelector={(p) => {
                  onOpenImageSelector?.(p);
                  setDownloadMenuOpen(false);
                }}
                onClose={() => setDownloadMenuOpen(false)}
              />
            </div>
          ) : null}
        </div>
      ) : onOpenDownloadOptions ? (
        <button
          type="button"
          disabled={downloadDisabled}
          onClick={() => onOpenDownloadOptions(product)}
          className={`${btnBase} ${iconBtn} border-indigo-200/80 bg-indigo-50 text-indigo-900 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 focus-visible:ring-offset-1 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-100`}
          title={
            rowDownloadBusy
              ? "이미지 ZIP 생성 중"
              : anyZipDownloadPending
                ? "다른 상품 ZIP 작업 진행 중"
                : "이미지 ZIP 다운로드"
          }
        >
          <Download className={icoCls} aria-hidden />
          {!compact && !dense ? <span className="max-w-[5rem] truncate">이미지 ZIP</span> : null}
        </button>
      ) : null}
      {onFlyer ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => onFlyer(product)}
          className={`${btnBase} ${iconBtn} border-violet-200/80 bg-violet-50 text-violet-900 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 focus-visible:ring-offset-1 dark:border-violet-800 dark:bg-violet-950/45 dark:text-violet-100`}
          title="유인물 생성"
        >
          <FileImage className={icoCls} aria-hidden />
          {!compact && !dense ? <span className="max-w-[4.5rem] truncate">유인물</span> : null}
        </button>
      ) : null}
      <Link
        href={`/products/${product.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className={`${btnBase} ${iconBtn} border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/25 focus-visible:ring-offset-1`}
        title="유저 상품 상세(새 탭)"
      >
        <ExternalLink className={icoCls} aria-hidden />
        {!compact && !dense ? <span>미리보기</span> : null}
      </Link>
      <button
        type="button"
        disabled={busy}
        onClick={() => onDelete(product.id)}
        className={`${btnBase} ${iconBtn} border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]/45 focus-visible:ring-offset-1`}
        title="삭제"
      >
        <Trash2 className={icoCls} aria-hidden />
        {!compact && !dense ? <span>삭제</span> : null}
      </button>
    </div>
  );
}
```

### 파일 경로
`src/components/admin/products/AdminProductListSection.tsx`

```tsx
"use client";

import { useEffect } from "react";
import type { Product } from "@/types/product";
import type { StoredImageDownloadPreset } from "@/lib/images/imageDownloadPreset.storage";
import AdminProductsListView from "@/components/admin/products/AdminProductsListView";
import { useAdminProductsListController } from "@/components/admin/products/hooks/useAdminProductsListController";
export type AdminProductListSectionProps = {
  showToast: (type: "success" | "error", message: string) => void;
  confirm: (options: {
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel: string;
  }) => Promise<boolean>;
  /** 상품 삭제 성공 후 호출 (현재 편집 중이던 상품이 삭제된 경우 상위에서 편집 상태 초기화용) */
  onAfterDelete?: (deletedId: string) => void;
  /** 상품 수정 클릭 시 (상위에서 편집 모드로 전환) */
  onEditProduct: (product: Product) => void;
  /** 스마트스토어 HTML 생성 (목록 작업 열) */
  onOpenSmartstoreHtml?: (product: Product) => void;
  /** 블로그 텍스트 생성 (목록 작업 열) */
  onOpenBlogPost?: (product: Product) => void;
  /** 이미지 ZIP 옵션 모달 (목록 작업 열) */
  onOpenDownloadOptions?: (product: Product) => void;
  /** preset 즉시 다운로드 */
  onRunProductImageDownloadWithPreset?: (product: Product, preset: StoredImageDownloadPreset) => void;
  downloadPresets?: StoredImageDownloadPreset[];
  downloadDefaultPresetId?: string | null;
  downloadRecentPresetIds?: string[];
  /** preset 관리 모달 */
  onOpenDownloadPresetManager?: () => void;
  /** 이미지 선택 다운로드 */
  onOpenImageSelector?: (product: Product) => void;
  /** ZIP 다운로드 진행 중인 상품 id */
  pendingDownloadId?: string | null;
  /** A4 유인물 빌더 (목록 작업 열) */
  onOpenFlyer?: (product: Product) => void;
  /** 새 상품 등록 링크 (없으면 버튼 비표시) */
  newProductHref?: string;
  /** 목록 새로고침 함수 등록 (저장 후 등 호출용) */
  registerRefresh?: (refresh: () => Promise<void>) => void;
};

export default function AdminProductListSection({
  showToast,
  confirm,
  onAfterDelete,
  onEditProduct,
  onOpenSmartstoreHtml,
  onOpenBlogPost,
  onOpenDownloadOptions,
  onRunProductImageDownloadWithPreset,
  downloadPresets,
  downloadDefaultPresetId,
  downloadRecentPresetIds,
  onOpenDownloadPresetManager,
  onOpenImageSelector,
  pendingDownloadId,
  onOpenFlyer,
  newProductHref,
  registerRefresh,
}: AdminProductListSectionProps) {
  const ctrl = useAdminProductsListController({
    showToast,
    confirm,
    onAfterDelete,
  });

  useEffect(() => {
    registerRefresh?.(ctrl.loadProducts);
  }, [registerRefresh, ctrl.loadProducts]);

  return (
    <AdminProductsListView
      products={ctrl.displayProducts}
      pageSourceCount={ctrl.products.length}
      pageActiveCount={ctrl.pageActiveCount}
      pageWarningStats={ctrl.pageWarningStats}
      taxonomyNameMap={ctrl.taxonomyNameMap}
      totalCount={ctrl.totalCount}
      currentPage={ctrl.currentPage}
      pageSize={ctrl.pageSize}
      pageSizeOptions={ctrl.pageSizeOptions}
      onPageSizeChange={ctrl.setPageSize}
      totalPages={ctrl.totalPages}
      sortField={ctrl.sortField}
      sortDirection={ctrl.sortDirection}
      keyword={ctrl.keyword}
      isSearchPending={ctrl.isSearchPending}
      isLoading={ctrl.isLoading}
      errorMessage={ctrl.errorMessage || null}
      selectedIds={ctrl.selectedIds}
      pendingMoveId={ctrl.pendingMoveId}
      pendingToggleId={ctrl.pendingToggleId}
      pendingDeleteId={ctrl.pendingDeleteId}
      pendingDownloadId={pendingDownloadId}
      onKeywordChange={ctrl.setKeyword}
      onSortChange={ctrl.handleSortChange}
      onPageChange={ctrl.movePage}
      onToggleSelectAll={ctrl.toggleSelectAllForPage}
      onToggleSelectOne={ctrl.toggleSelectOne}
      onClearSelection={() => ctrl.setSelectedIds([])}
      onBulkDelete={ctrl.handleBulkDeleteSelected}
      onEditProduct={onEditProduct}
      onOpenSmartstoreHtml={onOpenSmartstoreHtml}
      onOpenBlogPost={onOpenBlogPost}
      onOpenDownloadOptions={onOpenDownloadOptions}
      onRunProductImageDownloadWithPreset={onRunProductImageDownloadWithPreset}
      downloadPresets={downloadPresets}
      downloadDefaultPresetId={downloadDefaultPresetId}
      downloadRecentPresetIds={downloadRecentPresetIds}
      onOpenDownloadPresetManager={onOpenDownloadPresetManager}
      onOpenImageSelector={onOpenImageSelector}
      onOpenFlyer={onOpenFlyer}
      onDeleteProduct={ctrl.handleDelete}
      onQuickToggleActive={ctrl.quickToggleActive}
      onMoveSortOrder={ctrl.moveSortOrder}
      filterActive={ctrl.filterActive}
      filterStatus={ctrl.filterStatus}
      filterDestinationId={ctrl.filterDestinationId}
      filterProductLineId={ctrl.filterProductLineId}
      filterThemeQuery={ctrl.filterThemeQuery}
      filterIssuesOnly={ctrl.filterIssuesOnly}
      destinationOptions={ctrl.destinationOptions}
      productLineOptions={ctrl.productLineOptions}
      themeNameOptions={ctrl.themeNameOptions}
      onFilterActiveChange={ctrl.setFilterActive}
      onFilterStatusChange={ctrl.setFilterStatus}
      onFilterDestinationIdChange={ctrl.setFilterDestinationId}
      onFilterProductLineIdChange={ctrl.setFilterProductLineId}
      onFilterThemeQueryChange={ctrl.setFilterThemeQuery}
      onFilterIssuesOnlyChange={ctrl.setFilterIssuesOnly}
      newProductHref={newProductHref}
      onRetryLoad={ctrl.loadProducts}
    />
  );
}
```

### 파일 경로
`src/components/admin/products/AdminProductManager.tsx`

```tsx
const [smartstoreHtmlModalOpen, setSmartstoreHtmlModalOpen] = useState(false);
const [smartstoreHtmlProduct, setSmartstoreHtmlProduct] = useState<Product | null>(null);
```

```tsx
<AdminProductListSection
  // ...
  onOpenSmartstoreHtml={(product) => {
    setSmartstoreHtmlProduct(product);
    setSmartstoreHtmlModalOpen(true);
  }}
  // ...
/>
```

```tsx
<SmartstoreHtmlGenerateModal
  open={smartstoreHtmlModalOpen}
  productId={smartstoreHtmlProduct?.id ?? null}
  productTitle={smartstoreHtmlProduct?.title?.trim() ?? ""}
  onClose={() => {
    setSmartstoreHtmlModalOpen(false);
    setSmartstoreHtmlProduct(null);
  }}
  onCopied={() => showToast("success", "HTML이 복사되었습니다.")}
/>
```

### 파일 경로
`src/app/api/admin/products/[id]/smartstore-html/route.ts`

```ts
import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { getProductByIdFresh } from "@/lib/products";
import { resolveProductNoticesForDetailPage } from "@/lib/noticeTemplates";
import { buildSmartstoreDetailHtmlFromProduct } from "@/lib/smartstore/buildSmartstoreDetailHtml";
import type { SmartstoreHtmlApiResponse } from "@/lib/smartstore/smartstoreHtml.types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse<SmartstoreHtmlApiResponse>> {
  const auth = await requireAdminSession();
  if (!auth.ok) {
    return auth.res as NextResponse<SmartstoreHtmlApiResponse>;
  }

  const { id } = await context.params;
  const rawId = id?.trim();
  if (!rawId) {
    return NextResponse.json(
      { ok: false, message: "상품 ID가 필요합니다." },
      { status: 400 },
    );
  }

  try {
    const product = await getProductByIdFresh(rawId);
    if (!product) {
      return NextResponse.json({ ok: false, message: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const notices = await resolveProductNoticesForDetailPage(product);
    const { html, meta } = buildSmartstoreDetailHtmlFromProduct(product, notices);

    return NextResponse.json({ ok: true, html, meta });
  } catch (e) {
    console.error("[api/admin/products/[id]/smartstore-html]", e);
    return NextResponse.json(
      { ok: false, message: "HTML 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
```

---

## 2. 스마트스토어 HTML 생성 코어

### 파일 경로
`src/lib/smartstore/smartstoreHtml.defaults.ts`

```ts
/** 스마트스토어 HTML 섹션 제목 */
export const SMARTSTORE_SECTION_TITLES = {
  summary: "기본 정보",
  included: "포함 사항",
  excluded: "불포함 사항",
  optional: "선택 관광",
  schedule: "일정 안내",
  bookingConditions: "예약 조건",
  bookingNotes: "예약 시 유의사항",
  travelNotes: "여행 시 유의사항",
  refund: "환불·취소 규정",
  consult: "상담 안내",
} as const;

/** 하단 고정: 여행 시 유의사항 (1문장·문구 수정 시 이 상수만 변경) */
export const SMARTSTORE_NOTICE_TRAVEL =
  "여행 준비물 및 현지 진행 관련 유의사항은 스토어 문의를 통해 확인해 주세요.";

/** 하단 고정: 환불·취소 규정 (1문장) */
export const SMARTSTORE_NOTICE_REFUND =
  "환불 및 취소 관련 세부 기준은 주문 전 스토어 문의를 통해 확인해 주세요.";

/** 하단 고정: 상담 안내 (1문장) */
export const SMARTSTORE_NOTICE_INQUIRY =
  "상품 관련 세부 내용은 스토어 문의를 통해 확인해 주세요.";

/** 구 import 호환: 내용은 각각 SMARTSTORE_NOTICE_TRAVEL / SMARTSTORE_NOTICE_REFUND와 동일 */
export const SMARTSTORE_DEFAULT_TRAVEL_NOTES = SMARTSTORE_NOTICE_TRAVEL;
export const SMARTSTORE_DEFAULT_REFUND = SMARTSTORE_NOTICE_REFUND;

export const SMARTSTORE_DEFAULT_BOOKING_CONDITIONS =
  "최종 일정·가격은 주문·문의 후 확정될 수 있습니다. 예약 절차는 스마트스토어 문의를 이용해 주세요.";
```

### 파일 경로
`src/lib/smartstore/smartstoreHtml.helpers.ts`

```ts
/**
 * 스마트스토어 업로드용 HTML 조립 헬퍼 (외부 의존 최소화)
 */

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** ProductDetailV2.parseBulletLines 와 동일 규칙 */
export function parseBulletLines(raw?: string): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function filterEmptyLines(lines: string[]): string[] {
  return lines.map((l) => l.trim()).filter((l) => l.length > 0);
}

/** `[1일차]` 블록 파싱 — ProductDetailV2.parseScheduleDays 와 동일 */
export type ScheduleDayBlock = { label: string; content: string };

export function parseScheduleDayBlocks(raw?: string): ScheduleDayBlock[] {
  const source = raw?.trim();
  if (!source) return [];
  const lines = source.split(/\r?\n/);
  const days: ScheduleDayBlock[] = [];
  let currentLabel = "";
  let currentContent: string[] = [];
  for (const line of lines) {
    const match = line.match(/^\[(.+)\]\s*$/);
    if (match) {
      if (currentLabel) {
        days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
      }
      currentLabel = match[1].trim();
      currentContent = [];
      continue;
    }
    currentContent.push(line);
  }
  if (currentLabel) {
    days.push({ label: currentLabel, content: currentContent.join("\n").trim() });
  }
  const filtered = days.filter((d) => d.content.length > 0);
  if (filtered.length === 0 && source) return [{ label: "일정", content: source }];
  return filtered;
}

/** 인라인 스타일 조각 조합 (세미콜론 구분) */
export function styleAttr(parts: Record<string, string | undefined>): string {
  const s = Object.entries(parts)
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return s ? ` style="${escapeHtml(s)}"` : "";
}
```

### 파일 경로
`src/lib/smartstore/smartstoreHtml.types.ts`

```ts
import type { TimelineModel } from "@/lib/products/mapProductToTimelineModel";
import type { SmartstoreHtmlSafetyReport } from "@/lib/smartstore/smartstoreHtml.safety";

/** 스마트스토어 상세 HTML 생성용 ViewModel (외부 CSS 없이 문자열 조립) */
export type SmartstoreHtmlViewModel = {
  productId: string;
  title: string;
  oneLiner: string;
  heroImageUrl: string;
  /** 대표 외 갤러리(정규화 URL, 중복 제거) */
  galleryImageUrls: string[];
  priceText?: string;
  priceMeta?: string;
  durationText?: string;
  regionText?: string;
  categoryText?: string;
  minDeparturePeopleText?: string;
  fuelIncluded?: boolean;
  includedLines: string[];
  excludedLines: string[];
  optionalLines: string[];
  bookingConditionLines: string[];
  bookingNotesLines: string[];
  /** 일정: 구조화 타임라인 우선, 없으면 텍스트 일정 */
  timeline: TimelineModel | null;
  detailedScheduleText: string;
};

export type SmartstoreHtmlBuildMeta = {
  title: string;
  productId: string;
  characterCount: number;
  /** 최종 HTML 기준 https 이미지 태그 수 */
  imageCount: number;
  includedSections: string[];
  hasHeroImage: boolean;
  hasTimeline: boolean;
  hasIncludedExcluded: boolean;
  hasOptionalTours: boolean;
  hasNoticesBlock: boolean;
  /** 네이버 업로드 안전성 검증 결과 */
  safety: SmartstoreHtmlSafetyReport;
};

export type SmartstoreHtmlApiResponse =
  | {
      ok: true;
      html: string;
      meta: SmartstoreHtmlBuildMeta;
    }
  | { ok: false; message: string };
```

### 파일 경로
`src/lib/smartstore/smartstoreHtml.safety.ts`

```ts
/**
 * 네이버 스마트스토어 상품설명 HTML 제약 검사·정제
 */

export type SmartstoreHtmlSafetyReport = {
  /** `<a ` 또는 `href=` 속성 탐지 */
  hasExternalLinks: boolean;
  /** img 등에 http:// 리소스 */
  hasHttpInAttributes: boolean;
  /** 금지 태그 또는 인라인 이벤트 핸들러 */
  hasForbiddenTagsOrHandlers: boolean;
  /** 탐지된 힌트(디버그·모달 표시용) */
  hints: string[];
  /** 최종 본문 내 https 이미지 개수 */
  httpsImageCount: number;
  /** safety assert 전부 통과 */
  assertPassed: boolean;
};

const FORBIDDEN_TAG_RE =
  /<\s*(script|iframe|form|input|button|textarea|select|option|video|audio|object|embed|link|meta|style|base)\b/i;

const INLINE_HANDLER_RE = /\s(on\w+)\s*=/i;

/** 스마트스토어용 이미지: https 절대 URL만 (상대·http·data·javascript 제외) */
export function acceptSmartstoreHttpsImageUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const u = raw.trim();
  if (!/^https:\/\//i.test(u)) return null;
  if (/^https:\/\/\s*$/i.test(u)) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    const h = parsed.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local")) return null;
    return u;
  } catch {
    return null;
  }
}

/** 본문 텍스트에서 전화·이메일·URL·외부 유도 문구 제거(출력용) */
export function sanitizeSmartstoreUserText(raw: string): string {
  let s = raw.replace(/\r\n/g, "\n");
  // 이메일
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "");
  // 전화 (휴대·지역번호 위주, 가격 숫자 오탐 최소화)
  s = s.replace(/\b010[\s.-]?\d{4}[\s.-]?\d{4}\b/g, "");
  s = s.replace(/\b01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}\b/g, "");
  s = s.replace(/\b0[2-6]\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{4}\b/g, "");
  s = s.replace(/\+\s*82[\s.-]?(?:0?)?(?:10|\d{1,2})[\s.-]?\d{3,4}[\s.-]?\d{4}\b/gi, "");
  // URL
  s = s.replace(/https?:\/\/[^\s<>"']+/gi, "");
  s = s.replace(/www\.[^\s<>"']+/gi, "");
  // 외부 유도·개인정보 수집 뉘앙스 (자주 쓰이는 표현)
  const bannedPhrases = [
    /카카오톡/gi,
    /카톡/gi,
    /오픈\s*채팅/gi,
    /pf\.kakao/gi,
    /open\.kakao/gi,
    /아래\s*링크/gi,
    /외부\s*문의/gi,
    /별도\s*폼/gi,
    /홈페이지\s*상담/gi,
    /개인정보\s*입력/gi,
    /주민등록번호/gi,
  ];
  for (const re of bannedPhrases) {
    s = s.replace(re, "");
  }
  return s
    .split("\n")
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .trim();
}

export function sanitizeSmartstoreLines(lines: string[]): string[] {
  return lines.map((l) => sanitizeSmartstoreUserText(l)).filter((l) => l.length > 0);
}

/**
 * 생성된 HTML에 대한 안전성 분석 (모달 표시·assert)
 */
/** https:// 제거 후 불안전한 http:// 잔존 여부 (https 문자열 오탐 방지) */
export function hasRawHttpSlashSlash(html: string): boolean {
  const withoutHttps = html.replace(/https:\/\/[^\s"'<>]*/gi, "");
  return withoutHttps.includes("http://");
}

export function analyzeSmartstoreHtml(html: string): SmartstoreHtmlSafetyReport {
  const hints: string[] = [];
  const lower = html.toLowerCase();

  const hasAnchor = /<\s*a\s+[^>]*href\s*=/i.test(html) || /<\s*a[\s>]/i.test(html);
  if (hasAnchor) {
    hints.push("a[href] 태그");
  }

  const hasHrefAnywhere = /\bhref\s*=\s*["']?https?:\/\//i.test(html);
  if (hasHrefAnywhere && !hasAnchor) {
    hints.push("href 속성");
  }

  let hasHttpInAttributes = false;
  const attrHttp = /(?:src|href|poster)\s*=\s*["']?http:\/\//i;
  if (attrHttp.test(html)) {
    hasHttpInAttributes = true;
    hints.push("http:// 리소스(src/href 등)");
  }

  let httpsImageCount = 0;
  const imgSrcRe = /<\s*img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = imgSrcRe.exec(html)) !== null) {
    const src = m[1]?.trim() ?? "";
    if (/^https:\/\//i.test(src)) httpsImageCount += 1;
  }

  let hasForbidden = FORBIDDEN_TAG_RE.test(html) || INLINE_HANDLER_RE.test(html);
  if (FORBIDDEN_TAG_RE.test(html)) {
    hints.push("금지 태그(script/iframe/form 등)");
  }
  if (INLINE_HANDLER_RE.test(html)) {
    hints.push("인라인 이벤트 핸들러");
  }

  const hasScriptLiteral = lower.includes("<script");
  const hasIframeLiteral = lower.includes("<iframe");
  if (hasScriptLiteral && !hints.some((h) => h.includes("script"))) hints.push("<script");
  if (hasIframeLiteral && !hints.some((h) => h.includes("iframe"))) hints.push("<iframe");
  hasForbidden = hasForbidden || hasScriptLiteral || hasIframeLiteral;

  const hasExternalLinks = hasAnchor || hasHrefAnywhere;

  const assertPassed =
    !hasExternalLinks &&
    !hasHttpInAttributes &&
    !hasForbidden &&
    !lower.includes("<script") &&
    !lower.includes("<iframe") &&
    !hasRawHttpSlashSlash(html);

  return {
    hasExternalLinks,
    hasHttpInAttributes,
    hasForbiddenTagsOrHandlers: hasForbidden,
    hints: [...new Set(hints)],
    httpsImageCount,
    assertPassed,
  };
}

/** 빌드 직후 호출 — 위반 시 생성 실패(스마트스토어 제약 위반) */
export function assertSmartstoreHtmlBuildSafe(html: string): void {
  const r = analyzeSmartstoreHtml(html);
  if (r.assertPassed) return;
  throw new Error(`[smartstore-html] Safety check failed: ${r.hints.join(", ") || "unknown"}`);
}
```

### 파일 경로
`src/lib/smartstore/mapProductToSmartstoreHtmlViewModel.ts`

```ts
import type { Product } from "@/types/product";
import type { ResolvedProductNoticesForDetail } from "@/lib/noticeTemplates";
import { resolveProductDetailBodyFields } from "@/lib/products/resolveProductDetailBodyFields";
import { mapProductToTimelineModel, type TimelineModel } from "@/lib/products/mapProductToTimelineModel";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { getPrimaryImageUrl, normalizeImageList } from "@/lib/products/images";
import { parseBulletLines } from "@/lib/smartstore/smartstoreHtml.helpers";
import type { SmartstoreHtmlViewModel } from "@/lib/smartstore/smartstoreHtml.types";
import {
  acceptSmartstoreHttpsImageUrl,
  sanitizeSmartstoreUserText,
  sanitizeSmartstoreLines,
} from "@/lib/smartstore/smartstoreHtml.safety";

function formatPriceKR(price?: number): string | undefined {
  if (typeof price !== "number" || !Number.isFinite(price)) return undefined;
  return new Intl.NumberFormat("ko-KR").format(price);
}

function toSmartstoreImageUrl(raw: string): string {
  const normalized = normalizeProductImageUrl(raw.trim());
  return acceptSmartstoreHttpsImageUrl(normalized) ?? "";
}

function refineTimelineForSmartstore(model: TimelineModel): TimelineModel {
  return {
    days: model.days.map((day) => {
      const title = day.title?.trim() ? sanitizeSmartstoreUserText(day.title.trim()) : undefined;
      const dateText = day.dateText?.trim() ? sanitizeSmartstoreUserText(day.dateText.trim()) : undefined;
      const dayImgRaw = day.imageUrl?.trim();
      const dayImg = dayImgRaw ? toSmartstoreImageUrl(dayImgRaw) : "";
      const events = (day.events ?? []).map((ev) => {
        const heading = ev.heading?.trim() ? sanitizeSmartstoreUserText(ev.heading.trim()) : ev.heading;
        const description = ev.description?.trim()
          ? sanitizeSmartstoreUserText(ev.description.trim())
          : ev.description;
        const images = (ev.images ?? [])
          .map((im) => {
            const url = typeof im?.url === "string" ? im.url.trim() : "";
            if (!url) return null;
            const ok = toSmartstoreImageUrl(url);
            if (!ok) return null;
            return { ...im, url: ok };
          })
          .filter((x): x is NonNullable<typeof x> => x != null);
        return {
          ...ev,
          heading,
          description,
          images: images.length > 0 ? images : undefined,
        };
      });
      return {
        ...day,
        title: title || undefined,
        dateText: dateText || undefined,
        imageUrl: dayImg || undefined,
        events,
      };
    }),
  };
}

/**
 * DB Product + 상세와 동일하게 해석된 공지 → 스마트스토어 HTML ViewModel
 * (https 이미지·텍스트 정제는 이 단계에서 수행)
 */
export function mapProductToSmartstoreHtmlViewModel(
  product: Product,
  notices: ResolvedProductNoticesForDetail,
): SmartstoreHtmlViewModel {
  const { resolvedIncludedItems, resolvedExcludedItems, resolvedOptionalTours } =
    resolveProductDetailBodyFields(product);

  const heroRaw = getPrimaryImageUrl(product).trim();
  const heroImageUrl = heroRaw ? toSmartstoreImageUrl(heroRaw) : "";

  const list = normalizeImageList(product.images_json);
  const galleryRaw = list.filter((u) => u.trim() !== heroRaw);
  const galleryImageUrls = galleryRaw
    .map((u) => toSmartstoreImageUrl(u))
    .filter((u): u is string => u.length > 0)
    .slice(0, 4);

  const timelineBase = mapProductToTimelineModel(product);
  const timelineSanitized = refineTimelineForSmartstore(timelineBase);
  const seenGallery = new Set<string>([...galleryImageUrls, heroImageUrl].filter(Boolean));
  const itineraryExtras: string[] = [];
  for (const day of timelineSanitized.days.slice(0, 2)) {
    if (itineraryExtras.length >= 2) break;
    const dayUrl = day.imageUrl?.trim();
    if (dayUrl && !seenGallery.has(dayUrl)) {
      seenGallery.add(dayUrl);
      itineraryExtras.push(dayUrl);
    }
    for (const ev of day.events ?? []) {
      if (itineraryExtras.length >= 2) break;
      const imgs = ev.images ?? [];
      for (const im of imgs) {
        const u = typeof im.url === "string" ? im.url.trim() : "";
        if (u && !seenGallery.has(u)) {
          seenGallery.add(u);
          itineraryExtras.push(u);
          break;
        }
      }
    }
  }

  const allGallery = [...galleryImageUrls, ...itineraryExtras].slice(0, 6);

  const oneLinerRaw =
    product.one_liner?.trim() ||
    product.description?.trim().split(/\n/)[0]?.slice(0, 200) ||
    product.title;
  const oneLiner = sanitizeSmartstoreUserText(oneLinerRaw || "");

  const detailedScheduleText = sanitizeSmartstoreUserText(
    (product.detailed_schedule ?? product.itinerary ?? "").trim(),
  );

  const title = sanitizeSmartstoreUserText(product.title?.trim() || "상품");

  return {
    productId: product.id,
    title: title || "상품",
    oneLiner,
    heroImageUrl,
    galleryImageUrls: allGallery,
    priceText: formatPriceKR(product.price),
    priceMeta: sanitizeSmartstoreUserText(product.price_meta?.trim() || "1인 기준") || "1인 기준",
    durationText: product.duration?.trim()
      ? sanitizeSmartstoreUserText(product.duration.trim()) || undefined
      : undefined,
    regionText: (() => {
      const r = product.theme?.trim() || product.overview_region?.trim();
      if (!r) return undefined;
      const t = sanitizeSmartstoreUserText(r);
      return t || undefined;
    })(),
    categoryText: product.category?.trim()
      ? sanitizeSmartstoreUserText(product.category.trim()) || undefined
      : undefined,
    minDeparturePeopleText: product.min_departure_people?.trim() || undefined,
    fuelIncluded: typeof product.fuel_included === "boolean" ? product.fuel_included : undefined,
    includedLines: sanitizeSmartstoreLines(parseBulletLines(resolvedIncludedItems)),
    excludedLines: sanitizeSmartstoreLines(parseBulletLines(resolvedExcludedItems)),
    optionalLines: sanitizeSmartstoreLines(parseBulletLines(resolvedOptionalTours ?? "")),
    bookingConditionLines: sanitizeSmartstoreLines(parseBulletLines(notices.bookingConditions)),
    bookingNotesLines: sanitizeSmartstoreLines(parseBulletLines(notices.bookingNotes)),
    timeline: timelineSanitized.days.length > 0 ? timelineSanitized : null,
    detailedScheduleText,
  };
}
```

### 파일 경로
`src/lib/smartstore/buildSmartstoreDetailSections.ts`

```ts
import type { SmartstoreHtmlViewModel } from "@/lib/smartstore/smartstoreHtml.types";
import {
  SMARTSTORE_SECTION_TITLES,
  SMARTSTORE_DEFAULT_BOOKING_CONDITIONS,
  SMARTSTORE_NOTICE_TRAVEL,
  SMARTSTORE_NOTICE_REFUND,
  SMARTSTORE_NOTICE_INQUIRY,
} from "@/lib/smartstore/smartstoreHtml.defaults";
import { escapeHtml, parseScheduleDayBlocks, styleAttr } from "@/lib/smartstore/smartstoreHtml.helpers";

function h2(title: string): string {
  return `<h2${styleAttr({ "font-size": "17px", "font-weight": "700", color: "#0f172a", margin: "28px 0 12px", "padding-bottom": "8px", "border-bottom": "2px solid #e2e8f0" })}>${escapeHtml(title)}</h2>`;
}

function cardInner(html: string): string {
  return `<div${styleAttr({ background: "#f8fafc", border: "1px solid #e2e8f0", "border-radius": "12px", padding: "14px 16px", margin: "0 0 12px" })}>${html}</div>`;
}

function ulFromLines(lines: string[]): string {
  if (lines.length === 0) return "";
  const items = lines
    .map((line) => `<li${styleAttr({ margin: "7px 0", "list-style": "none" })}>${escapeHtml(line)}</li>`)
    .join("");
  return `<ul${styleAttr({ margin: "0", padding: "0", "padding-left": "0", "list-style": "none" })}>${items}</ul>`;
}

/** DB에 "2" / "2명" / "2명 이상" 등이 섞여 있어도 "명 이상"이 두 번 붙지 않게 */
function minDepartureTailAfterValue(trimmed: string): string {
  if (/^\d+$/.test(trimmed)) return "명 이상 확정 시 출발";
  if (/이상\s*$/u.test(trimmed)) return " 확정 시 출발";
  if (/명\s*$/u.test(trimmed)) return " 이상 확정 시 출발";
  return "명 이상 확정 시 출발";
}

/** 하단 고정 안내 1문장용 (목록 없이 단일 문단) */
function noticeSingleParagraphCard(text: string): string {
  return cardInner(
    `<p${styleAttr({
      "font-size": "14px",
      color: "#475569",
      margin: "0",
      "line-height": "1.6",
    })}>${escapeHtml(text)}</p>`,
  );
}

const IMG_RESPONSIVE = {
  width: "100%",
  height: "auto",
  display: "block",
  "border-radius": "12px",
  margin: "0 0 16px",
  border: "1px solid #e2e8f0",
} as const;

export function buildHeroSection(vm: SmartstoreHtmlViewModel): { html: string; used: boolean } {
  if (!vm.heroImageUrl) return { html: "", used: false };
  const img = `<img src="${escapeHtml(vm.heroImageUrl)}" alt="${escapeHtml(vm.title)}"${styleAttr(
    IMG_RESPONSIVE,
  )} loading="lazy" />`;
  return { html: img, used: true };
}

export function buildTitleBlock(vm: SmartstoreHtmlViewModel): string {
  const titleHeading = `<h2${styleAttr({
    "font-size": "22px",
    "font-weight": "800",
    color: "#0f172a",
    margin: "0 0 12px",
    "line-height": "1.35",
  })}>${escapeHtml(vm.title)}</h2>`;
  const lead =
    vm.oneLiner.trim().length > 0
      ? `<p${styleAttr({
          "font-size": "15px",
          color: "#475569",
          margin: "0 0 20px",
          "line-height": "1.6",
          "white-space": "pre-wrap",
        })}>${escapeHtml(vm.oneLiner)}</p>`
      : "";
  return titleHeading + lead;
}

export function buildSummarySection(vm: SmartstoreHtmlViewModel): { html: string; used: boolean } {
  const parts: string[] = [];
  if (vm.regionText) parts.push(`<span${styleAttr({ color: "#0f172a", "font-weight": "600" })}>지역·테마</span> ${escapeHtml(vm.regionText)}`);
  if (vm.categoryText) parts.push(`<span${styleAttr({ color: "#0f172a", "font-weight": "600" })}>카테고리</span> ${escapeHtml(vm.categoryText)}`);
  if (vm.durationText) parts.push(`<span${styleAttr({ color: "#0f172a", "font-weight": "600" })}>기간</span> ${escapeHtml(vm.durationText)}`);
  // 가격: 스마트스토어 상품 자체 가격 필드 사용 — 상세 HTML에는 미포함
  if (vm.minDeparturePeopleText?.trim()) {
    const t = vm.minDeparturePeopleText.trim();
    parts.push(
      `출발 인원 <span${styleAttr({ color: "#0f172a", "font-weight": "600" })}>${escapeHtml(t)}</span>${minDepartureTailAfterValue(t)}`,
    );
  }
  if (typeof vm.fuelIncluded === "boolean") {
    parts.push(vm.fuelIncluded ? "유류할증료 포함" : "유류할증료 별도");
  }
  if (parts.length === 0) return { html: "", used: false };
  const inner = parts
    .map(
      (p) =>
        `<p${styleAttr({ "font-size": "13px", color: "#64748b", margin: "4px 0", "line-height": "1.6" })}>${p}</p>`,
    )
    .join("");
  return { html: h2(SMARTSTORE_SECTION_TITLES.summary) + cardInner(inner), used: true };
}

export function buildGallerySection(vm: SmartstoreHtmlViewModel): { html: string; count: number } {
  if (vm.galleryImageUrls.length === 0) return { html: "", count: 0 };
  const imgs = vm.galleryImageUrls
    .map(
      (url) =>
        `<img src="${escapeHtml(url)}" alt=""${styleAttr({
          width: "100%",
          height: "auto",
          "border-radius": "8px",
          display: "block",
          margin: "0 0 8px",
          border: "1px solid #e2e8f0",
        })} loading="lazy" />`,
    )
    .join("");
  return { html: h2("추가 이미지") + cardInner(imgs), count: vm.galleryImageUrls.length };
}

export function buildListSection(
  title: string,
  lines: string[],
): { html: string; used: boolean } {
  if (lines.length === 0) return { html: "", used: false };
  return { html: h2(title) + cardInner(ulFromLines(lines)), used: true };
}

export function buildScheduleSection(vm: SmartstoreHtmlViewModel): { html: string; used: boolean } {
  if (vm.timeline && vm.timeline.days.length > 0) {
    const chunks: string[] = [];
    for (const day of vm.timeline.days) {
      const dayLabel =
        (day.title?.trim() ? day.title : `Day ${day.day}`) +
        (day.dateText?.trim() ? ` · ${day.dateText.trim()}` : "");
      let block = `<p${styleAttr({
        "font-weight": "700",
        color: "#0f172a",
        margin: "12px 0 6px",
        "font-size": "16px",
      })}>${escapeHtml(dayLabel)}</p>`;
      if (day.imageUrl?.trim()) {
        block += `<img src="${escapeHtml(day.imageUrl.trim())}" alt=""${styleAttr({
          width: "100%",
          height: "auto",
          "border-radius": "8px",
          display: "block",
          margin: "0 0 8px",
          border: "1px solid #e2e8f0",
        })} loading="lazy" />`;
      }
      for (const ev of day.events ?? []) {
        if (ev.heading?.trim()) {
          block += `<p${styleAttr({
            "font-weight": "600",
            color: "#1e293b",
            margin: "8px 0 4px",
          })}>${escapeHtml(ev.heading.trim())}</p>`;
        }
        if (ev.description?.trim()) {
          block += `<p${styleAttr({
            "font-size": "14px",
            color: "#475569",
            margin: "0 0 8px",
            "white-space": "pre-wrap",
          })}>${escapeHtml(ev.description.trim())}</p>`;
        }
      }
      chunks.push(cardInner(block));
    }
    return { html: h2(SMARTSTORE_SECTION_TITLES.schedule) + chunks.join(""), used: true };
  }

  const blocks = parseScheduleDayBlocks(vm.detailedScheduleText);
  if (blocks.length === 0) return { html: "", used: false };
  const inner = blocks
    .map((b) => {
      const head = `<p${styleAttr({
        "font-weight": "700",
        color: "#0f172a",
        margin: "0 0 8px",
      })}>${escapeHtml(b.label)}</p>`;
      const body = `<p${styleAttr({
        "font-size": "14px",
        color: "#475569",
        margin: "0",
        "white-space": "pre-wrap",
      })}>${escapeHtml(b.content)}</p>`;
      return cardInner(head + body);
    })
    .join("");
  return { html: h2(SMARTSTORE_SECTION_TITLES.schedule) + inner, used: true };
}

export function buildBookingSection(vm: SmartstoreHtmlViewModel): string {
  let inner = "";
  if (vm.minDeparturePeopleText?.trim()) {
    const t = vm.minDeparturePeopleText.trim();
    inner += `<p${styleAttr({ margin: "0 0 10px", "font-size": "14px" })}>출발 인원: <strong>${escapeHtml(t)}</strong>${minDepartureTailAfterValue(t)}</p>`;
  }
  inner += `<ul${styleAttr({ margin: "0 0 12px", padding: "0", "padding-left": "0", "list-style": "none" })}>`;
  inner += `<li${styleAttr({ margin: "6px 0", "list-style": "none" })}>최종 일정·가격은 주문·문의 후 확정될 수 있습니다.</li>`;
  inner += `<li${styleAttr({ margin: "6px 0", "list-style": "none" })}>예약 절차는 스마트스토어 문의를 통해 안내받으실 수 있습니다.</li>`;
  inner += `</ul>`;
  if (vm.bookingConditionLines.length > 0) {
    inner += ulFromLines(vm.bookingConditionLines);
  } else {
    inner += `<p${styleAttr({ "font-size": "14px", color: "#475569", margin: "0" })}>${escapeHtml(SMARTSTORE_DEFAULT_BOOKING_CONDITIONS)}</p>`;
  }
  return h2(SMARTSTORE_SECTION_TITLES.bookingConditions) + cardInner(inner);
}

export function buildBookingNotesSection(vm: SmartstoreHtmlViewModel): string {
  const lines =
    vm.bookingNotesLines.length > 0
      ? vm.bookingNotesLines
      : ["예약 관련 유의사항은 스마트스토어 문의를 통해 안내해 드립니다."];
  return h2(SMARTSTORE_SECTION_TITLES.bookingNotes) + cardInner(ulFromLines(lines));
}

export function buildTravelSection(): string {
  return h2(SMARTSTORE_SECTION_TITLES.travelNotes) + noticeSingleParagraphCard(SMARTSTORE_NOTICE_TRAVEL);
}

export function buildRefundSection(): string {
  return h2(SMARTSTORE_SECTION_TITLES.refund) + noticeSingleParagraphCard(SMARTSTORE_NOTICE_REFUND);
}

export function buildConsultFooter(): string {
  return (
    h2(SMARTSTORE_SECTION_TITLES.consult) +
    `<div${styleAttr({
      "margin-top": "8px",
      padding: "16px",
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      "border-radius": "12px",
      "font-size": "14px",
      color: "#1e3a8a",
      "line-height": "1.6",
    })}>${escapeHtml(SMARTSTORE_NOTICE_INQUIRY)}</div>`
  );
}

/** 섹션 HTML 조각만 순서대로 이어 붙인다. */
export function buildAllSectionsHtml(vm: SmartstoreHtmlViewModel): string {
  const parts: string[] = [];
  const hero = buildHeroSection(vm);
  if (hero.html) parts.push(hero.html);
  parts.push(buildTitleBlock(vm));
  const sum = buildSummarySection(vm);
  if (sum.html) parts.push(sum.html);
  const gal = buildGallerySection(vm);
  if (gal.html) parts.push(gal.html);
  const inc = buildListSection(SMARTSTORE_SECTION_TITLES.included, vm.includedLines);
  if (inc.html) parts.push(inc.html);
  const exc = buildListSection(SMARTSTORE_SECTION_TITLES.excluded, vm.excludedLines);
  if (exc.html) parts.push(exc.html);
  const opt = buildListSection(SMARTSTORE_SECTION_TITLES.optional, vm.optionalLines);
  if (opt.html) parts.push(opt.html);
  const sched = buildScheduleSection(vm);
  if (sched.html) parts.push(sched.html);
  parts.push(buildBookingSection(vm));
  parts.push(buildBookingNotesSection(vm));
  parts.push(buildTravelSection());
  parts.push(buildRefundSection());
  parts.push(buildConsultFooter());
  return parts.join("\n");
}
```

### 파일 경로
`src/lib/smartstore/buildSmartstoreDetailHtml.ts`

```ts
import type { Product } from "@/types/product";
import type { ResolvedProductNoticesForDetail } from "@/lib/noticeTemplates";
import { mapProductToSmartstoreHtmlViewModel } from "@/lib/smartstore/mapProductToSmartstoreHtmlViewModel";
import type { SmartstoreHtmlViewModel, SmartstoreHtmlBuildMeta } from "@/lib/smartstore/smartstoreHtml.types";
import {
  buildAllSectionsHtml,
  buildGallerySection,
  buildHeroSection,
  buildListSection,
  buildScheduleSection,
  buildSummarySection,
} from "@/lib/smartstore/buildSmartstoreDetailSections";
import { SMARTSTORE_SECTION_TITLES } from "@/lib/smartstore/smartstoreHtml.defaults";
import { styleAttr } from "@/lib/smartstore/smartstoreHtml.helpers";
import {
  analyzeSmartstoreHtml,
  assertSmartstoreHtmlBuildSafe,
  type SmartstoreHtmlSafetyReport,
} from "@/lib/smartstore/smartstoreHtml.safety";

function collectMeta(
  vm: SmartstoreHtmlViewModel,
  html: string,
  safety: SmartstoreHtmlSafetyReport,
): SmartstoreHtmlBuildMeta {
  const includedSections: string[] = [];
  if (buildHeroSection(vm).used) includedSections.push("대표 비주얼");
  includedSections.push("상품명", "한 줄 요약");
  if (buildSummarySection(vm).used) includedSections.push("기본 정보 요약");
  const gal = buildGallerySection(vm);
  if (gal.count > 0) includedSections.push("추가 이미지");
  if (buildListSection(SMARTSTORE_SECTION_TITLES.included, vm.includedLines).used) {
    includedSections.push("포함 사항");
  }
  if (buildListSection(SMARTSTORE_SECTION_TITLES.excluded, vm.excludedLines).used) {
    includedSections.push("불포함 사항");
  }
  const hasOptional = buildListSection(SMARTSTORE_SECTION_TITLES.optional, vm.optionalLines).used;
  if (hasOptional) includedSections.push("선택 관광");
  const sched = buildScheduleSection(vm);
  if (sched.used) includedSections.push("일정 안내");
  includedSections.push(
    "예약 조건",
    "예약 시 유의사항",
    "여행 시 유의사항",
    "환불·취소 규정",
    "상담 안내",
  );

  const hasStructuredTimeline = Boolean(vm.timeline && vm.timeline.days.length > 0);

  return {
    title: vm.title,
    productId: vm.productId,
    characterCount: html.length,
    imageCount: safety.httpsImageCount,
    includedSections,
    hasHeroImage: Boolean(vm.heroImageUrl),
    hasTimeline: hasStructuredTimeline || sched.used,
    hasIncludedExcluded: vm.includedLines.length > 0 || vm.excludedLines.length > 0,
    hasOptionalTours: hasOptional,
    hasNoticesBlock: true,
    safety,
  };
}

/**
 * ViewModel → 스마트스토어 붙여넣기용 self-contained HTML (외부 CSS/JS·링크 없음)
 */
export function buildSmartstoreDetailHtml(vm: SmartstoreHtmlViewModel): {
  html: string;
  meta: SmartstoreHtmlBuildMeta;
} {
  const inner = buildAllSectionsHtml(vm);
  const wrapStyles = {
    width: "100%",
    "max-width": "860px",
    margin: "0 auto",
    padding: "16px 12px",
    "box-sizing": "border-box",
    "font-family":
      "-apple-system,BlinkMacSystemFont,'Malgun Gothic','Segoe UI',Roboto,sans-serif",
    color: "#334155",
    "font-size": "15px",
    "line-height": "1.65",
    "word-break": "break-word",
  };
  const html = `<div id="smartstore-theall-detail"${styleAttr(wrapStyles)}>${inner}</div>`;
  const safety = analyzeSmartstoreHtml(html);
  assertSmartstoreHtmlBuildSafe(html);
  return { html, meta: collectMeta(vm, html, safety) };
}

/** Product + 공지 해석 결과 → HTML (서버 API·테스트용) */
export function buildSmartstoreDetailHtmlFromProduct(
  product: Product,
  notices: ResolvedProductNoticesForDetail,
): { html: string; meta: SmartstoreHtmlBuildMeta } {
  const vm = mapProductToSmartstoreHtmlViewModel(product, notices);
  return buildSmartstoreDetailHtml(vm);
}
```

---

## 3. 상품 타입 / 공지 / 일정 / 이미지 보조 정의

### 파일 경로
`src/types/product.ts`

```ts
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";

/** 모두투어 등 계절·주말·성수기 구간가 (KRW 정수). 비어 있으면 필드 생략 또는 null */
export type SeasonalPriceBands = {
  offSeason?: number | null;
  weekend?: number | null;
  peakSeason?: number | null;
};

export type ProductTrust = {
  recentConsultCount?: number;
  recentDays?: number;
  totalInquiries?: number;
  ratingAvg?: number;
  reviewCount?: number;
};

/**
 * 옵션 항목: 단일 선택지 (예: "3박4일", "싱글룸")
 * - value: 선택 시 SelectedOptions에 저장되는 값
 * - priceDelta: 기준가에 더할 금액(원). 미설정 시 0
 * - meta: "1인1실", "성수기" 등 부가 표시
 * - isDefault: true면 초기 선택값 후보
 */
export type ProductOptionItem = {
  value: string;
  label: string;
  priceDelta?: number;
  meta?: string;
  isDefault?: boolean;
};

/**
 * 옵션 그룹: 선택 그룹 (예: "기간", "룸 타입")
 * - key: 그룹 식별자, SelectedOptions의 키로 사용
 * - type: UI 타입 (radio / select / stepper / multi)
 */
export type ProductOptionGroup = {
  key: string;
  title: string;
  type: "radio" | "select" | "stepper" | "multi";
  items: ProductOptionItem[];
};

/**
 * 상품 옵션 정의 (Phase 4-3 통일 구조)
 * - basePrice + 선택된 items의 priceDelta 합으로 총액 계산
 * - requiredGroups에 포함된 key는 반드시 하나 선택
 */
export type ProductOptions = {
  basePrice: number;
  currency: "KRW";
  /** 필수 그룹 key 목록. 이 key들은 반드시 하나 선택 */
  requiredGroups?: string[];
  groups: ProductOptionGroup[];
};

/** 선택된 옵션: groupKey -> itemValue (UI/계산용) */
export type SelectedOptions = Record<string, string>;

/** 여행 오버뷰 요약 카드 kind */
export type OverviewSummaryCardKind =
  | "flight"
  | "hotel"
  | "region"
  | "theme"
  | "golf"
  | "etc";

/** 여행 오버뷰 요약 카드 */
export type OverviewSummaryCard = {
  kind: OverviewSummaryCardKind;
  label: string;
  value: string;
};

/** 여행 오버뷰 차트 아이템 */
export type OverviewChartItem = { label: string; percent: number };

/** 여행 오버뷰 타임라인 Day */
export type OverviewTimelineDay = {
  day: number;
  dateText?: string;
  headline?: string;
  bullets: string[];
};

/** 일정 이벤트 이미지 1건 (모두투어 검수 status·수집 휴리스틱 메타) */
export type ItineraryEventImage = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
  status?: "active" | "deleted" | "unassigned";
  isThumbnailCandidate?: boolean;
  isLogoCandidate?: boolean;
  isLowResolution?: boolean;
};

/** [STEP 0] 구조화 일정 이벤트 1개 (시간대·아이콘 지원) */
export type ItineraryStructuredEvent = {
  heading: string;
  description?: string;
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  iconKey?: string;
  /** 이벤트별 이미지 URL 목록 (대표·정렬 포함) */
  images?: ItineraryEventImage[];
};

/** [STEP 0] 구조화 일정 Day 1개 */
export type ItineraryStructuredDay = {
  day: number;
  dateText?: string;
  title?: string;
  coverImageUrl?: string | null;
  events: ItineraryStructuredEvent[];
};

/** [STEP 1] 구조화 일정 v2 (시각화 최적화, jsonb 1컬럼) */
export type ItineraryV2Event = {
  timeOfDay?: "오전" | "오후" | "저녁" | "종일";
  /** 시각 (예: 09:00, 14:30). 오전/오후 옆에 표시 */
  timeText?: string;
  iconKey?: string;
  heading: string;
  description?: string;
  location?: string;
  order?: number;
  /** 이벤트별 이미지 URL 목록 (대표·정렬 포함) */
  images?: ItineraryEventImage[];
};

export type ItineraryV2Day = {
  day: number;
  dateText?: string;
  title?: string;
  coverImageUrl?: string;
  events: ItineraryV2Event[];
};

export type ItineraryV2 = {
  days: ItineraryV2Day[];
};

/** 이벤트 선택 상태: 상품 공용 이미지 → "이 이벤트에 추가" 시 참조 (관리자 UI용) */
export type SelectedEventRef =
  | { editorType: "v2"; dayIndex: number; eventIndex: number }
  | { editorType: "structured"; dayIndex: number; eventIndex: number };

/** PR42: 상세 일정 타임라인용 일차 데이터 (title/subtitle/description/meals/hotel) */
export type ProductItineraryDay = {
  day: number;
  title?: string;
  subtitle?: string;
  description?: string;
  meals?: string[];
  hotel?: string;
};

/** 여행 오버뷰 (jsonb 1컬럼 스키마) */
export type ProductOverview = {
  enabled: boolean;
  title?: string;
  summaryCards: OverviewSummaryCard[];
  coverImageUrl?: string;
  chart?: {
    enabled: boolean;
    items: OverviewChartItem[];
  };
  timeline?: {
    enabled: boolean;
    days: OverviewTimelineDay[];
  };
};

export type Product = {
  id: string;
  title: string;
  description: string;
  /** 상세 히어로용 (hero 1920px). 카드 썸네일은 image_card_url 우선, 없으면 이 값 사용 */
  image_url: string;
  /** 상품 이미지 갤러리 URL 배열. 첫 번째가 대표 이미지로 사용됨 */
  images_json?: string[];
  /** TODO: 목록 카드 썸네일용 (card 800px). 확장 시 ProductCatalogSection 등에서 우선 사용. */
  // image_card_url?: string;
  /**
   * @deprecated legacy. destination_id / product_line_id 비어 있을 때만 fallback 사용.
   * 지역·상품군이 혼재했던 단일 문자열. 점진적 이전 후 제거 검토.
   */
  category: string;
  /**
   * @deprecated legacy. 테마 이름 토큰 문자열(쉼표/구분자).
   * 새 스키마에서는 theme_ids_json 등 검토. 당분간 유지.
   */
  theme?: string;
  /** 지역 1개 (product_taxonomies.id, taxonomy_type=destination). 비어 있으면 category fallback */
  destination_id?: string | null;
  /** 상품군 1개 (product_taxonomies.id, taxonomy_type=product_line). 비어 있으면 category fallback */
  product_line_id?: string | null;
  /** 기획/강조 항목. taxonomy 이름 배열 또는 id 배열. 선택 */
  campaigns?: string[] | null;
  /** DB 컬럼명. API 응답에서 올 수 있음 */
  campaigns_json?: string[] | null;
  /** 태그 이름 배열. 선택 */
  tags?: string[] | null;
  /** PR22: 핵심 여행 요약용 문구 배열. 없으면 tags/themes로 대체 */
  highlights?: string[] | null;
  price?: number;
  /** 비수기·주말·성수기 구간가 (jsonb). 없으면 undefined — 목록/상세는 기존 price 사용 */
  seasonal_price_bands?: SeasonalPriceBands | null;
  duration?: string;
  /** 출발지역 (Summary 블록용) */
  departure?: string;
  /** 항공 요약 (Summary 블록용) */
  airline?: string;
  /** 숙소 요약 (Summary 블록용) */
  hotel?: string;
  /** 여행스타일 (Summary 블록용) */
  travelStyle?: string;
  /** 출발일 목록 (ProductDepartureSelector용). 예: ["2025-06-12", "2025-07-03"] */
  departures?: string[];
  /** PR42: 일차별 타임라인용 일정 (ProductItineraryTimeline). 없으면 기존 itinerary / detailed_schedule 사용 */
  itinerary_days?: ProductItineraryDay[];
  itinerary?: string;
  inclusions?: string;
  point_benefits?: string;
  point_tourism?: string;
  point_guide?: string;
  meeting_info?: string;
  travel_insurance?: string;
  included_items?: string;
  excluded_items?: string;
  detailed_schedule?: string;
  optional_tours?: string;
  min_departure_people?: string;
  /** 레거시 단일 약관/유의. 상세 노출은 예약 유의사항 폴백에만 사용(PR-H). */
  terms_and_notes?: string | null;
  /** 예약 시 유의사항 (직접입력; 비면 템플릿·레거시 순) */
  booking_notes?: string | null;
  /** 여행 시 유의사항 (직접입력; 비면 템플릿만) */
  travel_notes?: string | null;
  /** 예약조건 (직접입력; 비면 템플릿만) */
  booking_conditions?: string | null;
  /** 환불·취소 규정 전용 (직접입력; 비면 refund 템플릿만, 타 필드 폴백 없음) */
  refund_policy?: string | null;
  refund_policy_template_type?: string | null;
  /** 예약 유의사항에 적용할 공통 템플릿 키 (product_terms_templates.type) */
  booking_notes_template_type?: string | null;
  travel_notes_template_type?: string | null;
  booking_conditions_template_type?: string | null;
  terms_template_type?: string;
  product_source_url?: string;
  departure_from_airport?: string;
  departure_from_date?: string;
  departure_from_time?: string;
  departure_to_airport?: string;
  departure_to_date?: string;
  departure_to_time?: string;
  departure_flight_name?: string;
  /** 출발편 수하물 한도 (예: 23KG) */
  departure_baggage_limit?: string;
  arrival_from_airport?: string;
  arrival_from_date?: string;
  arrival_from_time?: string;
  arrival_to_airport?: string;
  arrival_to_date?: string;
  arrival_to_time?: string;
  arrival_flight_name?: string;
  /** 도착편 수하물 한도 (예: 23KG) */
  arrival_baggage_limit?: string;
  meta_title?: string;
  meta_description?: string;
  is_active?: boolean;
  /** 추천 여행 컬렉션용. true면 /products?collection=recommend에 노출 */
  is_recommend?: boolean;
  /** 인기 여행 컬렉션용. true면 /products?collection=popular에 노출 */
  is_popular?: boolean;
  sort_order?: number;
  created_at?: string;
  /** DB에 컬럼이 있으면 목록 등에서 사용. 없으면 undefined */
  updated_at?: string;
  /** 상품 상태: 없으면 AVAILABLE로 간주 */
  status?: "AVAILABLE" | "LIMITED" | "SOLD_OUT" | "CONSULT_REQUIRED";
  /** 유류할증료 포함 여부. null이면 상세에서 문구 미노출 */
  fuel_included?: boolean;
  /** 가격 기준 문구 (예: 1인 기준). 카드/상세에 표시 */
  price_meta?: string;
  /** 카드 부가 문구 (예: 항공 포함). 카드 메타 영역에 표시 */
  meta_info?: string;
  /** 상세 상단 한 줄 소개. 비우면 description 첫 줄 사용 */
  one_liner?: string;
  /** [STEP 2] 오버뷰 jsonb 1컬럼. enabled/summaryCards/chart/timeline/coverImageUrl */
  overview_json?: ProductOverview | null;
  /** [STEP 3] 일정 Day별 대표 이미지 URL. 예: { "1": "https://...", "2": "https://..." } */
  itinerary_media_json?: Record<string, string> | null;
  /** [STEP 0] 구조화 일정. 있으면 상세에서 시각화 타임라인 우선 사용, 없으면 detailed_schedule 텍스트 fallback */
  itinerary_days_json?: ItineraryStructuredDay[] | null;
  /** [STEP 1] 구조화 일정 v2 (jsonb 1컬럼, 시각화 최적화) */
  itinerary_v2_json?: ItineraryV2 | null;
  /** 일정 테마 구성비. 상품 등록 시 입력, 없으면 theme/category 기반 자동 생성 */
  theme_chart_json?: { items: Array<{ label: string; percent: number }> } | null;
  /** 여행 오버뷰 카드 전용 입력 (숙소·지역·기간). 있으면 우선 사용 */
  overview_accommodation?: string;
  overview_region?: string;
  overview_duration?: string;
  trust?: ProductTrust;
  /** 옵션 정의. 없거나 groups가 비어 있으면 옵션 UI 미노출 */
  options?: ProductOptions;
  /**
   * PR3: 기획(campaign) taxonomy 기반 카드 배지 해석.
   * `getProducts` 등에서 hydrate; 없으면 `campaigns` 문자열 + 레거시 규칙 사용.
   */
  campaign_card_meta?: ProductCampaignCardMeta[];
};
```

### 파일 경로
`src/lib/products/resolveProductDetailBodyFields.ts`

```ts
import type { Product } from "@/types/product";

/**
 * 상품 상세 SSR(`src/app/products/[id]/page.tsx`)과 동일한 포함/불포함/선택관광 해석.
 * 스마트스토어 HTML 등에서 재사용한다.
 */
export function resolveProductDetailBodyFields(product: Product): {
  resolvedIncludedItems: string;
  resolvedExcludedItems: string;
  resolvedOptionalTours: string | undefined;
} {
  const normalizedIncluded = product.included_items?.trim() ?? "";
  const normalizedExcluded = product.excluded_items?.trim() ?? "";
  const normalizedOptional = product.optional_tours?.trim() ?? "";
  const normalizedTerms = product.terms_and_notes?.trim() ?? "";
  const shouldFallbackFromLegacyDetailFields =
    !normalizedIncluded && !normalizedExcluded && (normalizedOptional || normalizedTerms);
  const resolvedIncludedItems = shouldFallbackFromLegacyDetailFields
    ? (product.optional_tours ?? product.inclusions ?? "") || ""
    : (product.included_items ?? product.inclusions ?? "") || "";
  const resolvedExcludedItems = shouldFallbackFromLegacyDetailFields
    ? product.terms_and_notes ?? ""
    : product.excluded_items ?? "";
  const resolvedOptionalTours = shouldFallbackFromLegacyDetailFields ? undefined : product.optional_tours;
  return { resolvedIncludedItems, resolvedExcludedItems, resolvedOptionalTours };
}
```

### 파일 경로
`src/lib/products/mapProductToTimelineModel.ts`

```ts
/**
 * [STEP 0/2] 텍스트 일정 → 시각화 타임라인 ViewModel
 * - 기존 detailed_schedule / itinerary 유지, 파생 모델만 생성
 * - STEP 2: TimelineModel (events, timeOfDay, side) 추가
 */

import type { Product, ItineraryStructuredDay, ItineraryV2 } from "@/types/product";
import { parseTimelineDays } from "@/lib/products/mapProductToOverview";

// ---------------------------------------------------------------------------
// STEP 2: 요약 타임라인용 모델 (events, timeOfDay, side)
// ---------------------------------------------------------------------------

export type TimeOfDayLabel = "오전" | "오후" | "저녁" | "종일";

export type TimelineEvent = {
  timeOfDay?: TimeOfDayLabel;
  /** 시각 (예: 09:00). 오전/오후 옆에 표시 */
  timeText?: string;
  iconKey?: string;
  heading: string;
  description?: string;
  side?: "left" | "right";
  /** 이벤트별 이미지 목록 (url/alt/sortOrder/isCover). 없으면 undefined, 표시 시 (event.images ?? []) 사용 */
  images?: Array<{ url: string; alt?: string; sortOrder?: number; isCover?: boolean }>;
  /** 썸네일용 URL. isCover=true인 이미지 우선, 없으면 images[0].url, 없으면 null */
  thumbnailUrl?: string | null;
};

export type TimelineDay = {
  day: number;
  dateText?: string;
  title?: string;
  imageUrl?: string | null;
  events: TimelineEvent[];
};

export type TimelineModel = {
  days: TimelineDay[];
};

/** event.images에서 썸네일 URL 결정: isCover=true 우선, 없으면 images[0].url, 없으면 null */
function getThumbnailUrl(
  images: TimelineEvent["images"],
): string | null {
  if (!Array.isArray(images) || images.length === 0) return null;
  const cover = images.find((i) => i.isCover);
  if (cover?.url?.trim()) return cover.url.trim();
  const first = images[0];
  return first?.url?.trim() ?? null;
}

const MAX_EVENTS_PER_DAY = 4;
const TITLE_MAX_LEN = 40;

/** key-value 한 줄 파싱: "이동: 인천 출발" → { heading: "이동", description: "인천 출발" } */
function parseKeyValueLine(line: string): { heading: string; description?: string } {
  const trimmed = line.trim();
  if (!trimmed) return { heading: "" };

  // dotAll 플래그(s) 대신 [\s\S]* 사용 (ES2018 이전 타겟 호환)
  const colonMatch = trimmed.match(/^([^:]+):\s*([\s\S]*)$/);
  if (colonMatch) {
    let label = colonMatch[1].trim();
    const value = colonMatch[2].trim();
    if (/^TEE\s*OFF\s*TIME$/i.test(label)) label = "TEE OFF";
    return { heading: label, description: value || undefined };
  }

  return { heading: trimmed };
}

function extractTimeOfDay(text: string): TimeOfDayLabel | undefined {
  if (/오전/.test(text)) return "오전";
  if (/오후/.test(text)) return "오후";
  if (/저녁/.test(text)) return "저녁";
  if (/종일/.test(text)) return "종일";
  return undefined;
}

/** [STEP 6] heading → lucide 아이콘 키: 이동/항공→plane, 숙소→hotel, 식사→utensils, 관광→landmark, 골프→flag, 자유→clock */
function inferIconKey(heading: string): string | undefined {
  const h = heading.trim().toLowerCase();
  if (/이동|차량|버스|출발|도착|항공|비행|기내/.test(h)) return "plane";
  if (/식사|조식|중식|석식|디너|기내식/.test(h)) return "utensils";
  if (/tee\s*off|티오프|라운드|골프/.test(h)) return "flag";
  if (/호텔|숙소|체크인|숙박/.test(h)) return "hotel";
  if (/관광|시내|투어|탐방/.test(h)) return "landmark";
  if (/자유|프리/.test(h)) return "clock";
  return undefined;
}

/** 한 줄을 TimelineEvent로 변환 */
function lineToEvent(line: string, index: number): TimelineEvent | null {
  const { heading, description } = parseKeyValueLine(line);
  if (!heading) return null;

  const timeOfDay = extractTimeOfDay(line) ?? extractTimeOfDay(description ?? "");
  const iconKey = inferIconKey(heading);
  const side: "left" | "right" = index % 2 === 0 ? "left" : "right";

  return {
    ...(timeOfDay && { timeOfDay }),
    ...(iconKey && { iconKey }),
    heading,
    ...(description && { description }),
    side,
  };
}

/** bullets → events (최대 MAX_EVENTS_PER_DAY개) */
function bulletsToEvents(bullets: string[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (let i = 0; i < Math.min(bullets.length, MAX_EVENTS_PER_DAY); i++) {
    const ev = lineToEvent(bullets[i], i);
    if (ev && ev.heading) events.push(ev);
  }
  return events;
}

/** Day 제목: 첫 이벤트 heading 또는 첫 문장, 없으면 생략(UI에서 "Day {n}" 사용) */
function inferDayTitle(dayNumber: number, events: TimelineEvent[], rawBullets: string[]): string | undefined {
  const firstHeading = events[0]?.heading?.trim();
  if (firstHeading && firstHeading.length <= TITLE_MAX_LEN) return firstHeading;
  const firstLine = rawBullets[0]?.trim();
  if (firstLine) return firstLine.slice(0, TITLE_MAX_LEN);
  return undefined;
}

/** parseTimelineDays 결과 → TimelineDay 한 개 */
function toTimelineDay(
  parsed: { day: number; headline: string; bullets: string[] },
): TimelineDay {
  const events = bulletsToEvents(parsed.bullets);
  const title = inferDayTitle(parsed.day, events, parsed.bullets);

  return {
    day: parsed.day,
    title,
    imageUrl: null,
    events,
  };
}

/**
 * Product → TimelineModel (STEP 2)
 * - itinerary_v2_json 우선 → itinerary_days_json → detailed_schedule/itinerary 텍스트 fallback
 * - [STEP 4] Day 이미지 fallback: coverImageUrl → itinerary_media_json[day] → product.image_url → UI placeholder
 */
export function mapProductToTimelineModel(product: Product | null): TimelineModel {
  if (!product || typeof product !== "object") {
    return { days: [] };
  }

  const v2 = product.itinerary_v2_json;
  const hasV2 = v2 && Array.isArray(v2.days) && v2.days.length > 0;

  if (hasV2) {
    const media = product.itinerary_media_json;
    const fallbackUrl = product.image_url?.trim() || null;
    return {
      days: v2.days.map((d) => {
        const dayKey = String(d.day);
        const imageUrl =
          d.coverImageUrl?.trim() ||
          (media && typeof media[dayKey] === "string" && media[dayKey].trim() ? media[dayKey].trim() : null) ||
          fallbackUrl;
        return {
          day: d.day,
          dateText: d.dateText,
          title: d.title,
          imageUrl: imageUrl || null,
          events: d.events.map((e, i) => ({
            timeOfDay: e.timeOfDay,
            timeText: e.timeText,
            iconKey: e.iconKey,
            heading: e.heading,
            description: e.description,
            side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
            images: Array.isArray(e.images) ? e.images : undefined,
            thumbnailUrl: getThumbnailUrl(Array.isArray(e.images) ? e.images : undefined),
          })),
        };
      }),
    };
  }

  const structured = product.itinerary_days_json;
  const hasStructured = Array.isArray(structured) && structured.length > 0;

  let model: TimelineModel;

  if (hasStructured) {
    const media = product.itinerary_media_json;
    const fallbackUrl = product.image_url?.trim() || null;
    model = {
      days: structured.map((d) => {
        const dayKey = String(d.day);
        const imageUrl =
          d.coverImageUrl && d.coverImageUrl.trim()
            ? d.coverImageUrl.trim()
            : media && typeof media[dayKey] === "string" && media[dayKey].trim()
              ? media[dayKey].trim()
              : fallbackUrl;
        return {
          day: d.day,
          dateText: d.dateText,
          title: d.title,
          imageUrl: imageUrl || null,
          events: d.events.map((e, i) => ({
            timeOfDay: e.timeOfDay,
            timeText: (e as { timeText?: string }).timeText,
            iconKey: e.iconKey,
            heading: e.heading,
            description: e.description,
            side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
            images: Array.isArray(e.images) ? e.images : undefined,
            thumbnailUrl: getThumbnailUrl(Array.isArray(e.images) ? e.images : undefined),
          })),
        };
      }),
    };
  } else {
    const raw = product.detailed_schedule?.trim() || product.itinerary?.trim() || "";
    model = getTimelineModelFromSchedule(raw);
    const media = product.itinerary_media_json;
    const fallbackUrl = product.image_url?.trim() || null;
    model.days.forEach((d) => {
      const dayKey = String(d.day);
      const dayUrl =
        media && typeof media[dayKey] === "string" && media[dayKey].trim()
          ? media[dayKey].trim()
          : fallbackUrl;
      d.imageUrl = dayUrl || null;
    });
  }

  return model;
}

/**
 * raw 일정 텍스트 → TimelineModel
 */
export function getTimelineModelFromSchedule(rawSchedule: string): TimelineModel {
  const raw = rawSchedule?.trim() || "";
  const parsed = parseTimelineDays(raw);
  if (parsed.length === 0) return { days: [] };

  const days: TimelineDay[] = parsed.map(toTimelineDay);
  return { days };
}

/** TimelineModel → 구조화 일정 (Admin 편집용) */
export function timelineModelToStructuredDays(model: TimelineModel | null): ItineraryStructuredDay[] {
  if (!model?.days?.length) return [];
  return model.days.map((d) => ({
    day: d.day,
    dateText: d.dateText,
    title: d.title,
    coverImageUrl: d.imageUrl ?? undefined,
    events: d.events.map((e) => ({
      heading: e.heading,
      description: e.description,
      timeOfDay: e.timeOfDay,
      iconKey: e.iconKey,
      images: Array.isArray(e.images) ? e.images : undefined,
    })),
  }));
}

/** 구조화 일정 → 레거시 detailed_schedule 텍스트 (Admin 저장 시 동기화용) */
export function serializeStructuredDaysToSchedule(days: ItineraryStructuredDay[]): string {
  if (!days?.length) return "";
  return days
    .map((d) => {
      const label = `${d.day}일차`;
      const lines = d.events.map((e) =>
        e.description?.trim() ? `${e.heading}: ${e.description.trim()}` : e.heading,
      );
      return lines.length ? `[${label}]\n${lines.join("\n")}` : `[${label}]`;
    })
    .join("\n\n");
}

/** ItineraryV2 → TimelineModel (Admin 미리보기·상세 노출용). [STEP 4] Day 이미지는 coverImageUrl만 설정하고, fallback은 호출측에서 fallbackImageUrl(product.image_url)로 적용 */
export function itineraryV2ToTimelineModel(v2: ItineraryV2 | null | undefined): TimelineModel {
  if (!v2?.days?.length) return { days: [] };
  return {
    days: v2.days.map((d) => ({
      day: d.day,
      dateText: d.dateText,
      title: d.title,
      imageUrl: d.coverImageUrl?.trim() || null,
      events: d.events.map((e, i) => ({
        timeOfDay: e.timeOfDay,
        timeText: e.timeText,
        iconKey: e.iconKey,
        heading: e.heading,
        description: e.description,
        side: (i % 2 === 0 ? "left" : "right") as "left" | "right",
        images: Array.isArray(e.images) ? e.images : undefined,
        thumbnailUrl: getThumbnailUrl(Array.isArray(e.images) ? e.images : undefined),
      })),
    })),
  };
}
```

### 파일 경로
`src/lib/products/images.ts`

```ts
import type { Product } from "@/types/product";

export function normalizeImageList(images: Array<string | null | undefined> | null | undefined): string[] {
  if (!Array.isArray(images)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of images) {
    if (typeof raw !== "string") continue;
    const url = raw.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

export function getPrimaryImageUrl(product: Pick<Product, "image_url" | "images_json">): string {
  const list = normalizeImageList(product.images_json);
  if (list.length > 0) return list[0];
  return product.image_url?.trim() || "";
}
```

### 파일 경로
`src/lib/noticeTemplates.ts`

```ts
/**
 * PR-E: 그룹별 상품 안내 공통 템플릿 (product_notice_templates)
 * - 신규 테이블 우선, booking_notes 만 product_terms_templates 레거시 폴백
 */

import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/product";
import {
  TERMS_TEMPLATE_TYPES,
  type TermsTemplateType,
  getTermsTemplateContent,
  getTermsTemplateContentFromMap,
  type TermsTemplateMap,
} from "@/lib/termsTemplates";

export type NoticeTemplateGroup =
  | "booking_notes"
  | "travel_notes"
  | "booking_conditions"
  | "refund_policy";

export type NoticeTemplatesByGroup = Record<NoticeTemplateGroup, TermsTemplateMap>;

export type NoticeTemplateRow = {
  id: string;
  template_group: NoticeTemplateGroup;
  type: string;
  label: string | null;
  content: string | null;
  sort_order: number;
  updated_at: string;
};

function emptyTypeMap(): TermsTemplateMap {
  return {
    overseas_brokerage: "",
    domestic_brokerage: "",
    overseas_direct: "",
    domestic_direct: "",
  };
}

export function createEmptyNoticeTemplatesByGroup(): NoticeTemplatesByGroup {
  return {
    booking_notes: emptyTypeMap(),
    travel_notes: emptyTypeMap(),
    booking_conditions: emptyTypeMap(),
    refund_policy: emptyTypeMap(),
  };
}

function isKnownType(type: string): type is TermsTemplateType {
  return (TERMS_TEMPLATE_TYPES as readonly string[]).includes(type);
}

function rowGroupIsNotice(g: string): g is NoticeTemplateGroup {
  return (
    g === "booking_notes" ||
    g === "travel_notes" ||
    g === "booking_conditions" ||
    g === "refund_policy"
  );
}

export const getNoticeTemplatesByGroup = unstable_cache(
  async (): Promise<NoticeTemplatesByGroup> => {
    const result = createEmptyNoticeTemplatesByGroup();
    const { data, error } = await supabase
      .from("product_notice_templates")
      .select("template_group,type,content,sort_order")
      .order("sort_order", { ascending: true })
      .order("type", { ascending: true });

    if (error || !data) return result;

    for (const row of data as { template_group: string; type: string; content: string | null }[]) {
      if (!rowGroupIsNotice(row.template_group)) continue;
      if (!isKnownType(row.type)) continue;
      result[row.template_group][row.type] = row.content?.trim() ?? "";
    }
    return result;
  },
  ["product-notice-templates-by-group"],
  { revalidate: 60, tags: ["products"] },
);

/**
 * 상품별 직접 입력이 비어 있을 때 사용할 공통 템플릿 본문.
 * booking_notes: 신규 테이블 → (비어 있으면) product_terms_templates
 * 그 외 그룹: 신규 테이블만
 */
export async function getNoticeTemplateContent(
  group: NoticeTemplateGroup,
  type?: string | null,
): Promise<string> {
  if (!type || !isKnownType(type)) return "";
  const maps = await getNoticeTemplatesByGroup();
  const fromNew = maps[group][type].trim();
  if (fromNew) return fromNew;
  if (group === "booking_notes") {
    // TODO(PR-H): legacy product_terms_templates fallback is temporary — remove after full migration
    return (await getTermsTemplateContent(type)).trim();
  }
  return "";
}

export function getNoticeTemplateContentFromMaps(
  maps: NoticeTemplatesByGroup,
  group: NoticeTemplateGroup,
  type?: string | null,
  legacyTermsMap?: TermsTemplateMap | null,
): string {
  if (!type || !isKnownType(type)) return "";
  const fromNew = maps[group][type].trim();
  if (fromNew) return fromNew;
  if (group === "booking_notes" && legacyTermsMap) {
    // TODO(PR-H): legacy product_terms_templates fallback is temporary — remove after full migration
    return getTermsTemplateContentFromMap(legacyTermsMap, type).trim();
  }
  return "";
}

export type ResolvedProductNoticesForDetail = {
  bookingNotes: string;
  travelNotes: string;
  bookingConditions: string;
  refundPolicy: string;
};

export async function resolveBookingNoticeForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  legacyTerms: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  const t = (await getNoticeTemplateContent("booking_notes", templateType ?? undefined)).trim();
  if (t) return t;
  // TODO(PR-H): legacy fallback (terms_and_notes) is temporary — remove after full migration
  return legacyTerms?.trim() ?? "";
}

export async function resolveTravelNoticeForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("travel_notes", templateType ?? undefined)).trim();
}

export async function resolveBookingConditionsForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("booking_conditions", templateType ?? undefined)).trim();
}

/** 환불 규정: 직접입력 → refund_policy 템플릿만. legacy/terms_and_notes 폴백 없음 */
export async function resolveRefundPolicyForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("refund_policy", templateType ?? undefined)).trim();
}

/**
 * 상품 상세·관리자 미리보기(서버) 공통 해석.
 * 순서: 직접입력 → 공통 템플릿 → (예약 유의만) terms_and_notes 레거시.
 * 템플릿 로드는 getNoticeTemplatesByGroup 캐시를 공유하므로 Promise.all로 병렬 호출해도 중복 fetch가 최소화됨.
 */
export async function resolveProductNoticesForDetailPage(
  product: Product,
): Promise<ResolvedProductNoticesForDetail> {
  const [bookingNotes, travelNotes, bookingConditions, refundPolicy] = await Promise.all([
    resolveBookingNoticeForDetail(
      product.booking_notes,
      product.booking_notes_template_type,
      product.terms_and_notes,
    ),
    resolveTravelNoticeForDetail(product.travel_notes, product.travel_notes_template_type),
    resolveBookingConditionsForDetail(
      product.booking_conditions,
      product.booking_conditions_template_type,
    ),
    resolveRefundPolicyForDetail(product.refund_policy, product.refund_policy_template_type),
  ]);
  return { bookingNotes, travelNotes, bookingConditions, refundPolicy };
}

export function resolveBookingNoticeForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  legacyTerms: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
  legacyTermsMap: TermsTemplateMap | null | undefined,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  const t = getNoticeTemplateContentFromMaps(
    noticeMaps,
    "booking_notes",
    templateType,
    legacyTermsMap ?? undefined,
  );
  if (t) return t;
  // TODO(PR-H): legacy fallback (terms_and_notes) is temporary — remove after full migration
  return legacyTerms?.trim() ?? "";
}

export function resolveTravelNoticeForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "travel_notes", templateType);
}

export function resolveBookingConditionsForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "booking_conditions", templateType);
}

export function resolveRefundPolicyForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "refund_policy", templateType);
}
```

### 파일 경로
`src/lib/products.ts`

```ts
import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { getTaxonomyById, parseThemeTokens, getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import {
  sortRelatedProducts,
  scoreRelatedProduct,
  MIN_RELATED_SCORE,
} from "@/lib/products/relatedProductScoring";
import { normalizeEventImages as normalizeEventImagesLib } from "@/lib/images/normalizeEventImages";
import { dedupeEventImages } from "@/lib/images/dedupeEventImages";
import type {
  Product,
  ProductTrust,
  ProductOptions,
  ProductOptionGroup,
  ProductOptionItem,
  ProductOverview,
  ProductItineraryDay,
  ItineraryStructuredDay,
  ItineraryStructuredEvent,
  ItineraryV2,
  ItineraryV2Event,
} from "@/types/product";
import type { Guide } from "@/types/guide";
import { extractGuideBridgeSearchTokens } from "@/lib/guides";
import { normalizeImageList } from "@/lib/products/images";
import { parseSeasonalPriceBandsFromUnknown } from "@/lib/products/seasonalPriceBands";

const FALLBACK_IMAGE = "https://picsum.photos/seed/thealltour-product/900/560";

function safeUuidOrNull(value: unknown): string | null {
  if (value == null) return null;
  const s = typeof value === "string" ? value.trim() : String(value).trim();
  return s === "" ? null : s;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const arr = value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}

export function normalizeProduct(row: Record<string, unknown>): Product {
  const rawPrice = row.price;
  const price = typeof rawPrice === "number" ? rawPrice : undefined;
  const sortOrder = typeof row.sort_order === "number" ? row.sort_order : undefined;
  let imagesInput: Array<string | null | undefined> | null = null;
  if (Array.isArray(row.images_json)) {
    imagesInput = row.images_json as Array<string | null | undefined>;
  } else if (typeof row.images_json === "string" && row.images_json.trim()) {
    try {
      const parsed = JSON.parse(row.images_json) as unknown;
      imagesInput = Array.isArray(parsed) ? (parsed as Array<string | null | undefined>) : null;
    } catch {
      imagesInput = null;
    }
  }
  const images = normalizeImageList(imagesInput);
  const primaryImage = images[0] ?? String(row.image_url ?? row.image ?? FALLBACK_IMAGE);

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? row.name ?? "상품명 미정"),
    description: String(row.description ?? row.content ?? "상세 설명이 준비 중입니다."),
    image_url: primaryImage,
    images_json: images.length > 0 ? images : undefined,
    category: String(row.category ?? row.type ?? "여행상품"),
    theme: typeof row.theme === "string" ? row.theme : undefined,
    destination_id: safeUuidOrNull(row.destination_id),
    product_line_id: safeUuidOrNull(row.product_line_id),
    campaigns: normalizeStringArray(row.campaigns),
    campaigns_json: normalizeStringArray(row.campaigns_json ?? row.campaigns),
    tags: normalizeStringArray(row.tags_json ?? row.tags),
    highlights: normalizeStringArray(row.highlights_json ?? row.highlights),
    price,
    seasonal_price_bands:
      parseSeasonalPriceBandsFromUnknown(row.seasonal_price_bands) ?? undefined,
    duration:
      typeof row.duration === "string"
        ? row.duration
        : typeof row.duration_days === "number"
          ? `${row.duration_days}일`
          : undefined,
    departure:
      typeof row.departure === "string" && row.departure.trim() !== ""
        ? row.departure.trim()
        : undefined,
    airline:
      typeof row.airline === "string" && row.airline.trim() !== ""
        ? row.airline.trim()
        : undefined,
    hotel:
      typeof row.hotel === "string" && row.hotel.trim() !== ""
        ? row.hotel.trim()
        : undefined,
    travelStyle:
      typeof row.travel_style === "string" && row.travel_style.trim() !== ""
        ? (row.travel_style as string).trim()
        : typeof row.travelStyle === "string" && (row.travelStyle as string).trim() !== ""
          ? (row.travelStyle as string).trim()
          : undefined,
    departures: (() => {
      const raw = row.departures ?? row.departures_json;
      if (Array.isArray(raw)) return normalizeStringArray(raw) ?? undefined;
      if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          return Array.isArray(parsed) ? normalizeStringArray(parsed) ?? undefined : undefined;
        } catch {
          return undefined;
        }
      }
      return undefined;
    })(),
    itinerary: typeof row.itinerary === "string" ? row.itinerary : undefined,
    inclusions: typeof row.inclusions === "string" ? row.inclusions : undefined,
    point_benefits: typeof row.point_benefits === "string" ? row.point_benefits : undefined,
    point_tourism: typeof row.point_tourism === "string" ? row.point_tourism : undefined,
    point_guide: typeof row.point_guide === "string" ? row.point_guide : undefined,
    meeting_info: typeof row.meeting_info === "string" ? row.meeting_info : undefined,
    travel_insurance: typeof row.travel_insurance === "string" ? row.travel_insurance : undefined,
    included_items: typeof row.included_items === "string" ? row.included_items : undefined,
    excluded_items: typeof row.excluded_items === "string" ? row.excluded_items : undefined,
    detailed_schedule: typeof row.detailed_schedule === "string" ? row.detailed_schedule : undefined,
    optional_tours: typeof row.optional_tours === "string" ? row.optional_tours : undefined,
    min_departure_people: typeof row.min_departure_people === "string" ? row.min_departure_people : undefined,
    terms_and_notes: typeof row.terms_and_notes === "string" ? row.terms_and_notes : undefined,
    booking_notes: typeof row.booking_notes === "string" ? row.booking_notes : undefined,
    travel_notes: typeof row.travel_notes === "string" ? row.travel_notes : undefined,
    booking_conditions:
      typeof row.booking_conditions === "string" ? row.booking_conditions : undefined,
    refund_policy: typeof row.refund_policy === "string" ? row.refund_policy : undefined,
    refund_policy_template_type:
      typeof row.refund_policy_template_type === "string"
        ? row.refund_policy_template_type
        : undefined,
    booking_notes_template_type:
      typeof row.booking_notes_template_type === "string"
        ? row.booking_notes_template_type
        : undefined,
    travel_notes_template_type:
      typeof row.travel_notes_template_type === "string"
        ? row.travel_notes_template_type
        : undefined,
    booking_conditions_template_type:
      typeof row.booking_conditions_template_type === "string"
        ? row.booking_conditions_template_type
        : undefined,
    terms_template_type:
      typeof row.terms_template_type === "string" ? row.terms_template_type : undefined,
    departure_from_airport:
      typeof row.departure_from_airport === "string" ? row.departure_from_airport : undefined,
    departure_from_date:
      typeof row.departure_from_date === "string" ? row.departure_from_date : undefined,
    departure_from_time:
      typeof row.departure_from_time === "string" ? row.departure_from_time : undefined,
    departure_to_airport:
      typeof row.departure_to_airport === "string" ? row.departure_to_airport : undefined,
    departure_to_date:
      typeof row.departure_to_date === "string" ? row.departure_to_date : undefined,
    departure_to_time:
      typeof row.departure_to_time === "string" ? row.departure_to_time : undefined,
    departure_flight_name:
      typeof row.departure_flight_name === "string" ? row.departure_flight_name : undefined,
    departure_baggage_limit:
      typeof row.departure_baggage_limit === "string" ? row.departure_baggage_limit : undefined,
    arrival_from_airport:
      typeof row.arrival_from_airport === "string" ? row.arrival_from_airport : undefined,
    arrival_from_date:
      typeof row.arrival_from_date === "string" ? row.arrival_from_date : undefined,
    arrival_from_time:
      typeof row.arrival_from_time === "string" ? row.arrival_from_time : undefined,
    arrival_to_airport:
      typeof row.arrival_to_airport === "string" ? row.arrival_to_airport : undefined,
    arrival_to_date:
      typeof row.arrival_to_date === "string" ? row.arrival_to_date : undefined,
    arrival_to_time:
      typeof row.arrival_to_time === "string" ? row.arrival_to_time : undefined,
    arrival_flight_name:
      typeof row.arrival_flight_name === "string" ? row.arrival_flight_name : undefined,
    arrival_baggage_limit:
      typeof row.arrival_baggage_limit === "string" ? row.arrival_baggage_limit : undefined,
    meta_title: typeof row.meta_title === "string" ? row.meta_title : undefined,
    meta_description:
      typeof row.meta_description === "string" ? row.meta_description : undefined,
    is_active: typeof row.is_active === "boolean" ? row.is_active : undefined,
    is_recommend: typeof row.is_recommend === "boolean" ? row.is_recommend : undefined,
    is_popular: typeof row.is_popular === "boolean" ? row.is_popular : undefined,
    sort_order: sortOrder,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    status:
      row.status === "AVAILABLE" ||
      row.status === "LIMITED" ||
      row.status === "SOLD_OUT" ||
      row.status === "CONSULT_REQUIRED"
        ? row.status
        : undefined,
    fuel_included:
      row.fuel_included === true ? true : row.fuel_included === false ? false : undefined,
    price_meta:
      typeof row.price_meta === "string" && row.price_meta.trim() !== ""
        ? row.price_meta.trim()
        : undefined,
    meta_info:
      typeof row.meta_info === "string" && row.meta_info.trim() !== ""
        ? row.meta_info.trim()
        : undefined,
    overview_accommodation:
      typeof row.overview_accommodation === "string" && row.overview_accommodation.trim() !== ""
        ? row.overview_accommodation.trim()
        : undefined,
    overview_region:
      typeof row.overview_region === "string" && row.overview_region.trim() !== ""
        ? row.overview_region.trim()
        : undefined,
    overview_duration:
      typeof row.overview_duration === "string" && row.overview_duration.trim() !== ""
        ? row.overview_duration.trim()
        : undefined,
    one_liner:
      typeof row.one_liner === "string" && row.one_liner.trim() !== ""
        ? row.one_liner.trim()
        : undefined,
    overview_json: normalizeOverview(row.overview_json),
    itinerary_media_json: normalizeItineraryMedia(row.itinerary_media_json),
    itinerary_days: normalizeProductItineraryDays(row.itinerary_days ?? row.itinerary_days_simple),
    itinerary_days_json: normalizeItineraryDays(row.itinerary_days_json),
    itinerary_v2_json: normalizeItineraryV2(row.itinerary_v2_json),
    theme_chart_json: normalizeThemeChartJson(row.theme_chart_json),
    trust: normalizeTrust(row.trust),
    options: normalizeOptions(row.options, typeof row.price === "number" ? row.price : undefined),
  };
}

/** 상세 페이지용: 캐시 없이 항상 최신 데이터 조회 (수정 저장 후 즉시 반영) */
export async function getProductByIdFresh(id: string) {
  const [{ data, error }, campaignTaxonomies] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    getCampaignTaxonomiesForCard(),
  ]);

  if (error || !data) {
    return null;
  }

  const p = normalizeProduct(data as Record<string, unknown>);
  return hydrateProductsWithCampaignCardMeta([p], campaignTaxonomies)[0]!;
}
```

---

## 4. 개편 시 바로 볼 포인트

- 현재 HTML 조립의 최종 진입점은 `buildSmartstoreDetailHtmlFromProduct()`
- 상품 본문 해석은 `mapProductToSmartstoreHtmlViewModel()`
- 실제 섹션 레이아웃은 `buildSmartstoreDetailSections.ts`
- 관리자 버튼 → 모달 → `/api/admin/products/[id]/smartstore-html` → `getProductByIdFresh()` → `resolveProductNoticesForDetailPage()` → `buildSmartstoreDetailHtmlFromProduct()` 순서
- 판매 설득형 구조 개편 시 우선 변경 후보
  - `SmartstoreHtmlViewModel` 확장
  - `mapProductToSmartstoreHtmlViewModel()`에서 상품 컨셉 추론
  - `buildTitleBlock()`, `buildSummarySection()`, `buildBookingSection()`, `buildConsultFooter()`
  - 필요 시 신규 섹션 함수 추가 후 `buildAllSectionsHtml()` 재구성
