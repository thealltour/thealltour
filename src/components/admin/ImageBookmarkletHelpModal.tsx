"use client";

import { useEffect, useCallback } from "react";

export type ImageBookmarkletHelpModalProps = {
  open: boolean;
  onClose: () => void;
};

const STEPS = [
  "① [이미지 추출 도구] 버튼 클릭",
  "② 브라우저 북마크 URL에 붙여넣기",
  "③ 모두투어 상품 페이지에서 북마클릿 실행",
  "④ 복사된 URL을 관리자 페이지 붙여넣기 영역에 붙여넣기",
  "⑤ \"선택 이벤트에 추가\" 클릭",
];

const TIPS = [
  "반드시 먼저 \"이 이벤트에 추가 대상\"을 선택하세요.",
  "동일 이미지는 자동으로 중복 제거됩니다.",
  "대표 이미지가 없으면 첫 이미지가 자동 지정됩니다.",
];

export function ImageBookmarkletHelpModal({ open, onClose }: ImageBookmarkletHelpModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, handleEscape]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bookmarklet-help-title"
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--divider)] px-4 py-3">
          <h2
            id="bookmarklet-help-title"
            className="text-base font-bold text-[var(--text-primary)]"
          >
            이미지 자동 등록 사용법
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
            aria-label="닫기"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
          <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--text-primary)]">
            {STEPS.map((step, i) => (
              <li key={i} className="pl-1">
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">추가 안내</p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-[var(--text-muted)]">
              {TIPS.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-[var(--divider)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
