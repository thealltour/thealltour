import Link from "next/link";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";
import { CorporateQuoteCta } from "@/components/corporate/CorporateQuoteCta";
import { CorporateStatusBadge } from "@/components/corporate/CorporateStatusBadge";
import {
  CORPORATE_HUB,
  CORPORATE_SEGMENTS,
  getCorporateHubQuoteHref,
} from "@/lib/corporate/content";

export function CorporateHubView() {
  const quoteHref = getCorporateHubQuoteHref();

  return (
    <div className="min-h-screen page-bg-wash text-content-primary">
      <SiteHeader />
      <SectionBody className="flex flex-col gap-6 md:gap-8">
        <PageHero
          kicker="CORPORATE & INSTITUTIONAL"
          title={CORPORATE_HUB.title}
          subtitle={CORPORATE_HUB.description}
          size="sm"
        />

        <ContentCard>
          <section className="space-y-3" aria-labelledby="corporate-hub-intro">
            <h2 id="corporate-hub-intro" className="type-h3 text-content-primary">
              소개
            </h2>
            <p className="type-body text-content-secondary">{CORPORATE_HUB.intro}</p>
          </section>
        </ContentCard>

        <ContentCard>
          <section className="space-y-4" aria-labelledby="corporate-hub-segments">
            <h2 id="corporate-hub-segments" className="type-h3 text-content-primary">
              고객군 선택
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {CORPORATE_SEGMENTS.map((segment) => (
                <li key={segment.id}>
                  <Link
                    href={segment.path}
                    className="block h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    <p className="font-semibold text-content-primary">{segment.navLabel}</p>
                    <p className="mt-1 type-small text-content-secondary">{segment.description}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </ContentCard>

        <ContentCard>
          <section className="space-y-4" aria-labelledby="corporate-hub-samples">
            <h2 id="corporate-hub-samples" className="type-h3 text-content-primary">
              대표 일정 예시
            </h2>
            <ul className="space-y-4">
              {CORPORATE_SEGMENTS.map((segment) => (
                <li
                  key={segment.id}
                  className="rounded-2xl border border-[var(--border)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-content-primary">{segment.navLabel}</p>
                    <span className="type-small text-content-secondary">
                      {segment.sampleItinerary.title}
                    </span>
                  </div>
                  <p className="mt-1 type-small text-content-secondary">
                    {segment.sampleItinerary.summary}
                  </p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {segment.sampleItinerary.steps.map((step) => (
                      <li key={step.title} className="inline-flex items-center gap-1.5">
                        <span className="type-small text-content-primary">{step.title}</span>
                        <CorporateStatusBadge status={step.status} />
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={segment.path}
                    className="mt-3 inline-flex type-small font-medium text-[var(--primary)] hover:underline"
                  >
                    {segment.navLabel} 상세 보기
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </ContentCard>

        <ContentCard>
          <section className="space-y-3" aria-labelledby="corporate-hub-support">
            <h2 id="corporate-hub-support" className="type-h3 text-content-primary">
              지원 범위
            </h2>
            <ul className="list-disc space-y-1.5 pl-5 type-body text-content-secondary">
              {CORPORATE_HUB.supportScope.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </ContentCard>

        <ContentCard>
          <section className="space-y-4" aria-labelledby="corporate-hub-process">
            <h2 id="corporate-hub-process" className="type-h3 text-content-primary">
              진행 절차
            </h2>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CORPORATE_HUB.processSteps.map((step, index) => (
                <li
                  key={step.title}
                  className="rounded-2xl border border-[var(--border)] p-4"
                >
                  <p className="type-caption font-semibold text-[var(--text-muted)]">
                    {index + 1}단계
                  </p>
                  <p className="mt-1 font-semibold text-content-primary">{step.title}</p>
                  <p className="mt-1 type-small text-content-secondary">{step.detail}</p>
                </li>
              ))}
            </ol>
          </section>
        </ContentCard>

        <ContentCard>
          <section
            className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            aria-labelledby="corporate-hub-quote"
          >
            <div className="space-y-1">
              <h2 id="corporate-hub-quote" className="type-h3 text-content-primary">
                견적
              </h2>
              <p className="type-small text-content-secondary">
                조직 유형과 목적만 남겨주셔도 상담을 시작할 수 있습니다.
              </p>
            </div>
            <CorporateQuoteCta href={quoteHref} />
          </section>
        </ContentCard>
      </SectionBody>
    </div>
  );
}
