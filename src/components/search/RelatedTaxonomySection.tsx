"use client";

import Link from "next/link";
import Image from "next/image";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { getDestinationLandingHref, getThemeLandingHref } from "@/lib/hubLandingLinks";
import { CARD_HOVER, CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type TaxonomyType = "destination" | "theme";

export type RelatedTaxonomySectionProps = {
  items: ProductTaxonomy[];
  taxonomyType: TaxonomyType;
  subtitle?: string;
  /** 현재 검색 쿼리 (analytics용) */
  query?: string | null;
};

const FALLBACK_IMAGES: Record<TaxonomyType, string> = {
  destination: "https://picsum.photos/seed/thealltour-dest/800/500",
  theme: "https://picsum.photos/seed/thealltour-theme/800/500",
};

const TITLES: Record<TaxonomyType, string> = {
  destination: "연관 지역",
  theme: "연관 테마",
};

const DEFAULT_SUBTITLES: Record<TaxonomyType, string> = {
  destination: "다른 지역으로도 여행을 찾아보세요",
  theme: "비슷한 테마의 여행을 찾아보세요",
};

const ARIA_LABELS: Record<TaxonomyType, { heading: string; list: string }> = {
  destination: { heading: "related-destinations-heading", list: "연관 지역 목록" },
  theme: { heading: "related-themes-heading", list: "연관 테마 목록" },
};

export default function RelatedTaxonomySection({
  items,
  taxonomyType,
  subtitle,
  query,
}: RelatedTaxonomySectionProps) {
  if (items.length === 0) return null;

  const getHref = taxonomyType === "destination" ? getDestinationLandingHref : getThemeLandingHref;
  const title = TITLES[taxonomyType];
  const defaultSubtitle = DEFAULT_SUBTITLES[taxonomyType];
  const aria = ARIA_LABELS[taxonomyType];
  const fallbackImage = FALLBACK_IMAGES[taxonomyType];
  const analyticsSection = taxonomyType;

  return (
    <section aria-labelledby={aria.heading} className="space-y-4">
      <div>
        <h2
          id={aria.heading}
          className="heading-display type-h3 text-[var(--foreground)]"
        >
          {title}
        </h2>
        <p className="mt-1 type-small text-[var(--text-muted)]">
          {subtitle ?? defaultSubtitle}
        </p>
      </div>
      <ul
        className={cn(
          "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        )}
        aria-label={aria.list}
      >
        {items.map((item, index) => {
          const href = getHref(item);
          const itemTitle = item.card_title?.trim() || item.name;
          const imageUrl = item.card_image_url?.trim() || null;
          return (
            <li key={item.id}>
              <Link
                href={href}
                onClick={() =>
                  trackClientEvent(
                    createAnalyticsPayload({
                      eventName: ANALYTICS_EVENTS.search_recommendation_click,
                      source: ANALYTICS_SOURCES.hero_search,
                      section: analyticsSection,
                      label: item.name,
                      href,
                      position: index,
                      query: query ?? null,
                      pagePath: typeof window !== "undefined" ? window.location.pathname : null,
                      deviceType: inferDeviceType("desktop"),
                    }),
                  )
                }
                className={cn(
                  "group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition sm:rounded-3xl",
                  CARD_HOVER,
                  CARD_TRANSITION,
                )}
              >
                <div className="relative aspect-[16/10] w-full shrink-0 bg-[var(--surface-muted)]">
                  <Image
                    src={imageUrl || fallbackImage}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition duration-200 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)]/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <span className="font-card-title line-clamp-2 text-base font-semibold text-white drop-shadow-sm md:text-lg">
                      {itemTitle}
                    </span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <span className="inline-flex items-center section-label text-[var(--primary)]">
                    상품 보기
                    <span className="ml-1" aria-hidden>→</span>
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
