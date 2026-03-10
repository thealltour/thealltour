"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";
import type { Product } from "@/types/product";

export type ProductTripHighlightsProps = {
  /** 상품 데이터. 있으면 duration / meta_info / category / theme / tags에서 최대 4개 추출 */
  product?: Product | null;
  /** product 없을 때 수동 전달용 (우선순위: duration → region → category → theme → tags) */
  duration?: string;
  region?: string;
  category?: string;
  theme?: string;
  tags?: string[] | null;
  /** 최대 표시 개수 (기본 4) */
  maxItems?: number;
};

type HighlightItem = { icon?: "check"; title: string };

function normalize(s: string | undefined | null): string {
  if (s == null) return "";
  const t = String(s).trim();
  return t.length > 32 ? `${t.slice(0, 29)}…` : t;
}

function buildHighlights(props: ProductTripHighlightsProps): HighlightItem[] {
  const max = Math.min(4, props.maxItems ?? 4);
  const out: HighlightItem[] = [];
  const add = (title: string) => {
    const t = normalize(title);
    if (t && !out.some((o) => o.title === t)) out.push({ icon: "check", title: t });
  };

  const p = props.product;
  if (p) {
    if (p.duration?.trim()) add(p.duration.trim().includes("박") || p.duration.trim().includes("일") ? p.duration.trim() : `${p.duration.trim()} 일정`);
    if (p.meta_info?.trim()) add(p.meta_info.trim());
    if (p.category?.trim()) add(p.category.trim());
    if (p.theme?.trim()) {
      const themes = p.theme.split(/[,·]/).map((t) => t.trim()).filter(Boolean);
      themes.slice(0, 2).forEach((t) => add(t));
    }
    const tags = Array.isArray(p.tags) ? p.tags : [];
    for (const t of tags) {
      if (out.length >= max) break;
      if (typeof t === "string" && t.trim()) add(t.trim());
    }
  } else {
    if (props.duration) add(props.duration.includes("박") || props.duration.includes("일") ? props.duration : `${props.duration} 일정`);
    if (props.region) add(props.region);
    if (props.category) add(props.category);
    if (props.theme) add(props.theme);
    (props.tags ?? []).forEach((t) => add(t));
  }

  return out.slice(0, max);
}

export function ProductTripHighlights({
  product = null,
  duration = "",
  region = "",
  category = "",
  theme = "",
  tags = null,
  maxItems = 4,
}: ProductTripHighlightsProps) {
  const items = useMemo(
    () => buildHighlights({ product, duration, region, category, theme, tags, maxItems }),
    [product, duration, region, category, theme, tags, maxItems],
  );

  if (items.length === 0) return null;

  return (
    <section className="w-full" aria-label="여행 핵심 특징">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {items.map((item, i) => (
          <div
            key={`${item.title}-${i}`}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-soft)]"
          >
            {item.icon === "check" && (
              <Check className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
            )}
            <span className="text-sm font-medium text-[var(--text-primary)]">{item.title}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
