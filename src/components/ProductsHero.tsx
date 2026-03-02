"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConsultModal } from "@/components/ConsultModal";

type ProductsHeroVariant = "package" | "golf";

type SiteSettingsClient = {
  products_hero_headline?: string;
  products_hero_subcopy?: string;
  products_hero_regions?: string;
  golf_hero_headline?: string;
  golf_hero_subcopy?: string;
  golf_hero_regions?: string;
};

type HeroRegionOption = {
  id: string;
  label: string;
  searchKeyword: string;
};

const DEFAULT_PACKAGE_HEADLINE =
  "패키지상품으로 원하시는 지역·예산에 맞춰 바로 상담까지 연결해 드려요.";
const DEFAULT_PACKAGE_SUBCOPY =
  "골프/패키지, 가족·지인·단체 여행까지. 관심 있는 지역과 대략적인 일정만 알려주시면, 담당자가 상품을 추려 1:1로 안내해 드립니다.";

const DEFAULT_GOLF_HEADLINE =
  "골프/파크골프 전문 맞춤 설계로 라운딩 동선을 깔끔하게 잡아드립니다.";
const DEFAULT_GOLF_SUBCOPY =
  "선호하는 골프장, 라운딩 횟수, 동행 인원과 예산을 알려주시면, 시즌에 맞는 최적의 골프투어 코스를 추천해 드립니다.";

const DEFAULT_PACKAGE_REGIONS: HeroRegionOption[] = [
  { id: "japan", label: "일본 골프·패키지", searchKeyword: "일본" },
  { id: "se-asia", label: "동남아 골프·휴양", searchKeyword: "동남아" },
  { id: "europe", label: "유럽 여행", searchKeyword: "유럽" },
  { id: "domestic", label: "국내·제주", searchKeyword: "국내" },
];

const DEFAULT_GOLF_REGIONS: HeroRegionOption[] = [
  { id: "golf-japan", label: "일본 골프투어", searchKeyword: "일본 골프" },
  { id: "golf-se-asia", label: "동남아 골프투어", searchKeyword: "동남아 골프" },
  { id: "golf-domestic", label: "국내 골프/파크골프", searchKeyword: "국내 골프" },
];

type ProductsHeroProps = {
  variant: ProductsHeroVariant;
};

