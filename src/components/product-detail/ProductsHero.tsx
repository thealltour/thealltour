"use client";

import { useEffect, useMemo, useState } from "react";

type ProductsHeroVariant = "package" | "golf";

type SiteSettingsClient = {
  products_hero_headline?: string;
  products_hero_subcopy?: string;
  golf_hero_headline?: string;
  golf_hero_subcopy?: string;
};

const DEFAULT_PACKAGE_SUBCOPY =
  "지역·테마·상품군으로 원하는 여행을 골라보세요.";

const DEFAULT_GOLF_SUBCOPY =
  "선호 지역과 출발일을 고르면 맞는 골프·파크골프 상품을 바로 확인할 수 있습니다.";

type ProductsHeroProps = {
  variant: ProductsHeroVariant;
  /** 선택된 지역·테마 taxonomy 이름 (있으면 제목 아래 표시) */
  contextLabel?: string | null;
  /** 골프 프리셋: 달력 앵커로 스크롤 */
  golfDatesHref?: string | null;
};

/**
 * 목록 첫 화면용 짧은 제목·소개.
 * 패키지: 여행상품 / 골프: 골프·파크골프. 선택 taxonomy는 contextLabel.
 */
export default function ProductsHero({
  variant,
  contextLabel = null,
  golfDatesHref = null,
}: ProductsHeroProps) {
  const [settings, setSettings] = useState<SiteSettingsClient | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const result = (await response.json()) as SiteSettingsClient | { message?: string };
        if (!response.ok || !result || typeof result !== "object" || "message" in result) {
          return;
        }
        if (isMounted) {
          setSettings(result as SiteSettingsClient);
        }
      } catch {
        // ignore
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [variant]);

  const title = variant === "golf" ? "골프·파크골프" : "여행상품";
  const context = contextLabel?.trim() || null;
  const datesHref = golfDatesHref?.trim() || null;

  const subcopy = useMemo(() => {
    if (variant === "golf") {
      if (settings?.golf_hero_subcopy && settings.golf_hero_subcopy.trim().length > 0) {
        return settings.golf_hero_subcopy.trim();
      }
      return DEFAULT_GOLF_SUBCOPY;
    }
    if (settings?.products_hero_subcopy && settings.products_hero_subcopy.trim().length > 0) {
      return settings.products_hero_subcopy.trim();
    }
    return DEFAULT_PACKAGE_SUBCOPY;
  }, [settings, variant]);

  return (
    <section className="space-y-1.5 sm:space-y-2" aria-labelledby="products-hero-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h1
            id="products-hero-title"
            className="section-title type-h3 font-semibold leading-snug text-[var(--foreground)] md:type-h2"
          >
            {title}
          </h1>
          {context ? (
            <p className="type-small font-medium text-[var(--primary)]">{context}</p>
          ) : null}
        </div>
        {datesHref ? (
          <a
            href={datesHref}
            className="inline-flex min-h-9 shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            출발일로 찾기
          </a>
        ) : null}
      </div>
      <p className="type-small max-w-2xl text-[var(--text-muted)] md:type-body md:leading-relaxed">
        {subcopy}
      </p>
    </section>
  );
}
