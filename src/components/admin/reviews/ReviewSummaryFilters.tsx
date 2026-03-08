"use client";

import { useMemo, useState } from "react";
import type { ProductReviewSummary } from "@/types/reviewSummaries";
import { ProductReviewSummaryCard } from "./ProductReviewSummaryCard";

type ReviewSummaryFiltersProps = {
  summaries: ProductReviewSummary[];
};

type SentimentFilter = "all" | "positive" | "mixed" | "negative";

export function ReviewSummaryFilters({ summaries }: ReviewSummaryFiltersProps) {
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [minReviews, setMinReviews] = useState<string>("0");
  const [keyword, setKeyword] = useState("");

  const filtered = useMemo(() => {
    let list = summaries;
    if (sentiment !== "all") {
      list = list.filter((s) => s.sentiment === sentiment);
    }
    const min = parseInt(minReviews, 10);
    if (!Number.isNaN(min) && min > 0) {
      list = list.filter((s) => s.totalReviews >= min);
    }
    const k = keyword.trim().toLowerCase();
    if (k) {
      list = list.filter(
        (s) =>
          s.productId.toLowerCase().includes(k) ||
          s.summaryText.toLowerCase().includes(k) ||
          s.topKeywords.some((w) => w.toLowerCase().includes(k)),
      );
    }
    return list;
  }, [summaries, sentiment, minReviews, keyword]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
        <span className="text-xs font-medium text-[var(--text-muted)]">Sentiment</span>
        <select
          value={sentiment}
          onChange={(e) => setSentiment(e.target.value as SentimentFilter)}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
        >
          <option value="all">전체</option>
          <option value="positive">긍정</option>
          <option value="mixed">혼재</option>
          <option value="negative">부정</option>
        </select>
        <span className="text-xs font-medium text-[var(--text-muted)]">최소 리뷰 수</span>
        <input
          type="number"
          min={0}
          value={minReviews}
          onChange={(e) => setMinReviews(e.target.value)}
          className="w-20 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
        />
        <span className="text-xs font-medium text-[var(--text-muted)]">키워드 검색</span>
        <input
          type="text"
          placeholder="productId / 요약 / 키워드"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="min-w-[160px] rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm"
        />
        <span className="text-xs text-[var(--text-muted)]">
          {filtered.length}건
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {filtered.map((s) => (
          <ProductReviewSummaryCard key={s.productId} summary={s} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-[var(--text-muted)]">
          조건에 맞는 요약이 없습니다.
        </p>
      )}
    </div>
  );
}
