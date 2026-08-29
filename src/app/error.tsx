"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      console.error("[app] page error:", error?.digest ?? error?.name);
    } catch {
      // logging must never break recovery UI
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-gradient-to-b from-[var(--surface-muted)] to-[var(--surface)] px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)]">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">문제가 발생했어요</h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
          페이지를 불러오는 중 문제가 발생했습니다.
          <br />
          잠시 후 다시 시도해 주세요.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className={cn(buttonVariants({ variant: "primary", size: "md" }), "w-full")}
          >
            다시 시도
          </button>
          <Link
            href="/products"
            className={cn(buttonVariants({ variant: "outline", size: "md" }), "w-full")}
          >
            상품 둘러보기
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-[var(--text-secondary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
