"use client";

import { useEffect, useState } from "react";

const CREATE_STATUS_LINES = [
  "여행 조건을 정리하고 있어요",
  "일정을 구성하고 있어요",
  "동선과 여행 스타일을 반영하고 있어요",
] as const;

const EDIT_STATUS_LINES = [
  "수정 요청을 반영하고 있어요",
  "일정 순서를 다시 맞추고 있어요",
  "동선과 휴식 시간을 조정하고 있어요",
] as const;

type PlannerGenerationViewProps = {
  destination: string;
  mode?: "create" | "edit";
};

export function PlannerGenerationView({
  destination,
  mode = "create",
}: PlannerGenerationViewProps) {
  const [idx, setIdx] = useState(0);
  const label = destination.trim() || "여행";
  const lines = mode === "edit" ? EDIT_STATUS_LINES : CREATE_STATUS_LINES;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIdx((prev) => (prev + 1) % lines.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [lines.length]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-16 text-center sm:px-0">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]"
        aria-hidden
      />
      <h1 className="heading-display type-h2 text-[var(--foreground)]">
        {mode === "edit"
          ? "일정을 수정하고 있어요."
          : `${label} 여행 플랜을 만들고 있어요.`}
      </h1>
      <p className="type-body text-[var(--text-muted)]" aria-live="polite">
        {lines[idx]}
      </p>
      <p className="type-caption text-[var(--text-subtle)]">잠시만 기다려 주세요.</p>
    </div>
  );
}