export default function ProductsHero({ variant }: ProductsHeroProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openModal } = useConsultModal();
  const [settings, setSettings] = useState<SiteSettingsClient | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>(() => searchParams.get("region") ?? "");
  const [regions, setRegions] = useState<HeroRegionOption[]>(
    variant === "golf" ? DEFAULT_GOLF_REGIONS : DEFAULT_PACKAGE_REGIONS,
  );

  useEffect(() => {
    let isMounted = true;

    // variant가 바뀔 때 기본 옵션을 먼저 맞춰준다.
    setRegions(variant === "golf" ? DEFAULT_GOLF_REGIONS : DEFAULT_PACKAGE_REGIONS);

    async function load() {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" });
        const result = (await response.json()) as SiteSettingsClient | { message?: string };
        if (!response.ok || !result || typeof result !== "object" || "message" in result) {
          return;
        }
        const data = result as SiteSettingsClient;
        if (isMounted) {
          setSettings(data);
          const rawRegions =
            variant === "golf" ? data.golf_hero_regions : data.products_hero_regions;
          if (rawRegions && typeof rawRegions === "string") {
            try {
              const parsed = JSON.parse(rawRegions) as HeroRegionOption[];
              if (Array.isArray(parsed) && parsed.length > 0) {
                const normalized = parsed
                  .map((item) => ({
                    id: String(item.id ?? "").trim(),
                    label: String(item.label ?? "").trim(),
                    searchKeyword: String(item.searchKeyword ?? "").trim(),
                  }))
                  .filter((item) => item.id && item.label);
                if (normalized.length > 0) {
                  setRegions(normalized);
                }
              }
            } catch {
              // ignore parse error and keep defaults
            }
          }
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

  // URL의 region 파라미터가 바뀔 때마다 선택값 동기화
  useEffect(() => {
    const region = searchParams.get("region") ?? "";
    setSelectedRegion(region);
  }, [searchParams, variant]);

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

  const selectedOption = useMemo(
    () => regions.find((item) => item.id === selectedRegion) ?? null,
    [regions, selectedRegion],
  );

  function handleRegionChange(value: string) {
    setSelectedRegion(value);
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      const option = regions.find((item) => item.id === value);
      if (option) {
        params.set("region", option.id);
        if (option.searchKeyword) {
          params.set("q", option.searchKeyword);
        }
      }
    } else {
      params.delete("region");
      params.delete("q");
    }

    const queryString = params.toString();
    router.push(queryString ? `/products?${queryString}` : "/products");
  }

  const ctaHref = useMemo(() => {
    const base = "/quote";
    const params = new URLSearchParams();

    if (selectedOption) {
      params.set("product_title", selectedOption.label);

      const productsParams = new URLSearchParams(searchParams.toString());
      productsParams.set("region", selectedOption.id);
      if (selectedOption.searchKeyword) {
        productsParams.set("q", selectedOption.searchKeyword);
      }

      const productsQuery = productsParams.toString();
      const sourcePath = productsQuery ? `/products?${productsQuery}` : "/products";
      params.set("source_path", sourcePath);
    }

    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [searchParams, selectedOption]);

  function handleConsultCtaClick() {
    const isMobile =
      typeof window !== "undefined" ? window.matchMedia("(max-width: 767px)").matches : false;
    if (isMobile) {
      const query = searchParams.toString();
      openModal({
        productTitle: selectedOption?.label || (variant === "golf" ? "골프/파크골프 맞춤 일정" : "패키지 맞춤 일정"),
        sourcePath: query ? `${pathname}?${query}` : pathname,
      });
      return;
    }
    router.push(ctaHref);
  }

  return (
    <section className="rounded-3xl bg-white/95 p-5 shadow-md ring-1 ring-[#dbeafe] md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-stretch md:gap-8">
      <div className="flex flex-col justify-center space-y-2.5 md:space-y-3.5">
        <p className="section-label text-[#B8962E] md:type-small">
          {variant === "golf" ? "THEALL TOUR GOLF" : "THEALL TOUR PACKAGE"}
        </p>
        <h1 className="section-title type-h2 text-content-primary md:type-h1 md:leading-[1.15]">
          {headline}
        </h1>
        <p className="type-small leading-relaxed text-content-secondary md:type-body">{subcopy}</p>
      </div>

      <div className="mt-4 flex h-full w-full max-w-md flex-col justify-center space-y-3 rounded-2xl bg-[#f9fbff] p-4 md:mt-0 md:max-w-none">
        <div className="space-y-1.5">
          <label htmlFor="products-hero-region" className="section-label text-content-secondary md:type-small">
            {variant === "golf" ? "어떤 일정을 찾고 계신가요?" : "어떤 여행을 계획 중이신가요?"}
          </label>
          <select
            id="products-hero-region"
            className="h-10 w-full rounded-xl border border-[#d9e1ec] bg-white px-3 type-small text-content-primary outline-none transition focus:border-[#1E3A8A] focus:ring-2 focus:ring-[#1E3A8A]/20"
            value={selectedRegion}
            onChange={(event) => handleRegionChange(event.target.value)}
          >
            <option value="">
              {variant === "golf" ? "맞춤일정 (추천순)" : "맞춤테마여행 (추천순)"}
            </option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleConsultCtaClick}
          className="type-btn inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#1E3A8A] px-4 py-2.5 text-white shadow-md transition hover:bg-[#0F172A] active:translate-y-[1px]"
        >
          바로 상담 요청하기
        </button>
        <p className="type-caption leading-relaxed text-content-muted">
          상담 요청서에
          <span className="hidden sm:inline"> 희망 날짜·인원·선호하는 골프장/도시 등을 자유롭게 적어 주세요.</span>
          <span className="sm:hidden"> 희망 날짜·인원·선호 코스를 편하게 적어 주세요.</span>
        </p>
      </div>
    </section>
  );
}

