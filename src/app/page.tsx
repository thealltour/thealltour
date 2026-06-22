import { ShieldCheck, Users, Route, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { buildOgMetadataFromSeoData } from "@/lib/seo/buildOgPageMetadata";
import { getHomeOgPageSeo } from "@/lib/seo/getHomeOgPageSeo";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { getHomeCuratedData } from "@/lib/homeCurated";
import { getHomeBanners } from "@/lib/homeBanners";
import { getHeroContent, resolveHeroContent } from "@/lib/heroContent";
import { getHubDestinations, getHubThemes } from "@/lib/productTaxonomies";
import { getSiteSettings, parseHomeRegionCardIds, parseHomeThemeCardIds } from "@/lib/siteSettings";
import { getHomeGolfTourProducts, resolveHomeGolfTourMoreHref } from "@/lib/homeGolfTourProducts";
import { getGolfDepartureCalendarData } from "@/lib/products/getGolfDepartureCalendarProducts";
import { getHomeGuidesWithTaxonomyNames } from "@/lib/guides";
import { getTopRatedPublishedReviews } from "@/lib/reviews";
import HeroQuickConsultButton from "@/components/inquiry/HeroQuickConsultButton";
import HeroSection from "@/components/home/HeroSection";
import { HomeDeferredSections } from "@/components/home/HomeDeferredSections";

const TRUST_H3 =
  "\uc548\uc2ec\ud558\uace0\u0020\ub9e1\uae38\u0020\uc218\u0020\uc788\ub294\u0020\uc5ec\ud589\u0020\ud30c\ud2b8\ub108";
const TRUST_LEAD =
  "\ub300\ud615\u0020\uc5ec\ud589\uc0ac\uc640\uc758\u0020\uacf5\uc2dd\u0020\uc81c\ud734\uc640\u0020\uac80\uc99d\ub41c\u0020\uc77c\uc815\u0020\uc6b4\uc601\u0020\uacbd\ud5d8\uc744\u0020\ubc14\ud0d5\uc73c\ub85c\u002c\u0020\uc548\uc815\uc801\uc778\u0020\uc608\uc57d\uacfc\u0020\uc6b4\uc601\uc744\u0020\uc57d\uc18d\ub4dc\ub9bd\ub2c8\ub2e4\u002e";

const T1 = "\ub300\ud615\u0020\uc5ec\ud589\uc0ac\u0020\uacf5\uc2dd\u0020\uc81c\ud734";
const T1B =
  "\uad6d\ub0b4\u0020\uc8fc\uc694\u0020\ud30c\ud2b8\ub108\uc640\u0020\ud611\ub825\ud558\uc5ec\u002c\u0020\uac80\uc99d\ub41c\u0020\uc0c1\ud488\uacfc\u0020\uc548\uc815\uc801\uc778\u0020\uc608\uc57d\u0020\uc2dc\uc2a4\ud15c\uc744\u0020\uae30\ubc18\uc73c\ub85c\u0020\uc6b4\uc601\ud569\ub2c8\ub2e4\u002e";
const T2 = "\uc804\ubb38\u0020\uc0c1\ub2f4\uc0ac\u0020\u0031\u003a\u0031\u0020\ubc30\uc815";
const T2B =
  "\uc5f0\ub839\ub300\u00b7\ub3d9\ud589\u0020\uad6c\uc131\u00b7\uc608\uc0b0\uc744\u0020\uc774\ud574\ud558\ub294\u0020\ub2f4\ub2f9\uc790\uac00\u0020\ucc98\uc74c\u0020\uc0c1\ub2f4\ubd80\ud130\u0020\uadc0\uad6d\uae4c\uc9c0\u0020\ucc45\uc784\uc9c0\uace0\u0020\ud568\uaed8\ud558\uba70\u002c\u0020\ud544\uc694\ud55c\u0020\ub0b4\uc6a9\uc744\u0020\ucc28\ubd84\ud558\uac8c\u0020\uc124\uba85\ud574\u0020\ub4dc\ub9bd\ub2c8\ub2e4\u002e";
const T3 = "\ub2e8\uccb4\u00b7\ub3d9\ud638\ud68c\u0020\ub9de\ucda4\u0020\uc124\uacc4";
const T3B =
  "\ud68c\uc0ac\u00b7\ub3d9\ud638\ud68c\u00b7\uac00\uc871\u0020\ubaa8\uc784\u0020\ub4f1\u0020\uc778\uc6d0\uacfc\u0020\ubaa9\uc801\uc5d0\u0020\ub9de\ucd98\u0020\uc77c\uc815\uc73c\ub85c\u0020\uc774\ub3d9\u0020\ub3d9\uc120\uacfc\u0020\uc77c\uc815\u0020\ud53c\ub85c\ub3c4\ub97c\u0020\ucd5c\uc18c\ud654\ud55c\u0020\ucf54\uc2a4\ub97c\u0020\uc81c\uc548\ud569\ub2c8\ub2e4\u002e";
const T4 = "\uc548\uc804\u0020\uae30\uc900\uc744\u0020\ud1b5\uacfc\ud55c\u0020\uc77c\uc815";
const T4B =
  "\ud604\uc9c0\u0020\uac00\uc774\ub4dc\u00b7\ucc28\ub7c9\u00b7\uc219\uc18c\uae4c\uc9c0\u0020\uc0ac\uc804\u0020\uc810\uac80\ub41c\u0020\uc77c\uc815\ub9cc\u0020\uc6b4\uc601\ud558\uba70\u002c\u0020\ub3cc\ubc1c\u0020\uc0c1\ud669\uc5d0\ub3c4\u0020\ub300\uc751\u0020\uac00\ub2a5\ud55c\u0020\uc548\uc804\u0020\ud504\ub85c\uc138\uc2a4\ub97c\u0020\uac16\ucd94\uace0\u0020\uc788\uc2b5\ub2c8\ub2e4\u002e";

const C_H3 =
  "\ud504\ub9ac\ubbf8\uc5c4\u0020\ub9de\ucda4\u0020\uc0c1\ub2f4\uc73c\ub85c\u0020\uc5ec\uc815\uc744\u0020\uc124\uacc4\ud569\ub2c8\ub2e4";
const C_P1 =
  "\uac04\ub2e8\ud55c\u0020\ub0b4\uc6a9\uc744\u0020\ub0a8\uaca8\uc8fc\uc2dc\uba74\u0020\uc804\ub2f4\u0020\uc0c1\ub2f4\uc0ac\uac00\u0020\uc804\ud654\ub85c\u0020\uba3c\uc800\u0020\uc5f0\ub77d\ub4dc\ub824\u002c\u0020\uc77c\uc815\uacfc\u0020\uc608\uc0b0\uc744\u0020\ud568\uaed8\u0020\uc815\ub9ac\ud574\u0020\ub4dc\ub9bd\ub2c8\ub2e4\u002e";
const C_B1 =
  "\u00b7\u0020\ud1b5\ud654\uac00\u0020\ud3b8\ud558\uc2e0\u0020\uc2dc\uac04\ub300\ub97c\u0020\uba54\ubaa8\ub85c\u0020\ub0a8\uaca8\uc8fc\uc2dc\uba74\u0020\ucd5c\ub300\ud55c\u0020\ub9de\ucdb0\u0020\uc5f0\ub77d\ub4dc\ub9bd\ub2c8\ub2e4\u002e";
const C_B2 =
  "\u00b7\u0020\uc0c1\ub2f4\u0020\uc774\ud6c4\uc5d0\ub3c4\u0020\uc77c\uc815\u0020\uc870\uc815\u00b7\ucd94\uac00\u0020\ubb38\uc758\ub97c\u0020\uc5b8\uc81c\ub4e0\uc9c0\u0020\ud3b8\ud558\uac8c\u0020\uc694\uccad\ud558\uc2e4\u0020\uc218\u0020\uc788\uc2b5\ub2c8\ub2e4\u002e";
const C_B3 =
  "\u00b7\u0020\uc804\ud654\u0020\uc5f0\uacb0\uc774\u0020\uc5b4\ub824\uc6b4\u0020\uacbd\uc6b0\u002c\u0020\ubb38\uc790\u002f\uba54\uc2e0\uc800\ub85c\ub3c4\u0020\ucc28\ubd84\ud788\u0020\uc548\ub0b4\ud574\u0020\ub4dc\ub9bd\ub2c8\ub2e4\u002e";
const C_H4 =
  "\u0033\u0030\ucd08\u0020\uc791\uc131\u0020\ub9cc\uc73c\ub85c\u0020\ud504\ub9ac\ubbf8\uc5c4\u0020\uc0c1\ub2f4\u0020\uc694\uccad\uc774\u0020\uac00\ub2a5\ud569\ub2c8\ub2e4\u002e";
const C_P2 =
  "\uc131\ud568\uacfc\u0020\uc5f0\ub77d\ucc98\u002c\u0020\uadf8\ub9ac\uace0\u0020\ub300\ub7b5\uc801\uc778\u0020\ud76c\ub9dd\uc0ac\ud56d\uc744\u0020\ub0a8\uaca8\uc8fc\uc138\uc694\u002e";
const C_P3 =
  "\uc694\uccad\ud558\uc2e0\u0020\ubd80\ubd84\uc744\u0020\ucd5c\ub300\ud55c\u0020\ubc18\uc601\ud558\uc5ec\u0020\ucf54\uc2a4\ub97c\u0020\uc120\ubcc4\ud574\ub4dc\ub9bd\ub2c8\ub2e4\u002e";

export const metadata: Metadata = buildOgMetadataFromSeoData(getHomeOgPageSeo());

export default async function Home() {
  const [homeCurated, topBanners, heroContent, settings, destinations, themes, golfTourProducts, golfCalendarData, homeGuides, homeReviews] =
    await Promise.all([
      getHomeCuratedData(),
      getHomeBanners(),
      getHeroContent(),
      getSiteSettings(),
      getHubDestinations(),
      getHubThemes(),
      getHomeGolfTourProducts(),
      getGolfDepartureCalendarData(),
      getHomeGuidesWithTaxonomyNames(4),
      getTopRatedPublishedReviews(4),
    ]);

  const golfTourMoreHref = await resolveHomeGolfTourMoreHref(golfTourProducts);

  const curatedSettings = homeCurated.settings;
  const curatedSections = homeCurated.sections;
  const hero = resolveHeroContent(heroContent);

  const homeRegionCardIds = parseHomeRegionCardIds(settings);
  const destinationsForHome =
    homeRegionCardIds.length > 0
      ? homeRegionCardIds
          .map((id) => destinations.find((d) => d.id === id))
          .filter((d): d is NonNullable<typeof d> => Boolean(d))
          .slice(0, 8)
      : destinations.slice(0, 8);

  const homeThemeCardIds = parseHomeThemeCardIds(settings);
  const themesForHome =
    homeThemeCardIds.length > 0
      ? homeThemeCardIds
          .map((id) => themes.find((t) => t.id === id))
          .filter((t): t is NonNullable<typeof t> => Boolean(t))
          .slice(0, 8)
      : themes.slice(0, 8);

  return (
    <>
      <SiteHeader />

      <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
        <main className="flex w-full min-w-0 max-w-full flex-col pb-6 sm:pb-10 md:pb-14">
          <HeroSection heroBanners={topBanners} hero={hero} />

          <PageContainer
            size="wide"
            className="flex flex-col max-md:gap-10 max-md:pt-8 md:gap-20 md:pt-0"
          >
            <HomeDeferredSections
              golfTour={{
                products: golfTourProducts,
                moreHref: golfTourMoreHref,
                eyebrow: settings.home_golf_tour_section_eyebrow,
                title: settings.home_golf_tour_section_title,
                description: settings.home_golf_tour_section_description,
              }}
              golfCalendar={{
                events: golfCalendarData.events,
                promotionLegendLabel: golfCalendarData.promotionLegendLabel,
              }}
              destinationRail={{
                items: destinationsForHome,
                eyebrow: settings.home_region_section_eyebrow,
                title: settings.home_region_section_title,
                description: settings.home_region_section_description,
              }}
              themeRail={{
                items: themesForHome,
                eyebrow: settings.home_theme_section_eyebrow,
                title: settings.home_theme_section_title,
                description: settings.home_theme_section_description,
              }}
              curatedSettings={curatedSettings}
              curatedSections={curatedSections}
              homeGuides={homeGuides}
              homeReviews={homeReviews}
            />

            <SectionBlock
              surface="none"
              padding="md"
              className="!px-4 !py-3 sm:!p-6 md:!p-8"
            >
              <div className="mb-6 space-y-3 text-center sm:mb-8">
                <h3 className="heading-display section-title type-h3 md:text-[1.75rem] text-[var(--foreground)]">
                  {TRUST_H3}
                </h3>
                <p className="mx-auto max-w-2xl type-small text-[var(--text-muted)]">{TRUST_LEAD}</p>
              </div>
              <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-7 lg:grid-cols-4">
                <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                      <ShieldCheck className="h-5 w-5 text-[var(--primary)]" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--foreground)] type-small">{T1}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">{T1B}</p>
                </div>
                <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                      <Users className="h-5 w-5 text-[var(--primary)]" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--foreground)] type-small">{T2}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">{T2B}</p>
                </div>
                <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                      <Route className="h-5 w-5 text-[var(--primary)]" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--foreground)] type-small">{T3}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">{T3B}</p>
                </div>
                <div className="flex h-full flex-col rounded-none bg-transparent p-0 shadow-none ring-0 sm:rounded-2xl sm:bg-[var(--surface)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] text-[var(--foreground)]">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] ring-1 ring-[var(--border)]">
                      <CheckCircle2 className="h-5 w-5 text-[var(--primary)]" />
                    </span>
                    <p className="text-sm font-semibold text-[var(--foreground)] type-small">{T4}</p>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)] type-caption">{T4B}</p>
                </div>
              </div>
            </SectionBlock>

            <SectionBlock
              id="contact"
              surface="none"
              padding="md"
              className="!space-y-0 !rounded-none !px-4 !pb-2 !pt-2.5 sm:!rounded-3xl sm:!p-5 sm:!pb-4 sm:!pt-5 md:!px-9 md:!pb-5 md:!pt-6 border-b border-[var(--divider)]"
            >
              <div className="grid items-stretch gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)] md:gap-8">
                <div className="flex min-h-0 flex-col justify-center space-y-2 md:space-y-3">
                  <h3 className="heading-display section-title type-h2 md:type-h2 text-[var(--foreground)]">
                    {C_H3}
                  </h3>
                  <p className="type-small leading-snug text-[var(--text-muted)] md:type-body md:leading-relaxed">
                    {C_P1}
                  </p>
                  <div className="mt-0.5 space-y-1 type-caption leading-normal text-[var(--text-muted)] md:mt-0 md:space-y-1.5 md:leading-snug md:type-small">
                    <p>{C_B1}</p>
                    <p>{C_B2}</p>
                    <p>{C_B3}</p>
                  </div>
                </div>
                <div className="flex min-h-0 flex-col justify-center rounded-none bg-transparent p-0 shadow-none ring-0 text-[var(--foreground)] sm:rounded-2xl sm:bg-[var(--surface-muted)] sm:p-5 sm:shadow-[var(--shadow-soft)] sm:ring-1 sm:ring-[var(--border)] md:p-6">
                  <h4 className="mb-1.5 type-small font-semibold leading-snug text-[var(--text-muted)] sm:mb-2 md:type-body">
                    {C_H4}
                  </h4>
                  <p className="mb-1.5 type-caption leading-snug text-[var(--text-muted)] sm:mb-2 md:type-small md:leading-relaxed">
                    {C_P2}
                  </p>
                  <p className="mb-2 type-caption font-medium leading-snug text-[var(--text-secondary)] sm:mb-3 md:type-small">
                    {C_P3}
                  </p>
                  <div className="mt-auto rounded-none bg-transparent p-0 pt-0 ring-0 sm:rounded-xl sm:bg-[var(--surface-muted)] sm:p-3 sm:pt-3 sm:ring-1 sm:ring-[var(--border)] md:p-4">
                    <HeroQuickConsultButton />
                  </div>
                </div>
              </div>
            </SectionBlock>
          </PageContainer>
        </main>
      </div>
    </>
  );
}
