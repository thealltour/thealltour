"use client";

import type { ComponentType } from "react";
import {
  Car,
  CarFront,
  Hotel,
  Luggage,
  Plane,
  ShieldCheck,
  Wifi,
} from "lucide-react";
import { AffiliateOfferCard } from "@/components/planner/AffiliateOfferCard";
import { formatIsoDateDot } from "@/lib/planner/dates";
import {
  TOSS_TRAVEL_GOODS_SECTION_DESCRIPTION,
  TOSS_TRAVEL_GOODS_SECTION_TITLE,
  tossCategoryForIntent,
} from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingCategories";
import type { TossTravelGoodsIntent } from "@/lib/affiliate/planner/providers/tossShopping/tossShoppingTypes";
import type {
  AffiliateCategory,
  AffiliateOffer,
  PlannerAffiliateOffersDto,
} from "@/lib/affiliate/planner/types";
import { cn } from "@/lib/cn";

/** Global trip booking categories — activity stays in Day contextual slots. */
export const BOOKING_SURFACE_CATEGORIES = [
  "flight",
  "hotel",
  "esim",
  "transfer",
  "rental_car",
  "insurance",
  "travel_goods",
] as const satisfies readonly AffiliateCategory[];

export type BookingSurfaceCategory = (typeof BOOKING_SURFACE_CATEGORIES)[number];

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

const CATEGORY_PRESENTATION: Record<
  BookingSurfaceCategory,
  { label: string; Icon: IconComponent }
> = {
  flight: { label: "항공권", Icon: Plane },
  hotel: { label: "숙소", Icon: Hotel },
  esim: { label: "eSIM", Icon: Wifi },
  transfer: { label: "공항 이동", Icon: CarFront },
  rental_car: { label: "렌터카", Icon: Car },
  insurance: { label: "여행자보험", Icon: ShieldCheck },
  travel_goods: { label: "준비물", Icon: Luggage },
};

export function collectBookingSurfaceOffers(
  offers: PlannerAffiliateOffersDto,
): AffiliateOffer[] {
  const allowed = new Set<AffiliateCategory>([...BOOKING_SURFACE_CATEGORIES]);
  const merged = [...offers.summary, ...offers.preparation].filter((o) =>
    allowed.has(o.category),
  );
  const seen = new Set<string>();
  const unique: AffiliateOffer[] = [];
  for (const offer of merged) {
    if (seen.has(offer.offerId)) continue;
    seen.add(offer.offerId);
    unique.push(offer);
  }
  return unique;
}

function splitBookingOffers(offers: AffiliateOffer[]): {
  serviceOffers: AffiliateOffer[];
  travelGoodsOffers: AffiliateOffer[];
} {
  const serviceOffers: AffiliateOffer[] = [];
  const travelGoodsOffers: AffiliateOffer[] = [];
  for (const offer of offers) {
    if (offer.category === "travel_goods") travelGoodsOffers.push(offer);
    else serviceOffers.push(offer);
  }
  return { serviceOffers, travelGoodsOffers };
}

function travelGoodsEyebrow(offer: AffiliateOffer): string {
  const intent = offer.metadata?.travelGoods?.intent;
  if (intent && isTossIntent(intent)) {
    return tossCategoryForIntent(intent).labelKo;
  }
  return CATEGORY_PRESENTATION.travel_goods.label;
}

