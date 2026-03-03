"use client";

import { useEffect, useCallback, useRef } from "react";

export type ImageImportGuideModalProps = {
  open: boolean;
  onClose: () => void;
};

const STEPS = [
  {
    title: "1️⃣ 이벤트 선택",
    content: [
      "일정에서 \"이 이벤트에 추가 대상\" 버튼을 클릭하세요.",
      "상단에 현재 선택된 이벤트가 표시됩니다.",
    ],
  },
  {
    title: "2️⃣ 이미지 추출 도구 클릭",
    content: [
      "원본주소 옆 \"이미지 추출 도구\" 버튼을 클릭합니다.",
      "처음 사용하는 경우 북마크에 등록하세요.",
    ],
  },
  {
    title: "3️⃣ 모두투어 페이지에서 실행",
    content: [
      "상품 상세 페이지를 엽니다.",
      "북마크를 클릭합니다.",
      "\"XX개 이미지 복사 완료\" 알림이 뜹니다.",
    ],
  },
  {
    title: "4️⃣ 관리자에 붙여넣기",
    content: [
      "관리자 페이지의 이미지 붙여넣기 입력창에 Ctrl+V",
      "\"선택 이벤트에 추가\" 버튼 클릭",
    ],
  },
];

const TIPS = [
  "중복 이미지는 자동 제거됩니다.",
  "대표 이미지가 없으면 첫 이미지가 자동 지정됩니다.",
  "이벤트를 먼저 선택해야 합니다.",
];

export function ImageImportGuideModal({ open, onClose }: ImageImportGuideModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
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
      closeButtonRef.current?.focus();
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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="image-import-guide-title"
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl text-gray-900 dark:text-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-slate-700 px-5 py-4 shrink-0">
          <div>
            <h2
              id="image-import-guide-title"
              className="text-lg font-bold text-gray-900 dark:text-gray-100"
            >
              이미지 자동 등록 사용법
            </h2>
            <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
              모두투어 상품 이미지를 빠르게 등록하는 방법
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-gray-100"
            aria-label="닫기"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>

        {/* 본문 스크롤 */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* 단계 카드 */}
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-4"
              >
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {step.title}
                </h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  {step.content.map((line, j) => (
                    <li key={j}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 주의 안내 박스 */}
          <div className="mt-5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-100 dark:bg-slate-800/80 px-4 py-3">
            <ul className="space-y-1.5 text-sm text-gray-700 dark:text-gray-300">
              {TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 shrink-0">✔</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="border-t border-gray-200 dark:border-slate-700 px-5 py-4 shrink-0">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-gray-800 dark:bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
