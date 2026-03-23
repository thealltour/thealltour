import SiteHeader from "@/components/site-chrome/SiteHeader";
import { getPublishedGuidesWithTaxonomyNames } from "@/lib/guides";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { GuideCardList } from "@/components/guides/GuideCardList";

export default async function BlogPage() {
  const guides = await getPublishedGuidesWithTaxonomyNames();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="blog" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-6xl">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title="여행가이드"
          subtitle="지역별 골프장 정보, 시즌별 추천 코스, 출발 전 꼭 알아두면 좋은 팁들을 정리한 가이드입니다. PDF는 바로 보기, 노션 연동 가이드는 카드에서 브리지(/guides/[slug])로 이동한 뒤 원문을 이어 읽을 수 있어요. 브리지 하단「가이드 전체 보기」로 이 목록에 다시 돌아올 수 있습니다."
          size="sm"
        />

        <section className="space-y-4">
          <GuideCardList guides={guides} />
        </section>
      </SectionBody>
    </div>
  );
}
