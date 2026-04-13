import { SectionBlock } from "@/components/layout/SectionBlock";
import SectionRichBody from "@/components/landings/sections/SectionRichBody";
import type { AdminLandingSection } from "@/types/adminLanding";

type LandingFaqSectionProps = {
  section: AdminLandingSection;
};

export default function LandingFaqSection({ section }: LandingFaqSectionProps) {
  return (
    <SectionBlock surface="muted" padding="md">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{section.title}</h2>
      {section.description ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">{section.description}</p>
      ) : null}
      {section.body ? (
        <div className="mt-3 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--text-secondary)]">
          <SectionRichBody body={section.body} />
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--text-muted)]">
          FAQ 내용이 아직 입력되지 않았습니다.
        </div>
      )}
    </SectionBlock>
  );
}
