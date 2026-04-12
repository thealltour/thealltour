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
