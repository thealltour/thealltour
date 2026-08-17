import type { Guide } from "@/types/guide";
import type {
  GuideBlock,
  GuideContent,
  GuideImage,
  GuideTocItem,
  NotionPageMeta,
  NotionRawBlock,
  NotionRichText,
} from "@/lib/notion/types";
import { extractNotionCoverUrl, getBlockRichText, slugifyHeading } from "@/lib/notion/types";
import { extractNotionSeoFromBlocks } from "@/lib/notion/text";

function richTextToString(richText: NotionRichText[]): string {
  return richText.map((item) => item.plain_text ?? "").join("").trim();
}

function toGuideImage(block: NotionRawBlock): GuideImage | null {
  const source = block.image?.type === "external" ? block.image?.external?.url : block.image?.file?.url;
  if (!source) return null;
  const caption = (block.image?.caption ?? [])
    .map((item) => item.plain_text ?? "")
    .join("")
    .trim();
  return {
    src: source,
    alt: caption || "여행가이드 이미지",
    caption: caption || undefined,
  };
}

function normalizeBlocksInternal(rawBlocks: NotionRawBlock[], toc: GuideTocItem[]): GuideBlock[] {
  const blocks: GuideBlock[] = [];
  let index = 0;

  while (index < rawBlocks.length) {
    const block = rawBlocks[index];
    const type = block?.type;
    const id = String(block?.id ?? `block-${index}`);

    if (type === "image") {
      const consecutive: NotionRawBlock[] = [];
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
        const richText = ordered
          ? item?.numbered_list_item?.rich_text
          : item?.bulleted_list_item?.rich_text;
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
      const richText = getBlockRichText(block, type);
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

    if (type === "column_list") {
      const rawColumns = Array.isArray(block?.children)
        ? block.children.filter((child) => child?.type === "column")
        : [];

      const columns: Array<{ id: string; blocks: GuideBlock[] }> = rawColumns
        .map((column, columnIndex: number) => {
          const columnChildren = Array.isArray(column?.children) ? column.children : [];
          const columnBlocks = normalizeBlocksInternal(columnChildren, toc);
          return {
            id: String(column?.id ?? `${id}-column-${columnIndex}`),
            blocks: columnBlocks,
          };
        })
        .filter((column: { id: string; blocks: GuideBlock[] }) => column.blocks.length > 0);

      if (columns.length > 0) {
        blocks.push({
          type: "columns",
          id,
          columns,
        });
      } else if (Array.isArray(block?.children) && block.children.length > 0) {
        blocks.push(...normalizeBlocksInternal(block.children, toc));
      }
      index += 1;
      continue;
    }

    if (type === "table") {
      const rows = Array.isArray(block?.children)
        ? block.children
            .filter((child) => child?.type === "table_row")
            .map((row, rowIndex: number) => ({
              id: String(row?.id ?? `${id}-row-${rowIndex}`),
              cells: row.table_row?.cells ?? [],
            }))
        : [];

      if (rows.length > 0) {
        blocks.push({
          type: "table",
          id,
          hasColumnHeader: Boolean(block?.table?.has_column_header),
          hasRowHeader: Boolean(block?.table?.has_row_header),
          rows,
        });
      } else if (Array.isArray(block?.children) && block.children.length > 0) {
        blocks.push(...normalizeBlocksInternal(block.children, toc));
      }
      index += 1;
      continue;
    }

    if (type === "paragraph") {
      blocks.push({
        type: "paragraph",
        id,
        richText: block?.paragraph?.rich_text ?? [],
      });
      index += 1;
      continue;
    }

    if (type === "quote") {
      blocks.push({
        type: "quote",
        id,
        richText: block?.quote?.rich_text ?? [],
      });
      index += 1;
      continue;
    }

    if (type === "callout") {
      blocks.push({
        type: "callout",
        id,
        icon: block?.callout?.icon?.emoji ?? undefined,
        richText: block?.callout?.rich_text ?? [],
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
    } else if (block.type === "columns") {
      for (const column of block.columns) {
        chunks.push(collectPlainTextFromBlocks(column.blocks));
      }
    } else if (block.type === "table") {
      for (const row of block.rows) {
        for (const cell of row.cells) {
          chunks.push(richTextToString(cell));
        }
      }
    }
  }
  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

export function normalizeGuideContent(input: {
  guide: Guide;
  rawBlocks: NotionRawBlock[];
  pageTitleFromNotion?: string;
  pageMeta?: NotionPageMeta;
}): GuideContent {
  const toc: GuideTocItem[] = [];
  // 외부 TOC를 사용하지 않는 경우를 고려해, 본문 내 목차 섹션은 제거하지 않고 유지합니다.
  const blocks = normalizeBlocksInternal(input.rawBlocks, toc);
  const plainText = collectPlainTextFromBlocks(blocks);
  const excerpt = (input.guide.summary?.trim() || plainText).slice(0, 180);

  const { excerptText } = extractNotionSeoFromBlocks(input.rawBlocks, { maxExcerptLength: 2500 });

  const firstImage = blocks.find((block) => block.type === "image" || block.type === "image_group");
  const firstImageSrc =
    firstImage?.type === "image"
      ? firstImage.image.src
      : firstImage?.type === "image_group"
        ? firstImage.images[0]?.src
        : undefined;

  const notionCover = extractNotionCoverUrl(input.pageMeta);
  const ogImageFallback =
    input.guide.cover_image_url ||
    notionCover ||
    input.guide.thumbnail_url ||
    firstImageSrc;

  return {
    id: input.guide.id,
    slug: input.guide.slug ?? "",
    title: input.guide.title_override || input.guide.title || input.pageTitleFromNotion || "여행가이드",
    summary: input.guide.summary ?? undefined,
    excerpt,
    excerptText: excerptText || undefined,
    seoTitle: input.guide.seo_title?.trim() || null,
    seoDescription: input.guide.seo_description?.trim() || null,
    ogImage: ogImageFallback,
    coverImage: ogImageFallback,
    publishedAt: input.guide.published_at || input.guide.created_at || undefined,
    notionPageId: input.guide.notion_page_id || "",
    notionUrl: input.guide.notion_url ?? undefined,
    is_published: input.guide.is_published,
    notionLastEditedTime: input.guide.notion_last_edited_time ?? undefined,
    blocks,
    toc,
  };
}

