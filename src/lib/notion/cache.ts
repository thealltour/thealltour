import { unstable_cache } from "next/cache";
import type { GuideContent } from "@/lib/notion/types";
import { fetchNotionBlocks, fetchNotionPageMeta } from "@/lib/notion/fetchers";
import { normalizeGuideContent } from "@/lib/notion/normalize";
import { getGuideBySlug } from "@/lib/notionSync";

async function loadGuideContentBySlug(slug: string): Promise<GuideContent | null> {
  const guide = await getGuideBySlug(slug);
  if (!guide || guide.is_published === false || !guide.notion_page_id) {
    return null;
  }

  const [rawBlocks, pageMeta] = await Promise.all([
    fetchNotionBlocks(guide.notion_page_id),
    fetchNotionPageMeta(guide.notion_page_id),
  ]);

  let titleFromNotion = "";
  const properties = (pageMeta as any)?.properties ?? {};
  for (const value of Object.values(properties) as any[]) {
    if (value?.type === "title" && Array.isArray(value.title) && value.title[0]?.plain_text) {
      titleFromNotion = value.title.map((item: any) => item.plain_text).join("");
      break;
    }
  }

  return normalizeGuideContent({
    guide,
    rawBlocks,
    pageTitleFromNotion: titleFromNotion,
    pageMeta,
  });
}

export async function getGuideContentCached(slug: string): Promise<GuideContent | null> {
  return unstable_cache(
    async () => loadGuideContentBySlug(slug),
    ["guide-content", slug],
    {
      revalidate: 300,
      tags: [`guide:${slug}`, "guides:list"],
    },
  )();
}

