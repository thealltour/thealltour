"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

const CREATE_STATUS_LINES = [
  "선택한 여행 속도를 일정에 반영하고 있어요",
  "관심사에 맞는 하루 흐름을 구성하고 있어요",
  "동행 유형에 맞춰 일정 강도를 조정하고 있어요",
] as const;

const EDIT_STATUS_LINES = [
  "수정 요청을 일정에 반영하고 있어요",
  "하루 흐름과 순서를 다시 맞추고 있어요",
  "휴식과 이동 여유를 조정하고 있어요",
] as const;

type PlannerGenerationViewProps = {
  destination: string;
  mode?: "create" | "edit";
  /** Compact draft context line — display only. */
  contextLine?: string;
};

export function PlannerGenerationView({
  destination,
  mode = "create",
  contextLine,
}: PlannerGenerationViewProps) {
  const [idx, setIdx] = useState(0);
  const [longWait, setLongWait] = useState(false);
  const label = destination.trim() || "여행";
  const lines = mode === "edit" ? EDIT_STATUS_LINES : CREATE_STATUS_LINES;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIdx((prev) => (prev + 1) % lines.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [lines.length]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLongWait(true), 12_000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 px-4 py-16 text-center sm:max-w-md sm:px-0"
      role="status"
    >
      <span
        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"
        aria-hidden
      >
        <Sparkles className="h-6 w-6 motion-safe:animate-pulse motion-reduce:animate-none" />
      </span>

      <div className="space-y-2">
        <h1 className="heading-display type-h2 text-[var(--foreground)]">
          {mode === "edit" ? "일정을 수정하고 있어요" : `${label} 여행을 만들고 있어요`}
        </h1>
        <p className="type-body text-[var(--text-muted)]">
          {longWait
            ? "조금 더 세밀하게 일정을 정리하고 있어요."
            : "선택한 여행 조건을 바탕으로 하루별 일정과 동선을 정리하고 있어요."}
        </p>
      </div>

      {contextLine ? (
        <p className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 type-caption leading-snug text-[var(--text-secondary)]">
          {contextLine}
        </p>
      ) : null}

      <div className="w-full space-y-3">
        <div
          className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
          aria-hidden
        >
          <div
            className={cn(
              "absolute inset-y-0 w-1/3 rounded-full bg-[var(--primary)]",
              "motion-safe:animate-[planner-indeterminate_1.4s_ease-in-out_infinite]",
              "motion-reduce:left-1/3 motion-reduce:animate-none motion-reduce:opacity-70",
            )}
          />
        </div>

        <p
          className="flex items-center justify-center gap-2 type-body text-[var(--text-secondary)]"
          aria-live="polite"
        >
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--primary)] motion-safe:animate-pulse motion-reduce:animate-none"
            aria-hidden
          />
          {lines[idx]}
        </p>
      </div>
    </div>
  );
}
