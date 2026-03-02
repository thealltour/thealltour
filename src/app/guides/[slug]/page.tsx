import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import { SectionBody } from "@/components/layout/SectionBody";
import { PageHero } from "@/components/layout/PageHero";
import { getGuideBySlug } from "@/lib/notionSync";
import { fetchNotionBlocks, fetchNotionPageMeta } from "@/lib/notion";
import { NotionBlocksRenderer } from "@/components/guides/NotionBlocksRenderer";

export const revalidate = 300;

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);
  if (!guide || guide.is_published === false) {
    return {};
  }

  const titleBase = guide.title_override || guide.title;
  const title = `${titleBase} | 더올투어 여행가이드`;

  let description = guide.summary ?? "";
  if (!description && guide.notion_page_id) {
    try {
      const page = await fetchNotionPageMeta(guide.notion_page_id);
      const properties = (page as any).properties ?? {};
      for (const value of Object.values(properties) as any[]) {
        if (value?.type === "rich_text" && Array.isArray(value.rich_text) && value.rich_text[0]?.plain_text) {
          description = value.rich_text.map((t: any) => t.plain_text).join(" ").slice(0, 150);
          break;
        }
      }
    } catch {
      // ignore
    }
  }

  const image = guide.cover_image_url || guide.thumbnail_url || "/thealltour-logo.png";

  return {
    title,
    description: description || undefined,
    openGraph: {
      title,
      description: description || undefined,
      images: [{ url: image }],
      type: "article",
    },
  };
}

export default async function GuideDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const guide = await getGuideBySlug(slug);

  if (!guide || guide.is_published === false || !guide.notion_page_id) {
    notFound();
  }

  const blocks = await fetchNotionBlocks(guide.notion_page_id);
  const title = guide.title_override || guide.title;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: guide.summary ?? undefined,
    datePublished: guide.published_at ?? guide.created_at ?? undefined,
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
          title={title}
          subtitle={guide.summary ?? undefined}
        />
        <section className="space-y-4 rounded-3xl bg-white p-6 shadow-md ring-1 ring-[#e2e8f0]">
          <NotionBlocksRenderer blocks={blocks} />
        </section>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </SectionBody>
    </div>
  );
}

