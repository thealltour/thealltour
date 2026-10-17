"use client";

import Image from "next/image";
import type { MutableRefObject } from "react";
import { buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAffiliateOfferTracking } from "@/components/planner/useAffiliateOfferTracking";
import {
  formatAffiliateEsimMetadataLine,
  sanitizeAffiliateTravelGoodsMetadata,
} from "@/lib/affiliate/planner/offerMetadata";
import type { AffiliateOffer } from "@/lib/affiliate/planner/types";
import { cn } from "@/lib/cn";

type AffiliateOfferCardProps = {
  offer: AffiliateOffer;
  sessionId: string;
  sourceProductId?: string | null;
  /** Hub denser layout; omits per-card "제휴 링크" (Hub disclosure covers it). */
  variant?: "default" | "compact";
  /** Optional eyebrow above the title (e.g. category label). */
  eyebrow?: string | null;
  impressedTokensRef?: MutableRefObject<Set<string>>;
};

export function AffiliateOfferCard({
  offer,
  sessionId,
  sourceProductId,
  variant = "default",
  eyebrow,
  impressedTokensRef,
}: AffiliateOfferCardProps) {
  const { href, onClick } = useAffiliateOfferTracking({
    offer,
    sessionId,
    sourceProductId,
    impressedTokensRef,
  });
  const esimLine = formatAffiliateEsimMetadataLine(offer.metadata?.esim);
  const travelGoods = sanitizeAffiliateTravelGoodsMetadata(offer.metadata?.travelGoods);
  const imageUrl = travelGoods?.imageUrl ?? null;
  const compact = variant === "compact";

  if (compact) {
    return (
      <div
        className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
        data-testid="affiliate-offer-card-compact"
      >
        {imageUrl ? (
          <div
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-[var(--surface-muted)]"
            data-testid="affiliate-offer-travel-goods-image"
          >
            <Image src={imageUrl} alt="" fill sizes="56px" className="object-cover" />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-1.5">
          {eyebrow ? (
            <p className="type-caption font-semibold text-[var(--text-secondary)]">{eyebrow}</p>
          ) : null}
          <p className="type-small font-semibold leading-snug text-[var(--foreground)] line-clamp-2">
            {offer.title}
          </p>
          {esimLine ? (
            <p
              className="type-caption font-medium text-[var(--text-secondary)]"
              data-testid="affiliate-offer-esim-meta"
            >
              {esimLine}
            </p>
          ) : null}
          {offer.description ? (
            <p className="type-caption text-[var(--text-muted)] line-clamp-1">{offer.description}</p>
          ) : null}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({
              variant: "secondary",
              size: "sm",
              className: "mt-0.5 inline-flex",
            })}
            onClick={onClick}
          >
            {offer.ctaLabel}
          </a>
        </div>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-2">
        {imageUrl ? (
          <div
            className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-[var(--surface-muted)]"
            data-testid="affiliate-offer-travel-goods-image"
          >
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 280px"
              className="object-cover"
            />
          </div>
        ) : null}
        <p className="type-caption text-[var(--text-muted)]">제휴 링크</p>
        {eyebrow ? (
          <p className="type-caption font-semibold text-[var(--text-secondary)]">{eyebrow}</p>
        ) : null}
        <p className={cn("type-body font-semibold text-[var(--foreground)]")}>{offer.title}</p>
        {esimLine ? (
          <p
            className="type-caption font-medium text-[var(--text-secondary)]"
            data-testid="affiliate-offer-esim-meta"
          >
            {esimLine}
          </p>
        ) : null}
        {offer.description ? (
          <p className="type-small text-[var(--text-secondary)]">{offer.description}</p>
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-1" })}
          onClick={onClick}
        >
          {offer.ctaLabel}
        </a>
      </div>
    </Card>
  );
}
