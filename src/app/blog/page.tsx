import SiteHeader from "@/components/SiteHeader";
import { getPublishedGuides } from "@/lib/guides";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { GuideCardList } from "@/components/GuideCardList";

export default async function BlogPage() {
  const guides = await getPublishedGuides();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="blog" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-6xl">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title="여행가이드"
          subtitle="지역별 골프장 정보, 시즌별 추천 코스, 출발 전 꼭 알아두면 좋은 팁들을 정리한 가이드입니다. 카드 유형에 따라 PDF 바로보기 또는 상세 가이드 페이지로 이동합니다."
        />

        <section className="space-y-4">
          <GuideCardList guides={guides} />
        </section>
      </SectionBody>
    </div>
  );
}
