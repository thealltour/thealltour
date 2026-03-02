import SiteHeader from "@/components/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { getPublishedNotionGuides } from "@/lib/guides";
import Link from "next/link";

export const revalidate = 300;

export default async function GuidesIndexPage() {
  const guides = await getPublishedNotionGuides();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="blog" />

      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-6xl">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title="여행가이드"
          subtitle="지역별 골프장 정보, 시즌별 추천 코스, 출발 전 꼭 알아두면 좋은 팁들을 정리한 가이드입니다. 카드를 클릭하면 상세 페이지에서 내용을 확인할 수 있습니다."
        />

        <section className="space-y-4">
          {guides.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 type-small text-content-muted shadow-md ring-1 ring-[#e2e8f0]">
              아직 등록된 여행가이드가 없습니다.
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {guides.map((guide) => (
                <Link
                  key={guide.id}
                  href={`/guides/${guide.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="relative h-40 w-full overflow-hidden bg-slate-200">
                    {guide.cover_image_url || guide.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={guide.cover_image_url || guide.thumbnail_url || ""}
                        alt={guide.title_override || guide.title}
                        className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                        loading="lazy"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <p className="section-label text-content-muted">여행가이드</p>
                    <h3 className="font-card-title type-h3 text-content-primary">
                      {guide.title_override || guide.title}
                    </h3>
                    {guide.summary ? (
                      <p className="type-caption leading-relaxed text-content-secondary">
                        {guide.summary}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </SectionBody>
    </div>
  );
}

