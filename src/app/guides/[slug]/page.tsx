import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { SectionBody } from "@/components/layout/SectionBody";
import { PageHero } from "@/components/layout/PageHero";
import Link from "next/link";
import { NotionBlocksRenderer } from "@/components/guides/NotionBlocksRenderer";
import { getGuideContentCached } from "@/lib/notion";
import { getPublishedNotionGuides } from "@/lib/guides";

export const revalidate = 10800;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const content = await getGuideContentCached(slug);
  if (!content) {
    return {};
  }
  const title = `${content.title} | 더올투어 여행가이드`;
  const description = content.excerpt;
  const canonical = `/guides/${content.slug}`;
  const image = content.ogImage || "/thealltour-logo.png";

  return {
    title,
    description: description || undefined,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description: description || undefined,
      images: [{ url: image }],
      type: "article",
      url: canonical,
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: content.title,
    description: content.excerpt,
    datePublished: content.publishedAt ?? undefined,
    image: content.ogImage ? [content.ogImage] : undefined,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `https://thealltour.com/guides/${content.slug}`,
    },
    author: {
      "@type": "Organization",
      name: "더올투어",
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-content-primary">
      <SiteHeader activeTab="blog" />
      <SectionBody className="flex flex-col gap-[var(--space-5)] max-w-4xl">
        <PageHero
          kicker="THEALL TOUR GUIDE"
          title={content.title}
          subtitle={content.summary || content.excerpt}
        />

        <div className="flex flex-col gap-10 md:gap-12">
          <section className="notion-content-section space-y-4 rounded-3xl bg-[#0b1220] p-6 shadow-md ring-1 ring-[#1e293b] md:p-8">
            <NotionBlocksRenderer blocks={content.blocks} theme="dark" />
          </section>
        </div>

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

