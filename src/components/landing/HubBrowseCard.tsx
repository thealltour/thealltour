import Link from "next/link";
import Image from "next/image";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import { CARD_HOVER, CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";

export type HubBrowseCardProps = {
  /** destination 또는 theme */
  item: ProductTaxonomy;
  href: string;
  /** 이미지 없을 때 배경 그라데이션만 쓸지 */
  showImage?: boolean;
  className?: string;
};

const FALLBACK_IMAGE =
  "https://picsum.photos/seed/thealltour-hub/800/500";

/**
 * 허브 페이지용 탐색 카드. 카테고리/테마 1개.
 * card_title || name, card_description, card_image_url(선택) 사용.
 */
export function HubBrowseCard({
  item,
  href,
  showImage = true,
  className,
}: HubBrowseCardProps) {
  const title = item.card_title?.trim() || item.name;
  const description = item.card_description?.trim() || null;
  const imageUrl = item.card_image_url?.trim() || null;

  return (
    <Link
      href={href}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition sm:rounded-3xl",
        CARD_HOVER,
        CARD_TRANSITION,
        className,
      )}
    >
      {showImage && (imageUrl || !description) ? (
        <div className="relative aspect-[16/10] w-full shrink-0 bg-[var(--surface-muted)]">
          <Image
            src={imageUrl || FALLBACK_IMAGE}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-200 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)]/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <span className="font-card-title line-clamp-2 text-base font-semibold text-white drop-shadow-sm md:text-lg">
              {title}
            </span>
          </div>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {(!showImage || !imageUrl) && (
          <h3 className="font-card-title type-small font-semibold text-[var(--foreground)] md:type-body">
            {title}
          </h3>
        )}
        {description ? (
          <p className="mt-1 line-clamp-2 type-caption text-[var(--text-muted)]">
            {description}
          </p>
        ) : null}
        <span className="mt-3 inline-flex items-center section-label text-[var(--primary)]">
          상품 보기
          <span className="ml-1" aria-hidden>→</span>
        </span>
      </div>
    </Link>
  );
}
