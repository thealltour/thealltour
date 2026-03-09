"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReviewSortOption } from "@/types/review";

export default function ReviewListFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sort = (searchParams.get("sort") as ReviewSortOption) || "latest";
  const onlyVerified = searchParams.get("verified") === "1";
  const onlyWithImages = searchParams.get("photos") === "1";
  const minRating = searchParams.get("minRating") || "";

  const setParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([k, v]) => {
      if (v === "" || v === "0") next.delete(k);
      else next.set(k, v);
    });
    const q = next.toString();
    router.push(q ? `/reviews?${q}` : "/reviews");
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className="text-sm font-medium text-slate-700">정렬</span>
      <select
        value={sort}
        onChange={(e) => setParams({ sort: e.target.value })}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="latest">최신순</option>
        <option value="rating">평점 높은순</option>
        <option value="helpful">도움되는 후기순</option>
        <option value="photo">사진 있는 후기 우선</option>
        <option value="recommended">추천순</option>
        <option value="rating_low">평점 낮은순</option>
        <option value="verified_first">인증 후기 우선</option>
      </select>

      <span className="ml-2 text-sm font-medium text-slate-700">필터</span>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyVerified}
          onChange={(e) => setParams({ verified: e.target.checked ? "1" : "0" })}
          className="rounded border-slate-300"
        />
        인증 후기만
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={onlyWithImages}
          onChange={(e) => setParams({ photos: e.target.checked ? "1" : "0" })}
          className="rounded border-slate-300"
        />
        사진 후기만
      </label>
      <select
        value={minRating}
        onChange={(e) => setParams({ minRating: e.target.value })}
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">전체 별점</option>
        <option value="5">5점</option>
        <option value="4">4점 이상</option>
        <option value="3">3점 이상</option>
      </select>
    </div>
  );
}
