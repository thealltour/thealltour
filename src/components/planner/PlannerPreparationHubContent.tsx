"use client";

import type { MutableRefObject } from "react";
import {
  Car,
  CarFront,
  Hotel,
  Luggage,
  Plane,
  ShieldCheck,
  Ticket,
  Wifi,
} from "lucide-react";
import { AffiliateOfferCard } from "@/components/planner/AffiliateOfferCard";
import { PlannerActivityDiscovery } from "@/components/planner/PlannerActivityDiscovery";
import { AFFILIATE_DISCLOSURE_KO } from "@/lib/affiliate/planner/copy";
import {
  groupPreparationHubOffers,
  type PreparationHubGroups,
} from "@/lib/affiliate/planner/preparationHub";
import { tossCategoryForIntent } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingCategories";
import type { TossTravelGoodsIntent } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import type {
  AffiliateCategory,
  AffiliateOffer,
  PlannerAffiliateOffersDto,
} from "@/lib/affiliate/planner/types";
import { formatIsoDateDot } from "@/lib/planner/dates";
import type { ComponentType } from "react";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const CATEGORY_ICON: Partial<Record<AffiliateCategory, { label: string; Icon: IconComponent }>> = {
  flight: { label: "항공권", Icon: Plane },
  hotel: { label: "숙소", Icon: Hotel },
  esim: { label: "eSIM", Icon: Wifi },
  transfer: { label: "공항 이동", Icon: CarFront },
  rental_car: { label: "렌터카", Icon: Car },
  insurance: { label: "여행자보험", Icon: ShieldCheck },
  travel_goods: { label: "준비물", Icon: Luggage },
  activity: { label: "티켓·액티비티", Icon: Ticket },
};

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
  return "준비물";
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

function OfferList(params: {
  offers: AffiliateOffer[];
  sessionId: string;
  sourceProductId: string | null;
  impressedTokensRef: MutableRefObject<Set<string>>;
  eyebrowFor?: (offer: AffiliateOffer) => string;
  showTripDates?: boolean;
  dateLabel: string | null;
  routeLabel: string | null;
}) {
  return (
    <ul className="space-y-2.5">
      {params.offers.map((offer) => {
        const presentation = CATEGORY_ICON[offer.category];
        const eyebrow =
          params.eyebrowFor?.(offer) ?? presentation?.label ?? null;
        return (
          <li key={offer.offerId}>
            {offer.category === "flight" && (params.routeLabel || params.dateLabel) ? (
              <div className="mb-1.5 space-y-0.5 px-0.5">
                {params.routeLabel ? (
                  <p className="type-caption font-medium text-[var(--foreground)]">
                    {params.routeLabel}
                  </p>
                ) : null}
                {params.dateLabel ? (
                  <p className="type-caption text-[var(--text-muted)]">{params.dateLabel}</p>
                ) : null}
              </div>
            ) : null}
            {(offer.category === "hotel" || offer.category === "rental_car") &&
            params.showTripDates &&
            params.dateLabel ? (
              <p className="mb-1.5 px-0.5 type-caption text-[var(--text-muted)]">
                {params.dateLabel}
              </p>
            ) : null}
            <AffiliateOfferCard
              offer={offer}
              sessionId={params.sessionId}
              sourceProductId={params.sourceProductId}
              variant="compact"
              eyebrow={eyebrow}
              impressedTokensRef={params.impressedTokensRef}
            />
          </li>
        );
      })}
    </ul>
  );
}

function Section(params: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5" data-testid={params.id} aria-labelledby={`${params.id}-title`}>
      <div>
        <h3
          id={`${params.id}-title`}
          className="type-small font-semibold text-[var(--foreground)]"
        >
          {params.title}
        </h3>
        {params.description ? (
          <p className="mt-0.5 type-caption text-[var(--text-muted)]">{params.description}</p>
        ) : null}
      </div>
      {params.children}
    </section>
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
          description="항공과 숙소를 확인해 보세요."
        >
          <OfferList
            offers={groups.booking}
            sessionId={sessionId}
            sourceProductId={sourceProductId}
            impressedTokensRef={impressedTokensRef}
            showTripDates
            dateLabel={dateLabel}
            routeLabel={routeLabel}
          />
        </Section>
      ) : null}

      {showActivities ? (
        <Section
          id="planner-hub-activities"
          title="티켓 · 액티비티"
          description="일정에 맞는 입장권과 체험을 확인해 보세요."
        >
          {groups.activities.length > 0 ? (
            <OfferList
              offers={groups.activities}
              sessionId={sessionId}
              sourceProductId={sourceProductId}
              impressedTokensRef={impressedTokensRef}
              eyebrowFor={() => "티켓·액티비티"}
              dateLabel={null}
              routeLabel={null}
            />
          ) : null}
          {mountDiscovery && hasDiscovery ? (
            <div className="pt-1">
              <PlannerActivityDiscovery discovery={offers.activityDiscovery} />
            </div>
          ) : null}
        </Section>
      ) : null}

      {groups.local.length > 0 ? (
        <Section
          id="planner-hub-local"
          title="현지 준비"
          description="현지에서 쓰면 좋은 서비스를 모아 두었어요."
        >
          <OfferList
            offers={groups.local}
            sessionId={sessionId}
            sourceProductId={sourceProductId}
            impressedTokensRef={impressedTokensRef}
            showTripDates
            dateLabel={dateLabel}
            routeLabel={null}
          />
        </Section>
      ) : null}

      {groups.travelGoods.length > 0 ? (
        <Section
          id="planner-hub-goods"
          title="여행 준비물"
          description="여행 전에 챙겨두면 좋은 준비물을 확인해 보세요."
        >
          <OfferList
            offers={groups.travelGoods}
            sessionId={sessionId}
            sourceProductId={sourceProductId}
            impressedTokensRef={impressedTokensRef}
            eyebrowFor={travelGoodsEyebrow}
            dateLabel={null}
            routeLabel={null}
          />
        </Section>
      ) : null}

      {showDisclosure ? (
        <p
          className="type-caption text-[var(--text-muted)]"
          data-testid="planner-preparation-hub-disclosure"
        >
          {offers.disclosure ?? AFFILIATE_DISCLOSURE_KO}
        </p>
      ) : null}
    </div>
  );
}