function isTossIntent(value: string): value is TossTravelGoodsIntent {
  return (
    value === "power_bank" ||
    value === "waterproof_pouch" ||
    value === "luggage" ||
    value === "travel_adapter" ||
    value === "car_charger"
  );
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

type PlannerBookingSurfaceProps = {
  offers: PlannerAffiliateOffersDto;
  sessionId: string;
  sourceProductId: string | null;
  originText?: string | null;
  destinationName: string;
  startDate: string | null;
  endDate: string | null;
};

export function PlannerBookingSurface({
  offers,
  sessionId,
  sourceProductId,
  originText,
  destinationName,
  startDate,
  endDate,
}: PlannerBookingSurfaceProps) {
  const bookingOffers = collectBookingSurfaceOffers(offers);
  if (bookingOffers.length === 0) return null;

  const { serviceOffers, travelGoodsOffers } = splitBookingOffers(bookingOffers);
  const origin = originText?.trim() || "";
  const dest = destinationName.trim();
  const routeLabel =
    origin && dest ? `${origin} → ${dest}` : dest || origin || null;
  const dateLabel = formatCompactTripDates(startDate, endDate);
  const useScroll = serviceOffers.length >= 3;

  return (
    <section
      className="space-y-2.5"
      data-testid="planner-booking-surface"
      aria-label="여행 준비"
    >
      <div>
        <h2 className="type-body font-semibold text-[var(--foreground)]">여행 준비</h2>
        <p className="mt-0.5 type-caption text-[var(--text-muted)]">
          필요한 예약과 준비를 여기서 확인하세요.
        </p>
      </div>

      {serviceOffers.length > 0 ? (
        <div
          className={cn(
            useScroll
              ? "scrollbar-hide flex gap-3 overflow-x-auto pb-1"
              : "grid grid-cols-1 gap-3 sm:grid-cols-2",
          )}
          data-testid="planner-booking-services"
        >
          {serviceOffers.map((offer) => {
            const presentation = CATEGORY_PRESENTATION[offer.category as BookingSurfaceCategory];
            const Icon = presentation?.Icon;
            const categoryLabel = presentation?.label ?? offer.title;

            return (
              <div
                key={offer.offerId}
                className={cn(useScroll && "w-[min(100%,17.5rem)] shrink-0")}
              >
                <div className="mb-2 flex items-center gap-2 px-0.5">
                  {Icon ? (
                    <Icon
                      className="h-4 w-4 shrink-0 text-[var(--primary)]"
                      aria-hidden={true}
                    />
                  ) : null}
                  <span className="type-caption font-semibold text-[var(--text-secondary)]">
                    {categoryLabel}
                  </span>
                </div>
                {offer.category === "flight" && (routeLabel || dateLabel) ? (
                  <div className="mb-2 space-y-0.5 px-0.5">
                    {routeLabel ? (
                      <p className="type-small font-medium text-[var(--foreground)]">
                        {routeLabel}
                      </p>
                    ) : null}
                    {dateLabel ? (
                      <p className="type-caption text-[var(--text-muted)]">{dateLabel}</p>
                    ) : null}
                    <p className="type-caption text-[var(--text-subtle)]">
                      실제 이용 공항은 선택한 항공편에 따라 달라질 수 있어요.
                    </p>
                  </div>
                ) : null}
                {(offer.category === "hotel" || offer.category === "rental_car") && dateLabel ? (
                  <p className="mb-2 px-0.5 type-caption text-[var(--text-muted)]">{dateLabel}</p>
                ) : null}
                <AffiliateOfferCard
                  offer={offer}
                  sessionId={sessionId}
                  sourceProductId={sourceProductId}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {travelGoodsOffers.length > 0 ? (
        <div className="space-y-2.5 pt-1" data-testid="planner-travel-goods">
          <div>
            <h3 className="type-small font-semibold text-[var(--foreground)]">
              {TOSS_TRAVEL_GOODS_SECTION_TITLE}
            </h3>
            <p className="mt-0.5 type-caption text-[var(--text-muted)]">
              {TOSS_TRAVEL_GOODS_SECTION_DESCRIPTION}
            </p>
          </div>
          <div
            className={cn(
              travelGoodsOffers.length >= 3
                ? "scrollbar-hide flex gap-3 overflow-x-auto pb-1"
                : "grid grid-cols-1 gap-3 sm:grid-cols-2",
            )}
          >
            {travelGoodsOffers.slice(0, 3).map((offer) => (
              <div
                key={offer.offerId}
                className={cn(
                  travelGoodsOffers.length >= 3 && "w-[min(100%,17.5rem)] shrink-0",
                )}
                data-testid="planner-travel-goods-card"
              >
                <div className="mb-2 flex items-center gap-2 px-0.5">
                  <Luggage
                    className="h-4 w-4 shrink-0 text-[var(--primary)]"
                    aria-hidden={true}
                  />
                  <span className="type-caption font-semibold text-[var(--text-secondary)]">
                    {travelGoodsEyebrow(offer)}
                  </span>
                </div>
                <AffiliateOfferCard
                  offer={offer}
                  sessionId={sessionId}
                  sourceProductId={sourceProductId}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {offers.disclosure ? (
        <p className="type-caption text-[var(--text-muted)]">{offers.disclosure}</p>
      ) : null}
    </section>
  );
}
