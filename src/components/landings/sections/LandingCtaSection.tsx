import Link from "next/link";
import { SectionBlock } from "@/components/layout/SectionBlock";
import type { AdminLandingDetail, AdminLandingSection } from "@/types/adminLanding";

type LandingCtaSectionProps = {
  landing: AdminLandingDetail;
  section: AdminLandingSection;
  sourcePath: string;
};

function buildQuoteHref(landing: AdminLandingDetail, sourcePath: string): string {
  const params = new URLSearchParams();
  params.set("source_path", sourcePath);
  params.set("product_title", landing.title);
  if (landing.quoteCategory) {
    params.set("quote_category", landing.quoteCategory);
  }
  return `/quote?${params.toString()}`;
}

export default function LandingCtaSection({ landing, section, sourcePath }: LandingCtaSectionProps) {
  const href = buildQuoteHref(landing, sourcePath);
  return (
    <SectionBlock surface="card" padding="md">
      <h2 className="text-xl font-bold text-[var(--text-primary)]">{section.title}</h2>
      {section.description ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">{section.description}</p>
      ) : null}
      {section.body ? (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">{section.body}</p>
      ) : null}
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex items-center rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90"
        >
          상담 문의하기
        </Link>
      </div>
    </SectionBlock>
  );
}
