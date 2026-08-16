import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { GuidesListClient } from "@/components/guides/GuidesListClient";
import { GuideSearchBar } from "@/components/guides/GuideSearchBar";
import { getPublishedNotionGuidesWithSearch } from "@/lib/guides";
import { getActiveTaxonomiesForHeader, buildGuideBadgeLabels } from "@/lib/productTaxonomies";

export const revalidate = 300;

type Props = { searchParams?: Promise<{ q?: string }> };

export default async function GuidesIndexPage({ searchParams }: Props) {
  const params = await searchParams ?? {};
  const q = typeof params.q === "string" ? params.q : undefined;
  const guides = await getPublishedNotionGuidesWithSearch(q);

  const taxonomies = await getActiveTaxonomiesForHeader();
  const idToTaxonomy = new Map(taxonomies.map((t) => [t.id, t]));

  const guidesWithBadges = guides.map((guide) => ({
    ...guide,
    badgeLabels: buildGuideBadgeLabels(guide, idToTaxonomy),
  }));

  return (
    <div className="min-h-screen page-bg-wash text-content-primary">
      <SiteHeader activeTab="guides" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-6xl">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title="여행가이드"
          subtitle="지역별 골프장 정보, 시즌별 추천 코스, 출발 전 꼭 알아두면 좋은 팁들을 정리한 가이드입니다. 카드를 누르면 가이드 브리지 페이지로 이동한 뒤, 추천 여행과 원문(노션)을 이어서 확인할 수 있습니다."
          size="sm"
        />

        <section className="space-y-4">
          <GuideSearchBar />
          <GuidesListClient guides={guidesWithBadges} />
        </section>
      </SectionBody>
    </div>
  );
}

