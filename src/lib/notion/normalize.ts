import type { Guide } from "@/types/guide";
import type { GuideBlock, GuideContent, GuideImage, GuideTocItem, NotionRichText } from "@/lib/notion/types";

function richTextToString(richText: NotionRichText[]): string {
  return richText.map((item) => item.plain_text ?? "").join("").trim();
}

function slugifyHeading(text: string, fallbackId: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return normalized || fallbackId;
}

function toGuideImage(block: any): GuideImage | null {
  const source = block?.image?.type === "external" ? block?.image?.external?.url : block?.image?.file?.url;
  if (!source) return null;
  const caption = ((block?.image?.caption as NotionRichText[] | undefined) ?? [])
    .map((item) => item.plain_text ?? "")
    .join("")
    .trim();
  return {
    src: source,
    alt: caption || "여행가이드 이미지",
    caption: caption || undefined,
  };
}

function normalizeBlocksInternal(rawBlocks: any[], toc: GuideTocItem[]): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let index = 0;

  while (index < rawBlocks.length) {
    const block = rawBlocks[index];
    const type = block?.type;
    const id = String(block?.id ?? `block-${index}`);

    if (type === "image") {
      const consecutive: any[] = [];
      while (rawBlocks[index]?.type === "image") {
        consecutive.push(rawBlocks[index]);
        index += 1;
      }
      const images = consecutive.map((row) => toGuideImage(row)).filter((row): row is GuideImage => row !== null);
      if (images.length >= 2) {
        blocks.push({
          type: "image_group",
          id,
          groupId: `group-${id}`,
          images,
        });
      } else if (images.length === 1) {
        blocks.push({
          type: "image",
          id,
          image: images[0],
        });
      }
      continue;
    }

    if (type === "bulleted_list_item" || type === "numbered_list_item") {
      const ordered = type === "numbered_list_item";
      const items: Array<{ id: string; richText: NotionRichText[]; children: GuideBlock[] }> = [];
      while (rawBlocks[index]?.type === type) {
        const item = rawBlocks[index];
        const itemId = String(item?.id ?? `${id}-${items.length}`);
        const richText = (ordered
          ? item?.numbered_list_item?.rich_text
          : item?.bulleted_list_item?.rich_text) as NotionRichText[] | undefined;
        const children = Array.isArray(item?.children) ? normalizeBlocksInternal(item.children, toc) : [];
        items.push({
          id: itemId,
          richText: richText ?? [],
          children,
        });
        index += 1;
      }
      blocks.push({
        type: "list",
        id,
        ordered,
        items,
      });
      continue;
    }

    if (type === "heading_1" || type === "heading_2" || type === "heading_3") {
      const richText = (block?.[type]?.rich_text as NotionRichText[] | undefined) ?? [];
      const headingText = richTextToString(richText);
      const level = type === "heading_1" ? 1 : type === "heading_2" ? 2 : 3;
      const anchorId = slugifyHeading(headingText, id);
      if (level >= 2 && headingText) {
        toc.push({
          id: anchorId,
          level: level as 2 | 3,
          text: headingText,
        });
      }
      blocks.push({
        type: "heading",
        id: anchorId,
        level,
        richText,
      });
      index += 1;
      continue;
    }

    if (type === "paragraph") {
      blocks.push({
        type: "paragraph",
        id,
        richText: (block?.paragraph?.rich_text as NotionRichText[] | undefined) ?? [],
      });
      index += 1;
      continue;
    }

    if (type === "quote") {
      blocks.push({
        type: "quote",
        id,
        richText: (block?.quote?.rich_text as NotionRichText[] | undefined) ?? [],
      });
      index += 1;
      continue;
    }

    if (type === "callout") {
      blocks.push({
        type: "callout",
        id,
        icon: block?.callout?.icon?.emoji ?? undefined,
        richText: (block?.callout?.rich_text as NotionRichText[] | undefined) ?? [],
        children: Array.isArray(block?.children) ? normalizeBlocksInternal(block.children, toc) : [],
      });
      index += 1;
      continue;
    }

    if (type === "divider") {
      blocks.push({
        type: "divider",
        id,
      });
      index += 1;
      continue;
    }

    if (Array.isArray(block?.children) && block.children.length > 0) {
      blocks.push(...normalizeBlocksInternal(block.children, toc));
    }
    index += 1;
  }

  return blocks;
}

function collectPlainTextFromBlocks(blocks: GuideBlock[]): string {
  const chunks: string[] = [];
  for (const block of blocks) {
    if (block.type === "heading" || block.type === "paragraph" || block.type === "quote" || block.type === "callout") {
      chunks.push(richTextToString(block.richText));
      if (block.type === "callout") {
        chunks.push(collectPlainTextFromBlocks(block.children));
      }
    } else if (block.type === "list") {
      for (const item of block.items) {
        chunks.push(richTextToString(item.richText));
        if (item.children.length > 0) {
          chunks.push(collectPlainTextFromBlocks(item.children));
        }
      }
    }
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

export function normalizeGuideContent(input: {
  guide: Guide;
  rawBlocks: any[];
  pageTitleFromNotion?: string;
}): GuideContent {
  const toc: GuideTocItem[] = [];
  const blocks = normalizeBlocksInternal(input.rawBlocks, toc);
  const plainText = collectPlainTextFromBlocks(blocks);
  const excerpt = (input.guide.summary?.trim() || plainText).slice(0, 180);

  const firstImage = blocks.find((block) => block.type === "image" || block.type === "image_group");
  const firstImageSrc =
    firstImage?.type === "image"
      ? firstImage.image.src
      : firstImage?.type === "image_group"
        ? firstImage.images[0]?.src
        : undefined;

  return {
    id: input.guide.id,
    slug: input.guide.slug ?? "",
    title: input.guide.title_override || input.guide.title || input.pageTitleFromNotion || "여행가이드",
    summary: input.guide.summary ?? undefined,
    excerpt,
    ogImage: input.guide.cover_image_url || input.guide.thumbnail_url || firstImageSrc,
    coverImage: input.guide.cover_image_url || input.guide.thumbnail_url || firstImageSrc,
    publishedAt: input.guide.published_at || input.guide.created_at || undefined,
    notionPageId: input.guide.notion_page_id || "",
    blocks,
    toc,
  };
}

