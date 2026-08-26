"use client";

import { useEffect, useMemo, useState } from "react";

type ProductsHeroVariant = "package" | "golf";

type SiteSettingsClient = {
  products_hero_headline?: string;
  products_hero_subcopy?: string;
  golf_hero_headline?: string;
  golf_hero_subcopy?: string;
};

const DEFAULT_PACKAGE_HEADLINE =
  "패키지상품으로 원하시는 지역·예산에 맞춰 바로 상담까지 연결해 드려요.";
const DEFAULT_PACKAGE_SUBCOPY =
  "골프/패키지, 가족·지인·단체 여행까지. 관심 있는 지역과 대략적인 일정만 알려주시면, 담당자가 상품을 추려 1:1로 안내해 드립니다.";

const DEFAULT_GOLF_HEADLINE =
  "골프/파크골프 전문 맞춤 설계로 라운딩 동선을 깔끔하게 잡아드립니다.";
const DEFAULT_GOLF_SUBCOPY =
  "선호하는 골프장, 라운딩 횟수, 동행 인원과 예산을 알려주시면, 시즌에 맞는 최적의 골프투어 코스를 추천해 드립니다.";

const MOBILE_PACKAGE_TITLE = "여행상품";
const MOBILE_PACKAGE_SUBTITLE = "원하는 여행상품을 찾아보세요";
const MOBILE_GOLF_TITLE = "골프 여행상품";
const MOBILE_GOLF_SUBTITLE = "원하는 골프상품을 찾아보세요";

type ProductsHeroProps = {
  variant: ProductsHeroVariant;
};

/**
 * Desktop: settings 기반 풀 Hero.
 * Mobile (lg 미만): compact title + 1줄 subtitle — Browse Mode 세로 밀도 개선.
 */
export default function ProductsHero({ variant }: ProductsHeroProps) {
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

  const headline = useMemo(() => {
    if (variant === "golf") {
      if (settings?.golf_hero_headline && settings.golf_hero_headline.trim().length > 0) {
        return settings.golf_hero_headline;
      }
      return DEFAULT_GOLF_HEADLINE;
    }
    if (settings?.products_hero_headline && settings.products_hero_headline.trim().length > 0) {
      return settings.products_hero_headline;
    }
    return DEFAULT_PACKAGE_HEADLINE;
  }, [settings, variant]);

  const subcopy = useMemo(() => {
    if (variant === "golf") {
      if (settings?.golf_hero_subcopy && settings.golf_hero_subcopy.trim().length > 0) {
        return settings.golf_hero_subcopy;
      }
      return DEFAULT_GOLF_SUBCOPY;
    }
    if (settings?.products_hero_subcopy && settings.products_hero_subcopy.trim().length > 0) {
      return settings.products_hero_subcopy;
    }
    return DEFAULT_PACKAGE_SUBCOPY;
  }, [settings, variant]);

  const mobileTitle = variant === "golf" ? MOBILE_GOLF_TITLE : MOBILE_PACKAGE_TITLE;
  const mobileSubtitle = variant === "golf" ? MOBILE_GOLF_SUBTITLE : MOBILE_PACKAGE_SUBTITLE;

  return (
    <section className="space-y-[var(--space-xs)]" aria-labelledby="products-hero-title">
      <p className="section-label hidden text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] lg:block md:type-small">
        {variant === "golf" ? "THEALL TOUR GOLF" : "THEALL TOUR PACKAGE"}
      </p>
      <h1
        id="products-hero-title"
        className="section-title type-h3 font-semibold leading-snug text-[var(--foreground)] lg:type-h2 lg:leading-[1.2] xl:type-h1"
      >
        <span className="lg:hidden">{mobileTitle}</span>
        <span className="hidden lg:inline">{headline}</span>
      </h1>
      <p className="type-small max-w-2xl text-[var(--text-muted)] lg:leading-relaxed lg:type-body">
        <span className="lg:hidden">{mobileSubtitle}</span>
        <span className="hidden lg:inline">{subcopy}</span>
      </p>
    </section>
  );
}
