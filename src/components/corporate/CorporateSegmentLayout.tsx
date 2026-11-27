import Link from "next/link";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";
import { CorporateQuoteCta } from "@/components/corporate/CorporateQuoteCta";
import { CorporateStatusBadge } from "@/components/corporate/CorporateStatusBadge";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  CORPORATE_HUB,
  getCorporateProgramQuoteHref,
  getCorporateSegmentQuoteHref,
  type CorporateSegmentContent,
} from "@/lib/corporate/content";

export function CorporateSegmentLayout({
  segment,
}: {
  segment: CorporateSegmentContent;
}) {
  const quoteHref = getCorporateSegmentQuoteHref(segment.id);

  return (
    <div className="min-h-screen page-bg-wash text-content-primary">
      <SiteHeader />
      <SectionBody className="flex flex-col gap-6 md:gap-8">
        <PageHero
          kicker="기업·기관 단체여행"
          title={segment.title}
          subtitle={segment.description}
          size="sm"
        />

        <nav aria-label="기업·단체여행 경로" className="type-small text-content-secondary">
          <Link href={CORPORATE_HUB.path} className="text-[var(--primary)] hover:underline">
            {CORPORATE_HUB.navLabel}
          </Link>
          <span aria-hidden className="mx-1.5 text-[var(--text-muted)]">
            /
          </span>
          <span className="text-content-primary">{segment.navLabel}</span>
        </nav>

        <ContentCard>
          <section className="space-y-3" aria-labelledby="corporate-intro">
            <h2 id="corporate-intro" className="type-h3 text-content-primary">
              소개
            </h2>
            <p className="type-body text-content-secondary whitespace-pre-line">{segment.intro}</p>
          </section>
        </ContentCard>

        <ContentCard>
          <section className="space-y-4" aria-labelledby="corporate-programs">
            <h2 id="corporate-programs" className="type-h3 text-content-primary">
              프로그램 선택
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {segment.programs.map((program) => (
                <li
                  key={program.id}
                  className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
                >
                  <p className="font-semibold text-content-primary">{program.title}</p>
                  <p className="mt-1 flex-1 type-small text-content-secondary">{program.summary}</p>
                  <Link
                    href={getCorporateProgramQuoteHref(segment.id, program.id)}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      "mt-3 self-start",
                    )}
                  >
                    {program.title} 견적
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </ContentCard>

        <ContentCard>
          <section className="space-y-4" aria-labelledby="corporate-itinerary">
            <div className="space-y-1">
              <h2 id="corporate-itinerary" className="type-h3 text-content-primary">
                예시 일정
              </h2>
              <p className="type-small text-content-secondary">{segment.sampleItinerary.summary}</p>
            </div>
            <p className="font-semibold text-content-primary">{segment.sampleItinerary.title}</p>
            <ol className="space-y-3">
              {segment.sampleItinerary.steps.map((step, index) => (
                <li
                  key={step.title}
                  className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-content-primary">
                      <span className="mr-2 text-[var(--text-muted)]">{index + 1}.</span>
                      {step.title}
                    </p>
                    <p className="type-small text-content-secondary">{step.detail}</p>
                  </div>
                  <CorporateStatusBadge status={step.status} className="self-start" />
                </li>
              ))}
            </ol>
          </section>
        </ContentCard>

        <ContentCard>
          <section className="space-y-4" aria-labelledby="corporate-support">
            <h2 id="corporate-support" className="type-h3 text-content-primary">
              지원 범위·협의 사항
            </h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold text-content-primary">지원 범위</h3>
                <ul className="list-disc space-y-1.5 pl-5 type-small text-content-secondary">
                  {segment.supportScope.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-content-primary">협의 사항</h3>
                <ul className="list-disc space-y-1.5 pl-5 type-small text-content-secondary">
                  {segment.negotiationNotes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </ContentCard>

        <ContentCard>
          <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="corporate-quote">
            <div className="space-y-1">
              <h2 id="corporate-quote" className="type-h3 text-content-primary">
                견적
              </h2>
              <p className="type-small text-content-secondary">
                목적과 인원만 알려주셔도 일정 초안 상담이 가능합니다.
              </p>
            </div>
            <CorporateQuoteCta href={quoteHref} />
          </section>
        </ContentCard>
      </SectionBody>
    </div>
  );
}
