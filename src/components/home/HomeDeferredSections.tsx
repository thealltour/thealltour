import dynamic from "next/dynamic";
import Link from "next/link";

import { cn } from "@/lib/cn";

import { HomeTrustMicro } from "@/components/home/HomeTrustMicro";
import { HomeCoupangTravelSection } from "@/components/home/HomeCoupangTravelSection";

import type { HomeCuratedSettings, HomeCuratedSectionWithProducts } from "@/types/homeCurated";

import type { Review } from "@/types/review";

import type { ProductCardSource } from "@/lib/products/productListItem";

import type { ProductTaxonomy } from "@/types/productTaxonomy";

import type { RssPost } from "@/lib/rss.types";

import type { HomeGolfCalendarModel } from "@/lib/products/golfDepartureCalendar";



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



const HomeGolfCalendar = dynamic(

  () => import("@/components/home/HomeGolfCalendar").then((m) => ({ default: m.HomeGolfCalendar })),

  { loading: () => <SectionSkeleton className="min-h-[14rem] max-md:min-h-[12rem]" /> },

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



const HomeBlogSection = dynamic(

  () => import("@/components/home/HomeBlogSection").then((m) => ({ default: m.HomeBlogSection })),

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

  products: ProductCardSource[];

  moreHref?: string;

  eyebrow?: string | null;

  title?: string | null;

  description?: string | null;

};



export type HomeDeferredSectionsProps = {

  golfTour: HomeDeferredGolfTourProps;

  golfCalendarModel: HomeGolfCalendarModel | null;

  destinationRail: HomeDeferredRailProps;

  themeRail: HomeDeferredRailProps;

  curatedSettings: HomeCuratedSettings | null;

  curatedSections: HomeCuratedSectionWithProducts[];

  homeBlogPosts: RssPost[];

  homeReviews: Review[];

  tourismRegNo?: string;

};



/**

 * 홈 히어로 아래 본문 블록 — 전환 퍼널 순서:

 * Golf → Responsive Calendar → Trust → Curated → Destination → Theme → Reviews → Blog

 */

export function HomeDeferredSections({

  golfTour,

  golfCalendarModel,

  destinationRail,

  themeRail,

  curatedSettings,

  curatedSections,

  homeBlogPosts,

  homeReviews,

  tourismRegNo,

}: HomeDeferredSectionsProps) {

  return (

    <>

      {golfTour.products.length > 0 || golfCalendarModel ? (
        <section id="home-golf-explore" aria-label="골프여행 찾기" className="scroll-mt-48 space-y-5 md:space-y-8">
          <nav aria-label="골프여행 탐색 방법" className="flex flex-wrap gap-2 px-4 pt-3 md:pt-6">
            {golfTour.products.length > 0 ? <Link href="#home-golf-tours" className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">추천상품으로 찾기</Link> : null}
            {golfCalendarModel ? <Link href="#home-golf-dates" className="inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-semibold text-[var(--primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">출발 날짜로 찾기</Link> : null}
          </nav>
      <GolfTourProductsSection

        products={golfTour.products}

        moreHref={golfTour.moreHref}

        eyebrow={golfTour.eyebrow}

        title={golfTour.title}

        description={golfTour.description}

      />

      {golfCalendarModel ? (

        <div id="home-golf-dates" className="scroll-mt-48">
          <HomeGolfCalendar model={golfCalendarModel} className="-mt-1 max-md:mb-0 md:-mt-2" />
        </div>

      ) : null}

        </section>
      ) : null}

      <HomeTrustMicro tourismRegNo={tourismRegNo} />

      <CuratedProductsSection settings={curatedSettings} sections={curatedSections} />

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

      <HomeCoupangTravelSection />

      <HomeReviewSection reviews={homeReviews} />

      <HomeBlogSection posts={homeBlogPosts} />

    </>

  );

}

