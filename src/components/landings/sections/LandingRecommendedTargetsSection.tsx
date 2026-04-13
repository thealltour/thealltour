import { SectionBlock } from "@/components/layout/SectionBlock";
import type { AdminLandingSection } from "@/types/adminLanding";

type LandingRecommendedTargetsSectionProps = {
  section: AdminLandingSection;
};

function toCards(section: AdminLandingSection): string[] {
  return (section.body || section.description || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function LandingRecommendedTargetsSection({ section }: LandingRecommendedTargetsSectionProps) {
  const cards = toCards(section);
  return (
    <SectionBlock surface="none" padding="sm">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">{section.title}</h2>
      {section.description ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">{section.description}</p>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {cards.length > 0
          ? cards.map((card, idx) => (
              <div
                key={`${section.id}-${idx}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]"
              >
                {card.replace(/^\-\s+/, "")}
              </div>
            ))
          : (
            <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-muted)]">
              대상 안내가 아직 준비되지 않았습니다.
            </div>
            )}
      </div>
    </SectionBlock>
  );
}
