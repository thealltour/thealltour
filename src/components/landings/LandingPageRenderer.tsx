import { PageContainer } from "@/components/layout/PageContainer";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { LandingSectionRenderer } from "@/components/landings/LandingSectionRenderer";
import type { AdminLandingDetail, AdminLandingSection } from "@/types/adminLanding";

type LandingPageRendererProps = {
  landing: AdminLandingDetail;
  mode: "preview" | "public";
  sourcePath: string;
};

function getRenderableSections(landing: AdminLandingDetail): AdminLandingSection[] {
  return (landing.sections ?? [])
    .filter((section) => section.isEnabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export default function LandingPageRenderer({ landing, mode, sourcePath }: LandingPageRendererProps) {
  const sections = getRenderableSections(landing);

  return (
    <main className="flex w-full flex-col py-6 sm:py-10 md:py-14">
      <PageContainer size="wide" className="flex flex-col gap-8">
        {sections.length > 0 ? (
          sections.map((section) => (
            <LandingSectionRenderer
              key={section.id}
              landing={landing}
              section={section}
              mode={mode}
              sourcePath={sourcePath}
            />
          ))
        ) : (
          <SectionBlock surface="muted" padding="md">
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{landing.title}</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              노출 가능한 섹션이 아직 없습니다.
            </p>
          </SectionBlock>
        )}
      </PageContainer>
    </main>
  );
}
