import { SectionBlock } from "@/components/layout/SectionBlock";
import SectionRichBody from "@/components/landings/sections/SectionRichBody";
import type { AdminLandingSection } from "@/types/adminLanding";

type LandingIntroSectionProps = {
  section: AdminLandingSection;
};

export default function LandingIntroSection({ section }: LandingIntroSectionProps) {
  return (
    <SectionBlock surface="none" padding="sm">
      <h2 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{section.title}</h2>
      {section.description ? (
        <p className="mt-2 text-sm leading-snug text-[var(--text-muted)]">{section.description}</p>
      ) : null}
      {section.body ? (
        <div className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          <SectionRichBody body={section.body} className="text-[var(--text-secondary)]" />
        </div>
      ) : null}
    </SectionBlock>
  );
}
