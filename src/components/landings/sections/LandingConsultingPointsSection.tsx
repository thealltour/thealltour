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
    <SectionBlock surface="card" padding="md">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">{section.title}</h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {lines.length > 0
          ? lines.map((line, idx) => (
              <li
                key={`${section.id}-${idx}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]"
              >
                {line}
              </li>
            ))
          : (
            <li className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-muted)]">
              준비 중입니다.
            </li>
            )}
      </ul>
    </SectionBlock>
  );
}
