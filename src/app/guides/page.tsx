import SiteHeader from "@/components/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { GuidesListClient } from "@/components/guides/GuidesListClient";
import { GuideSearchBar } from "@/components/guides/GuideSearchBar";
import { Breadcrumb } from "@/components/navigation/Breadcrumb";
import { getPublishedNotionGuidesWithSearch } from "@/lib/guides";

export const revalidate = 300;

type Props = { searchParams?: Promise<{ q?: string }> };

export default async function GuidesIndexPage({ searchParams }: Props) {
  const params = await searchParams ?? {};
  const q = typeof params.q === "string" ? params.q : undefined;
  const guides = await getPublishedNotionGuidesWithSearch(q);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="blog" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-6xl">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title="여행가이드"
          subtitle="지역별 골프장 정보, 시즌별 추천 코스, 출발 전 꼭 알아두면 좋은 팁들을 정리한 가이드입니다. 카드를 클릭하면 원문(노션)을 바로 확인할 수 있습니다."
          size="sm"
        />
        <Breadcrumb items={[{ label: "홈", href: "/" }, { label: "여행가이드" }]} />

        <section className="space-y-4">
          <GuideSearchBar />
          <GuidesListClient guides={guides} />
        </section>
      </SectionBody>
    </div>
  );
}

