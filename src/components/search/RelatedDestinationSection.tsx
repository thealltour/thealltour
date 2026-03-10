"use client";

import Link from "next/link";
import Image from "next/image";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { getDestinationLandingHref } from "@/lib/hubLandingLinks";
import { CARD_HOVER, CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type RelatedDestinationSectionProps = {
  items: ProductTaxonomy[];
  subtitle?: string;
  /** 현재 검색 쿼리 (analytics용) */
  query?: string | null;
};

const FALLBACK_IMAGE = "https://picsum.photos/seed/thealltour-dest/800/500";

export default function RelatedDestinationSection({
  items,
  subtitle,
  query,
}: RelatedDestinationSectionProps) {
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="related-destinations-heading" className="space-y-4">
      <div>
        <h2
          id="related-destinations-heading"
          className="heading-display type-h3 text-[var(--foreground)]"
        >
          연관 지역
        </h2>
        <p className="mt-1 type-small text-[var(--text-muted)]">
          {subtitle ?? "다른 지역으로도 여행을 찾아보세요"}
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-label="연관 지역 목록">
        {items.map((item, index) => {
          const href = getDestinationLandingHref(item);
          const title = item.card_title?.trim() || item.name;
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
                      section: "destination",
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
                    src={imageUrl || FALLBACK_IMAGE}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition duration-200 group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)]/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <span className="font-card-title line-clamp-2 text-base font-semibold text-white drop-shadow-sm md:text-lg">
                      {title}
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
