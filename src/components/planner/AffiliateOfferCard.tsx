"use client";

import Image from "next/image";
import { createElement, type MutableRefObject } from "react";
import { ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAffiliateOfferTracking } from "@/components/planner/useAffiliateOfferTracking";
import {
  preparationHubCardShellClassName,
  preparationHubCategoryIcon,
  preparationHubCtaClassName,
  preparationHubEsimBadges,
  preparationHubIconClassName,
} from "@/components/planner/preparationHubPresentation";
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
  /** When set, replaces offer.ctaLabel in the UI only. */
  ctaLabel?: string | null;
  /** Subtle provider attribution (catalog displayName). */
  providerLabel?: string | null;
  /** Compact: bordered card (default) vs plain row for grouped containers. */
  framed?: boolean;
  /** Compact title line clamp. */
  titleClamp?: 2 | 3;
  /** Prefer metadata over description when both exist (e.g. eSIM data line). */
  preferMetaOverDescription?: boolean;
  /** Travel goods can stretch CTA full-width on narrow cards. */
  ctaFullWidth?: boolean;
  impressedTokensRef?: MutableRefObject<Set<string>>;
};

export function AffiliateOfferCard({
  offer,
  sessionId,
  sourceProductId,
  variant = "default",
  eyebrow,
  ctaLabel,
  providerLabel,
  framed = true,
  titleClamp = 2,
  preferMetaOverDescription = false,
  ctaFullWidth = false,
  impressedTokensRef,
}: AffiliateOfferCardProps) {
  const { href, onClick } = useAffiliateOfferTracking({
    offer,
    sessionId,
    sourceProductId,
    impressedTokensRef,
  });
  const esimLine = formatAffiliateEsimMetadataLine(offer.metadata?.esim);
  const esimBadges = preparationHubEsimBadges(offer.metadata?.esim);
  const travelGoods = sanitizeAffiliateTravelGoodsMetadata(offer.metadata?.travelGoods);
  const imageUrl = travelGoods?.imageUrl ?? null;
  const compact = variant === "compact";
  const displayCta = (ctaLabel?.trim() || offer.ctaLabel).trim();
  const showDescription =
    !!offer.description && !(preferMetaOverDescription && (esimLine || esimBadges.length > 0));
  const showCategoryIcon = !imageUrl;

  if (compact) {
    return (
      <div
        className={cn(
          "flex gap-3",
          framed
            ? cn(preparationHubCardShellClassName, "border-l-[3px] border-l-[#087EA4] px-3.5 py-3.5")
            : "border-l-[3px] border-l-transparent bg-transparent py-3.5 motion-safe:transition-colors motion-safe:duration-150 hover:border-l-[#087EA4] hover:bg-[#EAF9FD]/55",
        )}
        data-testid="affiliate-offer-card-compact"
      >
        {imageUrl ? (
          <div
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-muted)] ring-1 ring-[#CBEFF7]"
            data-testid="affiliate-offer-travel-goods-image"
          >
            <Image src={imageUrl} alt="" fill sizes="56px" className="object-cover" />
          </div>
        ) : showCategoryIcon ? (
          <div className={preparationHubIconClassName} aria-hidden={true}>
            {createElement(preparationHubCategoryIcon(offer.category))}
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="type-caption font-semibold text-[#087EA4]">{eyebrow}</p>
          ) : null}
          <p
            className={cn(
              "type-small font-semibold leading-snug text-[var(--foreground)]",
              eyebrow ? "mt-0.5" : null,
              titleClamp === 3 ? "line-clamp-3" : "line-clamp-2",
            )}
          >
            {offer.title}
          </p>
          {esimBadges.length > 0 ? (
            <div
              className="mt-1.5 flex flex-wrap gap-1.5"
              data-testid="affiliate-offer-esim-meta"
            >
              {esimBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex items-center rounded-md bg-[#EAF9FD] px-1.5 py-0.5 type-caption font-medium text-[#087EA4]"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : esimLine ? (
            <p
              className="mt-0.5 type-caption font-medium text-[var(--text-secondary)]"
              data-testid="affiliate-offer-esim-meta"
            >
              {esimLine}
            </p>
          ) : null}
          {showDescription ? (
            <p className="mt-0.5 type-caption text-[var(--text-muted)] line-clamp-2">
              {offer.description}
            </p>
          ) : null}
          {providerLabel ? (
            <p
              className="mt-1 type-caption text-slate-500"
              data-testid="affiliate-offer-provider"
            >
              {providerLabel}
            </p>
          ) : null}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              preparationHubCtaClassName,
              "mt-2.5",
              ctaFullWidth || offer.category === "travel_goods"
                ? "w-full"
                : "w-full min-w-[9.5rem] sm:w-auto",
            )}
            onClick={onClick}
          >
            <span className="truncate">{displayCta}</span>
            <ChevronRight aria-hidden={true} />
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
        {showDescription ? (
          <p className="type-small text-[var(--text-secondary)]">{offer.description}</p>
        ) : null}
        {providerLabel ? (
          <p className="type-caption text-[var(--text-subtle)]" data-testid="affiliate-offer-provider">
            {providerLabel}
          </p>
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-1" })}
          onClick={onClick}
        >
          {displayCta}
        </a>
      </div>
    </Card>
  );
}
