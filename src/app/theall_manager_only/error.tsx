"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export default function ManagerOnlyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      console.error("[theall_manager_only] page error:", error?.digest ?? error?.name, error?.message);
    } catch {
      // logging must never break recovery UI
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[var(--bg)] px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)]">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">관리자 페이지 오류</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
          이 화면을 불러오는 중 문제가 발생했습니다.
          <br />
          다시 시도하거나 AI 마케팅 허브로 돌아가 주세요.
        </p>
        {error?.digest || error?.message ? (
          <p className="mt-4 break-all rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-left font-mono text-xs text-[var(--text-secondary)]">
            {error.digest ? `digest: ${error.digest}` : null}
            {error.digest && error.message ? " · " : null}
            {error.message ? error.message.slice(0, 240) : null}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}
          >
            다시 시도
          </button>
          <Link
            href="/theall_manager_only/ai-marketing"
            className={cn(buttonVariants({ variant: "outline", size: "md" }), "w-full")}
          >
            AI 마케팅 허브
          </Link>
          <Link
            href="/theall_manager_only/marketing-review"
            className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-[var(--text-secondary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            마케팅 리뷰로
          </Link>
        </div>
      </div>
    </div>
  );
}
