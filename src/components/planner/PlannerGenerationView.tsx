"use client";

import { useEffect, useState } from "react";

const STATUS_LINES = [
  "여행 조건을 정리하고 있어요",
  "일정을 구성하고 있어요",
  "동선과 여행 스타일을 반영하고 있어요",
] as const;

type PlannerGenerationViewProps = {
  destination: string;
};

export function PlannerGenerationView({ destination }: PlannerGenerationViewProps) {
  const [idx, setIdx] = useState(0);
  const label = destination.trim() || "여행";

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIdx((prev) => (prev + 1) % STATUS_LINES.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-16 text-center sm:px-0">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]"
        aria-hidden
      />
      <h1 className="heading-display type-h2 text-[var(--foreground)]">
        {label} 여행 플랜을 만들고 있어요.
      </h1>
      <p className="type-body text-[var(--text-muted)]" aria-live="polite">
        {STATUS_LINES[idx]}
      </p>
      <p className="type-caption text-[var(--text-subtle)]">잠시만 기다려 주세요.</p>
    </div>
  );
}
