import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import SiteHeader from "@/components/SiteHeader";
import { SectionBody } from "@/components/layout/SectionBody";
import { PageHero } from "@/components/layout/PageHero";
import Link from "next/link";
import { GuideDetailBody } from "@/components/guides/GuideDetailBody";
import { getGuideContentCached } from "@/lib/notion";
import { getPublishedNotionGuides } from "@/lib/guides";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getGuideContentCached(slug);
  if (!content) {
    return {};
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
  const baseTitle = content.seoTitle?.trim() || content.title;
  const title = `${baseTitle} | 더올투어 여행가이드`;
  const description =
    content.seoDescription?.trim() ||
    content.summary?.trim() ||
    content.excerpt ||
    (content.excerptText ? content.excerptText.slice(0, 160).trim() + "…" : undefined);
  const canonical = `/guides/${content.slug}`;
  const imageRaw = content.ogImage || content.coverImage || "/thealltour-logo.png";
  const image = imageRaw.startsWith("http") ? imageRaw : `${siteUrl}${imageRaw.startsWith("/") ? "" : "/"}${imageRaw}`;

  return {
    title,
    description: description || undefined,
    ...(content.is_published === false && { robots: { index: false, follow: false } }),
    alternates: {
      canonical: `${siteUrl}${canonical}`,
    },
    openGraph: {
      title,
      description: description || undefined,
      images: [{ url: image }],
      type: "article",
      url: `${siteUrl}${canonical}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: description || undefined,
      images: [image],
    },
  };
}

export async function generateStaticParams() {
  const guides = await getPublishedNotionGuides();
  return guides
    .filter((guide) => Boolean(guide.slug))
    .map((guide) => ({ slug: guide.slug as string }));
}

export default async function GuideDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const content = await getGuideContentCached(slug);

  if (!content) {
    notFound();
  }

  const guides = await getPublishedNotionGuides();
  const relatedGuides = guides
    .filter((guide) => guide.slug && guide.slug !== content.slug)
    .slice(0, 3);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: content.title,
    description: content.summary || content.excerpt || content.excerptText?.slice(0, 200),
    datePublished: content.publishedAt ?? undefined,
    dateModified: content.notionLastEditedTime ?? content.publishedAt ?? undefined,
    image: content.ogImage ? [content.ogImage] : undefined,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/guides/${content.slug}`,
    },
    author: {
      "@type": "Organization",
      name: "더올투어",
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="blog" />
      <SectionBody className="flex max-w-4xl flex-col gap-[var(--space-5)]">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title={content.title}
          subtitle={content.summary || content.excerpt}
        />

        {content.coverImage ? (
          <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl bg-slate-100">
            <Image
              src={content.coverImage}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 896px"
              priority
            />
          </div>
        ) : null}

        <article aria-label="가이드 본문">
          <GuideDetailBody
            excerptText={content.excerptText ?? ""}
            toc={content.toc}
            notionUrl={content.notionUrl}
            title={content.title}
            autoOpenModalOnMount={true}
          />
        </article>

        {relatedGuides.length > 0 ? (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">관련 가이드</h2>
            <ul className="space-y-2">
              {relatedGuides.map((guide) => (
                <li key={guide.id}>
                  <Link
                    href={`/guides/${guide.slug}`}
                    className="text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline"
                  >
                    {guide.title_override || guide.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </SectionBody>
    </div>
  );
}

