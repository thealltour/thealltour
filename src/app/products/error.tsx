"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * /products 및 /products/[id] 세그먼트 error boundary.
 * PDP 전용 error.tsx는 상속으로 충분해 별도 두지 않음.
 */
export default function ProductsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      console.error("[products] page error:", error?.digest ?? error?.name);
    } catch {
      // no-op
    }
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)]">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          상품을 불러오지 못했어요
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
          일시적인 오류일 수 있습니다. 다시 시도해 주세요.
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
            전체 상품
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center justify-center text-sm font-medium text-[var(--text-secondary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            홈
          </Link>
        </div>
      </div>
    </div>
  );
}
