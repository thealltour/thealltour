"use client";

import Link from "next/link";
import { ExternalLink, Pencil, Trash2, Power } from "lucide-react";
import type { Product } from "@/types/product";

type AdminProductsQuickActionsProps = {
  product: Product;
  pendingToggleId: string | null;
  pendingDeleteId: string | null;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggleActive: (product: Product) => void;
  /** 모바일 등에서 텍스트 라벨 표시 */
  compact?: boolean;
  /** 목록 한 줄 행용 더 작은 버튼 */
  dense?: boolean;
};

export default function AdminProductsQuickActions({
  product,
  pendingToggleId,
  pendingDeleteId,
  onEdit,
  onDelete,
  onToggleActive,
  compact = false,
  dense = false,
}: AdminProductsQuickActionsProps) {
  const busy = pendingToggleId === product.id || pendingDeleteId === product.id;
  const active = product.is_active !== false;

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
