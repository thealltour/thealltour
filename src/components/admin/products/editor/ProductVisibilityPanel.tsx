"use client";

import { useEffect, useState } from "react";
import { patchAdminProduct } from "@/components/admin/products/api/adminProducts.client";
import type { BandImportImageSummary } from "@/lib/admin/bandImport/bandImportImageConstants";
import type { BandVenueImageNotice } from "@/lib/admin/bandImport/bandVenueImages";

export const BAND_IMPORT_RESULT_STORAGE_KEY = (productId: string) => `band-import-result:${productId}`;

export type BandImportResultNotice = {
  images: BandImportImageSummary | null;
  venueImages?: BandVenueImageNotice | null;
};

function formatVenueImageNotice(venue: BandVenueImageNotice): string {
  const text = `골프장·호텔·관광지 사진 ${venue.uploaded}장`;
  return venue.uploadErrors > 0 ? `${text} (변환 실패 ${venue.uploadErrors}장)` : text;
}

export function formatBandImportImageSummary(summary: BandImportImageSummary): string {
  const parts = [`대표 갤러리 ${summary.gallery}장`];
  if (summary.skipped > 0) parts.push(`일정표·QR 등 ${summary.skipped}장 제외`);
  if (summary.unsupported > 0) parts.push(`지원하지 않는 형식(heic·gif 등) ${summary.unsupported}장 제외`);
  if (summary.oversize > 0) parts.push(`10MB 초과 ${summary.oversize}장 제외`);
  if (summary.uploadErrors > 0) parts.push(`변환 실패 ${summary.uploadErrors}장`);
  return parts.join(" · ");
}

function readImportNotice(productId: string): BandImportResultNotice | null {
  try {
    const key = BAND_IMPORT_RESULT_STORAGE_KEY(productId);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    sessionStorage.removeItem(key);
    return JSON.parse(raw) as BandImportResultNotice;
  } catch {
    return null;
  }
}

type ProductVisibilityPanelProps = {
  productId: string;
  isActive: boolean | null;
  onChange: (next: boolean) => void;
  showToast: (type: "success" | "error", message: string) => void;
};

export function ProductVisibilityPanel({
  productId,
  isActive,
  onChange,
  showToast,
}: ProductVisibilityPanelProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<BandImportResultNotice | null>(null);

  useEffect(() => {
    setNotice(readImportNotice(productId));
  }, [productId]);

  if (isActive == null) return null;

  const toggle = async () => {
    const next = !isActive;
    setIsSaving(true);
    try {
      await patchAdminProduct(productId, { is_active: next });
      onChange(next);
      showToast("success", next ? "상품 노출을 시작했습니다." : "상품을 비노출로 전환했습니다.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "노출 상태를 바꾸지 못했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
      data-testid="product-visibility-panel"
    >
      <div className="min-w-0 text-sm">
        <p className="font-medium text-[var(--text-primary)]">
          {isActive ? "노출 중" : "비노출"}
          <span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
            {isActive
              ? "고객에게 상품이 보이고 있습니다."
              : "고객에게 보이지 않습니다. 내용을 검수한 뒤 노출을 시작하세요."}
          </span>
        </p>
        {notice ? (
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            밴드에서 비노출로 등록됨
            {notice.images ? ` · ${formatBandImportImageSummary(notice.images)}` : ""}
            {notice.venueImages ? ` · ${formatVenueImageNotice(notice.venueImages)}` : ""}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={isSaving}
        className={
          isActive
            ? "shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
            : "shrink-0 rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--primary)]/90 disabled:opacity-50"
        }
      >
        {isSaving ? "변경 중..." : isActive ? "비노출로 전환" : "노출 시작"}
      </button>
    </div>
  );
}
