"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[search] page error:", error.message);
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--theall-page-bg)] flex items-center justify-center p-6">
      <div className="rounded-2xl bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] max-w-md">
        <p className="font-semibold text-[var(--text-primary)]">검색 결과를 불러오지 못했습니다.</p>
        <p className="mt-2 type-small text-[var(--text-muted)]">
          일시적인 오류일 수 있습니다. 다시 시도해 주세요.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 type-btn font-semibold text-[var(--on-primary)] transition hover:opacity-90"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
          >
            홈으로
          </Link>
        </div>
      </div>
    </div>
  );
}
