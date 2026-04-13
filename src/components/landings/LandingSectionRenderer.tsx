import LandingHeroSection from "@/components/landings/sections/LandingHeroSection";
import LandingIntroSection from "@/components/landings/sections/LandingIntroSection";
import LandingConsultingPointsSection from "@/components/landings/sections/LandingConsultingPointsSection";
import LandingRecommendedTargetsSection from "@/components/landings/sections/LandingRecommendedTargetsSection";
import LandingFaqSection from "@/components/landings/sections/LandingFaqSection";
import LandingCtaSection from "@/components/landings/sections/LandingCtaSection";
import { SectionBlock } from "@/components/layout/SectionBlock";
import type { AdminLandingDetail, AdminLandingSection } from "@/types/adminLanding";

type LandingSectionRendererProps = {
  landing: AdminLandingDetail;
  section: AdminLandingSection;
  mode: "preview" | "public";
  sourcePath: string;
  /** Hero 직하단 추천 상품 블록이 렌더될 때만 true */
  showHeroProductScrollCta?: boolean;
};

export function LandingSectionRenderer({
  landing,
  section,
  mode,
  sourcePath,
  showHeroProductScrollCta = false,
}: LandingSectionRendererProps) {
  switch (section.sectionType) {
    case "hero":
      return (
        <LandingHeroSection
          landing={landing}
          section={section}
          sourcePath={sourcePath}
          showHeroProductScrollCta={showHeroProductScrollCta}
        />
      );
    case "intro":
      return <LandingIntroSection section={section} />;
    case "consulting_points":
      return <LandingConsultingPointsSection section={section} />;
    case "recommended_targets":
      return <LandingRecommendedTargetsSection section={section} />;
    case "faq":
      return <LandingFaqSection section={section} />;
    case "cta":
      return <LandingCtaSection landing={landing} section={section} sourcePath={sourcePath} />;
    default:
      if (mode === "preview") {
        return (
          <SectionBlock surface="muted" padding="sm">
            <p className="text-sm text-[var(--text-muted)]">
              미지원 섹션 타입입니다: {section.sectionType}
            </p>
          </SectionBlock>
        );
      }
      return null;
  }
}
