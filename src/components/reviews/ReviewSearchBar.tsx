"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useEffect } from "react";
import { Search } from "lucide-react";

const PLACEHOLDER = "여행 후기를 검색해보세요";

export function ReviewSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [value, setValue] = useState(q);

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const term = value.trim();
      const next = new URLSearchParams(searchParams.toString());
      if (term) next.set("q", term);
      else next.delete("q");
      router.push(`/reviews?${next.toString()}`);
    },
    [value, router, searchParams],
  );

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden
        />
        <input
          type="text"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={PLACEHOLDER}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 pl-11 text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
          aria-label={PLACEHOLDER}
        />
      </div>
    </form>
  );
}
