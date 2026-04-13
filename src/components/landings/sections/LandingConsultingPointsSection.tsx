import { SectionBlock } from "@/components/layout/SectionBlock";
import type { AdminLandingSection } from "@/types/adminLanding";

type LandingConsultingPointsSectionProps = {
  section: AdminLandingSection;
};

function toLines(section: AdminLandingSection): string[] {
  const raw = section.body || section.description || "";
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function LandingConsultingPointsSection({ section }: LandingConsultingPointsSectionProps) {
  const lines = toLines(section);

  return (
    <SectionBlock surface="none" padding="sm">
      <h2 className="text-base font-semibold text-[var(--text-primary)]">{section.title}</h2>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {lines.length > 0
          ? lines.map((line, idx) => (
              <li
                key={`${section.id}-${idx}`}
                className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] sm:text-sm"
              >
                {line.replace(/^\-\s+/, "")}
              </li>
            ))
          : (
            <li className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-muted)]">
              준비 중입니다.
            </li>
            )}
      </ul>
    </SectionBlock>
  );
}
