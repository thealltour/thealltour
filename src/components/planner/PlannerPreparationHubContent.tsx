"use client";

import type { MutableRefObject } from "react";
import {
  Briefcase,
  Luggage,
  MapPinned,
  Ticket,
} from "lucide-react";
import { AffiliateOfferCard } from "@/components/planner/AffiliateOfferCard";
import { PlannerActivityDiscovery } from "@/components/planner/PlannerActivityDiscovery";
import {
  preparationHubActivityBlurb,
  preparationHubBookingBlurb,
  preparationHubCategoryLabel,
  preparationHubCtaLabel,
  preparationHubProviderLabel,
  preparationHubAccentBarClassName,
  preparationHubIconClassName,
} from "@/components/planner/preparationHubPresentation";
import { AFFILIATE_DISCLOSURE_KO } from "@/lib/affiliate/planner/copy";
import {
  groupPreparationHubOffers,
  type PreparationHubGroups,
} from "@/lib/affiliate/planner/preparationHub";
import { tossCategoryForIntent } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingCategories";
import type { TossTravelGoodsIntent } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import type {
  AffiliateOffer,
  PlannerAffiliateOffersDto,
} from "@/lib/affiliate/planner/types";
import { formatIsoDateDot } from "@/lib/planner/dates";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

function isTossIntent(value: string): value is TossTravelGoodsIntent {
  return (
    value === "power_bank" ||
    value === "waterproof_pouch" ||
    value === "luggage" ||
    value === "travel_adapter" ||
    value === "car_charger"
  );
}

function travelGoodsEyebrow(offer: AffiliateOffer): string {
  const intent = offer.metadata?.travelGoods?.intent;
  if (intent && isTossIntent(intent)) return tossCategoryForIntent(intent).labelKo;
  return preparationHubCategoryLabel("travel_goods");
}

function formatCompactTripDates(startDate: string | null, endDate: string | null): string | null {
  const start = formatIsoDateDot(startDate);
  const end = formatIsoDateDot(endDate);
  if (!start && !end) return null;
  if (start && end) {
    const short = (ymd: string) => {
      const parts = ymd.split(".");
      return parts.length === 3 ? `${parts[1]}.${parts[2]}` : ymd;
    };
    return `${short(start)} → ${short(end)}`;
  }
  return start || end;
}

function HubOfferRow(params: {
  offer: AffiliateOffer;
  sessionId: string;
  sourceProductId: string | null;
  impressedTokensRef: MutableRefObject<Set<string>>;
  eyebrow?: string | null;
  framed?: boolean;
  title?: string | null;
  description?: string | null;
  preferMetaOverDescription?: boolean;
  titleClamp?: 2 | 3;
}) {
  const presentationOffer: AffiliateOffer = {
    ...params.offer,
    title: params.title?.trim() || params.offer.title,
    description:
      params.description === undefined ? params.offer.description : params.description,
  };

  return (
    <AffiliateOfferCard
      offer={presentationOffer}
      sessionId={params.sessionId}
      sourceProductId={params.sourceProductId}
      variant="compact"
      framed={params.framed ?? true}
      eyebrow={params.eyebrow}
      ctaLabel={preparationHubCtaLabel(params.offer.category)}
      providerLabel={preparationHubProviderLabel(params.offer.providerId)}
      preferMetaOverDescription={params.preferMetaOverDescription}
      titleClamp={params.titleClamp ?? 2}
      ctaFullWidth={params.offer.category === "travel_goods"}
      impressedTokensRef={params.impressedTokensRef}
    />
  );
}

