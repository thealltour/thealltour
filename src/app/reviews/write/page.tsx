import SiteHeader from "@/components/SiteHeader";
import ReviewWriteForm from "@/components/ReviewWriteForm";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";

export default function ReviewWritePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="reviews" />
      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <PageHero
          kicker="THEALL TOUR REVIEWS"
          title="여행후기 작성"
          subtitle="실제 여행 경험을 남겨주시면 더올투어를 찾는 분들께 큰 도움이 됩니다."
        />
        <ContentCard>
          <ReviewWriteForm />
        </ContentCard>
      </SectionBody>
    </div>
  );
}
