import Link from "next/link";
import Image from "next/image";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import {
  getDestinationLandingHref,
  getThemeLandingHref,
  getProductLineLandingHref,
} from "@/lib/hubLandingLinks";
import { CARD_HOVER, CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";

const FALLBACK_IMAGE = "https://picsum.photos/seed/thealltour-home/800/500";

export type HomeTaxonomyGridProps = {
  items: ProductTaxonomy[];
  type: "destination" | "theme" | "product_line";
  className?: string;
};

function getHref(item: ProductTaxonomy, type: HomeTaxonomyGridProps["type"]): string {
  switch (type) {
    case "destination":
      return getDestinationLandingHref(item);
    case "theme":
      return getThemeLandingHref(item);
    case "product_line":
      return getProductLineLandingHref(item);
    default:
      return "/products";
  }
}

/**
 * 홈용 taxonomy 탐색 카드 그리드.
 * card_image_url, card_title, card_description 사용.
 */
export function HomeTaxonomyGrid({
  items,
  type,
  className,
}: HomeTaxonomyGridProps) {
  if (items.length === 0) return null;

  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
      aria-label={type === "destination" ? "지역별 탐색" : type === "theme" ? "테마별 탐색" : "상품군별 탐색"}
    >
      {items.map((item) => {
        const href = getHref(item, type);
        const title = item.card_title?.trim() || item.name;
        const description = item.card_description?.trim() || null;
        const imageUrl = item.card_image_url?.trim() || null;

        return (
          <li key={item.id}>
            <Link
              href={href}
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
              <div className="flex flex-1 flex-col p-4 sm:p-5">
                {description ? (
                  <p className="line-clamp-2 type-caption text-[var(--text-muted)]">
                    {description}
                  </p>
                ) : null}
                <span className="mt-3 inline-flex items-center section-label text-[var(--primary)]">
                  자세히 보기
                  <span className="ml-1" aria-hidden>→</span>
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
