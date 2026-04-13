import { SectionBlock } from "@/components/layout/SectionBlock";
import type { AdminLandingSection } from "@/types/adminLanding";

type LandingIntroSectionProps = {
  section: AdminLandingSection;
};

export default function LandingIntroSection({ section }: LandingIntroSectionProps) {
  return (
    <SectionBlock surface="card" padding="md">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">{section.title}</h2>
      {section.description ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">{section.description}</p>
      ) : null}
      {section.body ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">
          {section.body}
        </p>
      ) : null}
    </SectionBlock>
  );
}
