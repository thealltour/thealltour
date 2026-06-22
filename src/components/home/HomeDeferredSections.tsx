import dynamic from "next/dynamic";
import { cn } from "@/lib/cn";
import "react-day-picker/style.css";
import "@/components/ui/datePicker.css";
import type { HomeCuratedSettings, HomeCuratedSectionWithProducts } from "@/types/homeCurated";
import type { Guide } from "@/types/guide";
import type { Review } from "@/types/review";
import type { Product } from "@/types/product";
import type { GolfDepartureEvent } from "@/lib/products/golfDepartureCalendar";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

function SectionSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full min-h-[12rem] animate-pulse rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--border)]/60",
        className,
      )}
      aria-hidden
    />
  );
}

/** ExploreRailSection(헤더+가로 레일) 대략 높이 — CLS 완화용 */
function ExploreRailSkeleton() {
  return (
    <SectionSkeleton className="min-h-[17.5rem] sm:min-h-[18.5rem]" />
  );
}

const GolfTourProductsSection = dynamic(() => import("@/components/home/GolfTourProductsSection"), {
  loading: () => <SectionSkeleton className="min-h-[18rem]" />,
});

const GolfDepartureCalendarSection = dynamic(
  () => import("@/components/home/GolfDepartureCalendarSection"),
  { loading: () => <SectionSkeleton className="min-h-[22rem]" /> },
);

const DestinationSection = dynamic(() => import("@/components/home/DestinationSection"), {
  loading: () => <ExploreRailSkeleton />,
});

const ThemeSection = dynamic(() => import("@/components/home/ThemeSection"), {
  loading: () => <ExploreRailSkeleton />,
});

const CuratedProductsSection = dynamic(() => import("@/components/home/CuratedProductsSection"), {
  loading: () => <SectionSkeleton className="min-h-[18rem]" />,
});

const HomeGuideSection = dynamic(
  () => import("@/components/home/HomeGuideSection").then((m) => ({ default: m.HomeGuideSection })),
  { loading: () => <SectionSkeleton className="min-h-[14rem]" /> },
);

const HomeReviewSection = dynamic(
  () => import("@/components/home/HomeReviewSection").then((m) => ({ default: m.HomeReviewSection })),
  { loading: () => <SectionSkeleton className="min-h-[16rem]" /> },
);

export type HomeDeferredRailProps = {
  items: ProductTaxonomy[];
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
};

export type HomeDeferredGolfTourProps = {
  products: Product[];
  moreHref?: string;
  eyebrow?: string | null;
  title?: string | null;
  description?: string | null;
};

export type HomeDeferredGolfCalendarProps = {
  events: GolfDepartureEvent[];
  promotionLegendLabel?: string | null;
};

export type HomeDeferredSectionsProps = {
  golfTour: HomeDeferredGolfTourProps;
  golfCalendar: HomeDeferredGolfCalendarProps;
  destinationRail: HomeDeferredRailProps;
  themeRail: HomeDeferredRailProps;
  curatedSettings: HomeCuratedSettings | null;
  curatedSections: HomeCuratedSectionWithProducts[];
  homeGuides: Guide[];
  homeReviews: Review[];
};

/**
 * 홈 히어로 아래 본문 블록 — 골프투어·지역·테마 레일 + 추천·가이드·리뷰.
 * 초기 JS 파싱·실행 분산(Speed Index·TBT 완화). SSR 유지, 청크만 지연 로드.
 */
export function HomeDeferredSections({
  golfTour,
  golfCalendar,
  destinationRail,
  themeRail,
  curatedSettings,
  curatedSections,
  homeGuides,
  homeReviews,
}: HomeDeferredSectionsProps) {
  return (
    <>
      <GolfTourProductsSection
        products={golfTour.products}
        moreHref={golfTour.moreHref}
        eyebrow={golfTour.eyebrow}
        title={golfTour.title}
        description={golfTour.description}
      />
      <GolfDepartureCalendarSection
        events={golfCalendar.events}
        promotionLegendLabel={golfCalendar.promotionLegendLabel}
      />
      <DestinationSection
        items={destinationRail.items}
        eyebrow={destinationRail.eyebrow}
        title={destinationRail.title}
        description={destinationRail.description}
      />
      <ThemeSection
        items={themeRail.items}
        eyebrow={themeRail.eyebrow}
        title={themeRail.title}
        description={themeRail.description}
      />
      <CuratedProductsSection settings={curatedSettings} sections={curatedSections} />
      <HomeGuideSection guides={homeGuides} />
      <HomeReviewSection reviews={homeReviews} />
    </>
  );
}
