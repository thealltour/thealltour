"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SectionBlock } from "@/components/layout/SectionBlock";
import SectionRichBody from "@/components/landings/sections/SectionRichBody";
import { trackLandingCtaClick } from "@/lib/analytics/trackLandingQuoteFunnel";
import { buildLandingQuoteHref } from "@/lib/landings/buildLandingQuoteHref";
import { useQuoteHrefWithUtm } from "@/hooks/useQuoteHrefWithUtm";
import type { AdminLandingDetail, AdminLandingSection } from "@/types/adminLanding";

type LandingCtaSectionProps = {
  landing: AdminLandingDetail;
  section: AdminLandingSection;
  sourcePath: string;
};

export default function LandingCtaSection({ landing, section, sourcePath }: LandingCtaSectionProps) {
  const baseHref = useMemo(() => buildLandingQuoteHref(landing, sourcePath), [landing, sourcePath]);
  const href = useQuoteHrefWithUtm(baseHref);
  return (
    <SectionBlock surface="card" padding="md" className="max-w-3xl">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">{section.title}</h2>
      {section.description ? (
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">{section.description}</p>
      ) : null}
      {section.body ? (
        <div className="mt-3 max-w-2xl text-[var(--text-secondary)]">
          <SectionRichBody body={section.body} />
        </div>
      ) : null}
      <div className="mt-5">
        <Link
          href={href}
          onClick={() => {
            trackLandingCtaClick(landing, sourcePath);
          }}
          className="inline-flex items-center rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
        >
          맞춤 상담 요청하기
        </Link>
      </div>
    </SectionBlock>
  );
}
