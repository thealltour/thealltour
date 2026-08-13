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
import { collectBlogRssPosts, resolveBlogRssUrls } from "@/lib/rss";
import { getTopRatedPublishedReviews } from "@/lib/reviews";
import HeroQuickConsultButton from "@/components/inquiry/HeroQuickConsultButton";
import HeroSection from "@/components/home/HeroSection";
import { HomeDeferredSections } from "@/components/home/HomeDeferredSections";
import { HomeTrustSection } from "@/components/home/HomeTrustSection";

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
  const settingsPromise = getSiteSettings();
  const homeBlogPromise = settingsPromise.then(async (siteSettings) => {
    const urls = resolveBlogRssUrls({ blogPageUrl: siteSettings.naver_blog_url });
    const posts = await collectBlogRssPosts(urls);
    return posts.slice(0, 8);
  });

  const [homeCurated, topBanners, heroContent, settings, destinations, themes, golfTourProducts, golfCalendarData, homeBlogPosts, homeReviews] =
    await Promise.all([
      getHomeCuratedData(),
      getHomeBanners(),
      getHeroContent(),
      settingsPromise,
      getHubDestinations(),
      getHubThemes(),
      getHomeGolfTourProducts(),
      getGolfDepartureCalendarData(),
      homeBlogPromise,
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
              homeBlogPosts={homeBlogPosts}
              homeReviews={homeReviews}
            />

            <HomeTrustSection tourismRegNo={settings.tourism_reg_no} />

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