function OfferStack(params: {
  offers: AffiliateOffer[];
  sessionId: string;
  sourceProductId: string | null;
  impressedTokensRef: MutableRefObject<Set<string>>;
  eyebrowFor?: (offer: AffiliateOffer) => string | null;
  grouped?: boolean;
  titleFor?: (offer: AffiliateOffer) => string | null;
  descriptionFor?: (offer: AffiliateOffer) => string | null;
  preferMetaOverDescription?: boolean;
  titleClamp?: 2 | 3;
}) {
  if (params.offers.length === 0) return null;

  if (params.grouped) {
    return (
      <ul
        className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)] shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        data-testid="planner-hub-offer-group"
      >
        {params.offers.map((offer) => (
          <li key={offer.offerId} className="px-3.5">
            <HubOfferRow
              offer={offer}
              sessionId={params.sessionId}
              sourceProductId={params.sourceProductId}
              impressedTokensRef={params.impressedTokensRef}
              eyebrow={params.eyebrowFor?.(offer)}
              framed={false}
              title={params.titleFor?.(offer)}
              description={params.descriptionFor?.(offer)}
              preferMetaOverDescription={params.preferMetaOverDescription}
              titleClamp={params.titleClamp}
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="space-y-2.5">
      {params.offers.map((offer) => (
        <li key={offer.offerId}>
          <HubOfferRow
            offer={offer}
            sessionId={params.sessionId}
            sourceProductId={params.sourceProductId}
            impressedTokensRef={params.impressedTokensRef}
            eyebrow={params.eyebrowFor?.(offer)}
            title={params.titleFor?.(offer)}
            description={params.descriptionFor?.(offer)}
            preferMetaOverDescription={params.preferMetaOverDescription}
            titleClamp={params.titleClamp}
          />
        </li>
      ))}
    </ul>
  );
}

function Section(params: {
  id: string;
  title: string;
  description?: string;
  context?: React.ReactNode;
  Icon: LucideIcon;
  children: React.ReactNode;
}) {
  const Icon = params.Icon;
  return (
    <section className="space-y-3" data-testid={params.id} aria-labelledby={`${params.id}-title`}>
      <div>
        <div className="flex items-center gap-2.5">
          <div className={cn(preparationHubIconClassName, "h-8 w-8")} aria-hidden={true}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <h3
              id={`${params.id}-title`}
              className="type-small font-semibold text-[var(--foreground)]"
            >
              {params.title}
            </h3>
            <div className={cn(preparationHubAccentBarClassName, "mt-1")} aria-hidden={true} />
          </div>
        </div>
        {params.description ? (
          <p className="mt-2 type-caption text-[var(--text-muted)]">{params.description}</p>
        ) : null}
        {params.context ? <div className="mt-2">{params.context}</div> : null}
      </div>
      {params.children}
    </section>
  );
}

function TripContext(params: { routeLabel: string | null; dateLabel: string | null }) {
  if (!params.routeLabel && !params.dateLabel) return null;
  return (
    <div
      className="min-w-0 space-y-0.5 break-words rounded-lg bg-[#EAF9FD]/70 px-2.5 py-2"
      data-testid="planner-hub-trip-context"
    >
      {params.routeLabel && params.dateLabel ? (
        <>
          <p className="hidden type-caption font-medium text-[var(--foreground)] sm:block">
            <span className="break-words">{params.routeLabel}</span>
            <span className="text-[var(--text-muted)]"> · </span>
            <span className="text-[var(--text-muted)]">{params.dateLabel}</span>
          </p>
          <div className="sm:hidden">
            <p className="type-caption font-medium break-words text-[var(--foreground)]">
              {params.routeLabel}
            </p>
            <p className="type-caption text-[var(--text-muted)]">{params.dateLabel}</p>
          </div>
        </>
      ) : (
        <>
          {params.routeLabel ? (
            <p className="type-caption font-medium break-words text-[var(--foreground)]">
              {params.routeLabel}
            </p>
          ) : null}
          {params.dateLabel ? (
            <p className="type-caption text-[var(--text-muted)]">{params.dateLabel}</p>
          ) : null}
        </>
      )}
    </div>
  );
}

export type PlannerPreparationHubContentProps = {
  offers: PlannerAffiliateOffersDto;
  sessionId: string;
  sourceProductId: string | null;
  originText?: string | null;
  destinationName: string;
  startDate: string | null;
  endDate: string | null;
  impressedTokensRef: MutableRefObject<Set<string>>;
  /** Mount discovery widgets only when Hub is open (parent gates render of this whole content). */
  mountDiscovery: boolean;
};

export function PlannerPreparationHubContent({
  offers,
  sessionId,
  sourceProductId,
  originText,
  destinationName,
  startDate,
  endDate,
  impressedTokensRef,
  mountDiscovery,
}: PlannerPreparationHubContentProps) {
  const groups: PreparationHubGroups = groupPreparationHubOffers(offers);
  const origin = originText?.trim() || "";
  const dest = destinationName.trim();
  const routeLabel =
    origin && dest ? `${origin} → ${dest}` : dest || origin || null;
  const dateLabel = formatCompactTripDates(startDate, endDate);
  const hasDiscovery =
    offers.activityDiscovery?.tiqets != null || offers.activityDiscovery?.klook != null;
  const showActivities = groups.activities.length > 0 || hasDiscovery;
  const showDisclosure =
    groups.booking.length > 0 ||
    groups.local.length > 0 ||
    groups.travelGoods.length > 0 ||
    showActivities;

  return (
    <div className="space-y-6" data-testid="planner-preparation-hub-content">
      {groups.booking.length > 0 ? (
        <Section
          id="planner-hub-booking"
          title="예약"
          Icon={Briefcase}
          context={<TripContext routeLabel={routeLabel} dateLabel={dateLabel} />}
        >
          <OfferStack
            offers={groups.booking}
            sessionId={sessionId}
            sourceProductId={sourceProductId}
            impressedTokensRef={impressedTokensRef}
            grouped
            titleFor={(offer) => preparationHubCategoryLabel(offer.category)}
            descriptionFor={(offer) =>
              offer.category === "flight" || offer.category === "hotel"
                ? preparationHubBookingBlurb(offer.category, dest)
                : offer.description
            }
          />
        </Section>
      ) : null}

      {showActivities ? (
        <Section
          id="planner-hub-activities"
          title="티켓 · 액티비티"
          Icon={Ticket}
          description={preparationHubActivityBlurb(dest)}
        >
          {groups.activities.length > 0 ? (
            <OfferStack
              offers={groups.activities}
              sessionId={sessionId}
              sourceProductId={sourceProductId}
              impressedTokensRef={impressedTokensRef}
              grouped
              eyebrowFor={() => preparationHubCategoryLabel("activity")}
            />
          ) : null}
          {mountDiscovery && hasDiscovery ? (
            <div className={groups.activities.length > 0 ? "pt-1" : undefined}>
              <PlannerActivityDiscovery
                discovery={offers.activityDiscovery}
                variant="hub"
                destinationName={dest}
              />
            </div>
          ) : null}
        </Section>
      ) : null}

      {groups.local.length > 0 ? (
        <Section
          id="planner-hub-local"
          title="현지 준비"
          Icon={MapPinned}
          description="현지에서 쓰면 좋은 서비스를 모아 두었어요."
        >
          <OfferStack
            offers={groups.local}
            sessionId={sessionId}
            sourceProductId={sourceProductId}
            impressedTokensRef={impressedTokensRef}
            grouped
            eyebrowFor={(offer) => preparationHubCategoryLabel(offer.category)}
            preferMetaOverDescription
          />
        </Section>
      ) : null}

      {groups.travelGoods.length > 0 ? (
        <Section
          id="planner-hub-goods"
          title="여행 준비물"
          Icon={Luggage}
          description="여행 전에 챙겨두면 좋은 준비물을 확인해 보세요."
        >
          <OfferStack
            offers={groups.travelGoods}
            sessionId={sessionId}
            sourceProductId={sourceProductId}
            impressedTokensRef={impressedTokensRef}
            grouped
            eyebrowFor={travelGoodsEyebrow}
            titleClamp={3}
          />
        </Section>
      ) : null}

      {showDisclosure ? (
        <p
          className="text-[11px] leading-relaxed text-slate-400"
          data-testid="planner-preparation-hub-disclosure"
        >
          {offers.disclosure ?? AFFILIATE_DISCLOSURE_KO}
        </p>
      ) : null}
    </div>
  );
}
