import { SectionBlock } from "@/components/layout/SectionBlock";
import type { AdminLandingSection } from "@/types/adminLanding";

type LandingFaqSectionProps = {
  section: AdminLandingSection;
};

export default function LandingFaqSection({ section }: LandingFaqSectionProps) {
  return (
    <SectionBlock surface="card" padding="md">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">{section.title}</h2>
      {section.description ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">{section.description}</p>
      ) : null}
      {section.body ? (
        <div className="mt-3 whitespace-pre-line rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm leading-relaxed text-[var(--text-secondary)]">
          {section.body}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 text-sm text-[var(--text-muted)]">
          FAQ 내용이 아직 입력되지 않았습니다.
        </div>
      )}
    </SectionBlock>
  );
}
