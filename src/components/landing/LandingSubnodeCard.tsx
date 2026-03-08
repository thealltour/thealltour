import Link from "next/link";
import Image from "next/image";
import type { LandingSubnode } from "@/types/landingSubnode";
import { CARD_HOVER, CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";
import { getLandingSubnodeHref } from "@/lib/landingSubnodes";

const FALLBACK_IMAGE =
  "https://picsum.photos/seed/thealltour-subnode/400/260";

export type LandingSubnodeCardProps = {
  node: LandingSubnode;
  href?: string;
  className?: string;
};

/**
 * 상세 랜딩 하위 탐색 카드 1개. 클릭 시 filter_payload 기반 /products?... 로 이동.
 */
export function LandingSubnodeCard({
  node,
  href,
  className,
}: LandingSubnodeCardProps) {
  const linkHref = href ?? getLandingSubnodeHref(node.filter_payload);
  const imageUrl = node.image_url?.trim() || null;

  return (
    <Link
      href={linkHref}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition sm:rounded-3xl",
        CARD_HOVER,
        CARD_TRANSITION,
        className,
      )}
    >
      {imageUrl ? (
        <div className="relative aspect-[16/10] w-full shrink-0 bg-[var(--surface-muted)]">
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-200 group-hover:scale-[1.02]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--overlay)]/50 to-transparent" />
          {node.badge_label ? (
            <span className="absolute left-3 top-3 rounded-full bg-[var(--primary)] px-2.5 py-0.5 type-caption font-medium text-[var(--on-primary)]">
              {node.badge_label}
            </span>
          ) : null}
          <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
            <span className="font-card-title line-clamp-2 text-sm font-semibold text-white drop-shadow-sm sm:text-base">
              {node.title}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          {node.badge_label ? (
            <span className="mb-2 inline-flex w-fit rounded-full bg-[var(--primary-soft)] px-2.5 py-0.5 type-caption font-medium text-[var(--primary)]">
              {node.badge_label}
            </span>
          ) : null}
          <h3 className="font-card-title type-small font-semibold text-[var(--foreground)] sm:type-body">
            {node.title}
          </h3>
          {node.description ? (
            <p className="mt-1 line-clamp-2 type-caption text-[var(--text-muted)]">
              {node.description}
            </p>
          ) : null}
          <span className="mt-3 inline-flex items-center section-label text-[var(--primary)]">
            상품 보기
            <span className="ml-1" aria-hidden>→</span>
          </span>
        </div>
      )}
    </Link>
  );
}
