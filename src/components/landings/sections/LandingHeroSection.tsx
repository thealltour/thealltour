import { LandingDetailHero } from "@/components/landing/LandingDetailHero";
import type { AdminLandingDetail, AdminLandingSection } from "@/types/adminLanding";

type LandingHeroSectionProps = {
  landing: AdminLandingDetail;
  section: AdminLandingSection;
};

export default function LandingHeroSection({ landing, section }: LandingHeroSectionProps) {
  return (
    <LandingDetailHero
      title={section.title?.trim() || landing.title}
      description={section.description?.trim() || landing.summary || ""}
      imageUrl={null}
    />
  );
}
