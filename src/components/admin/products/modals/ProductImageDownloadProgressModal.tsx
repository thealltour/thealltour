"use client";

import { X } from "lucide-react";
import type { ProductImageDownloadProgress } from "@/lib/images/imageDownloadProgress.types";
import { getDownloadStageLabel } from "@/lib/images/getDownloadStageLabel";

export type ProductImageDownloadProgressModalProps = {
  open: boolean;
  productTitle: string;
  progress: ProductImageDownloadProgress | null;
  onClose: () => void;
};

function stageDescription(stage: ProductImageDownloadProgress["stage"]): string {
  switch (stage) {
    case "collecting":
      return "이미지 목록을 수집하는 중입니다.";
    case "converting":
      return "이미지를 변환하는 중입니다.";
    case "zipping":
      return "ZIP 파일을 만드는 중입니다.";
    case "downloading":
      return "다운로드를 시작하는 중입니다.";
    case "done":
      return "다운로드 준비가 완료되었습니다.";
    case "error":
      return "다운로드 중 오류가 발생했습니다.";
    case "idle":
    default:
      return "준비 중입니다.";
  }
}

export default function ProductImageDownloadProgressModal({
  open,
  productTitle,
  progress,
  onClose,
}: ProductImageDownloadProgressModalProps) {
  if (!open) return null;

  const stage = progress?.stage ?? "idle";
  const total = progress?.total ?? 0;
  const completed = progress?.completed ?? 0;
  const failed = progress?.failed ?? 0;
  const processed = completed + failed;
  const ratio =
    total <= 0
      ? 0
      : stage === "converting" || stage === "collecting"
        ? Math.min(100, (processed / total) * 100)
        : stage === "zipping" || stage === "downloading" || stage === "done"
          ? 100
          : stage === "error"
            ? Math.min(100, (processed / total) * 100)
            : 0;

  const isTerminal = stage === "done" || stage === "error";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-zip-progress-title"
    >
      <div
        className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <div className="min-w-0">
            <h2
              id="image-zip-progress-title"
              className="text-base font-bold text-[var(--text-primary)]"
            >
              이미지 ZIP 생성 중
            </h2>
            <p className="mt-1 truncate text-xs text-[var(--text-muted)]" title={productTitle}>
              {productTitle || "(제목 없음)"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 px-4 py-4">
          <p className="text-xs font-medium text-[var(--text-secondary)]">
            {getDownloadStageLabel(stage)}
          </p>
          <p className="text-sm text-[var(--text-primary)]">{stageDescription(stage)}</p>
          {progress?.message ? (
            <p className="text-xs text-[var(--text-muted)]">{progress.message}</p>
          ) : null}

          {total > 0 ? (
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-[var(--text-secondary)]">
                <span>
                  {completed} / {total}장 처리 완료
                </span>
                {failed > 0 ? (
                  <span className="font-medium text-amber-800 dark:text-amber-200">실패 {failed}장</span>
                ) : null}
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
                role="progressbar"
                aria-valuenow={Math.round(ratio)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-200 ease-out"
                  style={{ width: `${ratio}%` }}
                />
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">{Math.round(ratio)}%</p>
            </div>
          ) : stage === "collecting" ? (
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
              aria-hidden
            >
              <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--primary)]/40" />
            </div>
          ) : null}

          {progress?.currentFileName ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                현재 파일
              </p>
              <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-primary)]" title={progress.currentFileName}>
                {progress.currentFileName}
              </p>
              {progress.currentSource ? (
                <p className="mt-1 text-[10px] text-[var(--text-muted)]">출처: {progress.currentSource}</p>
              ) : null}
            </div>
          ) : null}

          {isTerminal ? (
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              {stage === "done"
                ? "잠시 후 이 창이 닫히거나, 위 닫기로 바로 닫을 수 있습니다."
                : "문제가 계속되면 브라우저 콘솔 로그를 확인해 주세요."}
            </p>
          ) : (
            <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
              창을 닫아도 작업은 백그라운드에서 계속됩니다. 완료되면 토스트로 안내합니다.
            </p>
          )}

          {isTerminal ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              닫기
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
