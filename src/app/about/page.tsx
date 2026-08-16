import Link from "next/link";
import SiteHeader from "@/components/site-chrome/SiteHeader";
import { getSiteSettings } from "@/lib/siteSettings";
import { buttonVariants } from "@/components/ui/Button";
import { PageHero } from "@/components/layout/PageHero";
import { SectionBody } from "@/components/layout/SectionBody";
import { ContentCard } from "@/components/layout/ContentCard";
export default async function AboutPage() {
  const settings = await getSiteSettings();

  const kicker = settings.about_kicker || "ABOUT THEALL TOUR";
  const title = settings.about_title || "여행을 디자인해 드립니다";
  const paragraph1 = settings.about_paragraph1;
  const paragraph2 = settings.about_paragraph2;
  const ctaLabel = settings.about_cta_label || "맞춤 여행 상담 받기";
  const ctaHref = settings.about_cta_href || "/#contact";
  const isExternal = ctaHref.startsWith("http://") || ctaHref.startsWith("https://");

  return (
    <div className="min-h-screen page-bg-wash text-content-primary">
      <SiteHeader activeTab="about" />

      <SectionBody className="flex flex-col gap-[var(--space-5)]">
        <PageHero kicker={kicker} title={title} size="sm" />

        <ContentCard>
          <div className="space-y-6 type-body text-content-secondary">
            {paragraph1 ? <p className="whitespace-pre-line">{paragraph1}</p> : null}
            {paragraph2 ? <p className="whitespace-pre-line">{paragraph2}</p> : null}
          </div>
          <div className="mt-8">
            {isExternal ? (
              <a
                href={ctaHref}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                {ctaLabel}
              </a>
            ) : (
              <Link
                href={ctaHref}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                {ctaLabel}
              </Link>
            )}
          </div>
        </ContentCard>
      </SectionBody>
    </div>
  );
}
