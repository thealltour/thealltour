import InquiryForm from "@/components/InquiryForm";
import SiteHeader from "@/components/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";

type QuotePageProps = {
  searchParams?: Promise<{
    product_id?: string;
    product_title?: string;
    source_path?: string;
  }>;
};

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const query = (await searchParams) ?? {};

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="quote" />

      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <PageHero
          kicker="THEALL TOUR QUOTE"
          title="맞춤 견적 문의"
          subtitle="여행 희망 조건을 남겨주시면 접수 순서대로 맞춤 일정과 견적 옵션을 안내드립니다."
        />

        <ContentCard>
          <div className="mb-6 space-y-2">
            <p className="section-label text-[#B8962E]">THEALL TOUR CONTACT</p>
            <h2 className="section-title type-h2">견적 문의 작성</h2>
            <p className="type-small text-content-secondary">
              이름, 연락처, 문의 내용을 남겨주시면 맞춤 견적으로 안내드리겠습니다.
            </p>
          </div>
          <InquiryForm
            source={{
              product_id: query.product_id,
              product_title: query.product_title,
              source_path: query.source_path,
            }}
          />
        </ContentCard>
      </SectionBody>
    </div>
  );
}
