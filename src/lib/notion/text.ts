import type { NotionRawBlock, NotionRichText } from "@/lib/notion/types";
import { getBlockRichText, slugifyHeading } from "@/lib/notion/types";

/**
 * Notion 블록에서 SEO용 plain text + TOC 추출 (크롤러 인덱싱용).
 * 스타일 재현이 아니라 본문에 넣을 텍스트/구조만 산출.
 */

const DEFAULT_MAX_EXCERPT_LENGTH = 2500;

function richTextToPlain(richText: NotionRichText[] | undefined): string {
  if (!Array.isArray(richText)) return "";
  return richText
    .map((item) => (item?.plain_text != null ? String(item.plain_text) : ""))
    .join("")
    .trim();
}

export type NotionSeoTocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type NotionSeoResult = {
  titleFromNotion?: string;
  excerptText: string;
  toc: NotionSeoTocItem[];
  notionLastEditedTime?: string;
};

type BlockAcc = {
  lines: string[];
  toc: NotionSeoTocItem[];
  length: number;
  maxLength: number;
};

function appendLine(acc: BlockAcc, line: string): void {
  if (acc.length >= acc.maxLength) return;
  const trimmed = line.trim();
  if (!trimmed) return;
  acc.lines.push(trimmed);
  acc.length += trimmed.length + 1;
}

function walkBlock(
  block: NotionRawBlock | undefined,
  acc: BlockAcc,
  listPrefix?: { bullet: string; index: number },
): void {
  if (!block || acc.length >= acc.maxLength) return;
  const type = block.type;

  if (type === "heading_1" || type === "heading_2" || type === "heading_3") {
    const rich = getBlockRichText(block, type);
    const text = richTextToPlain(rich);
    if (text) {
      const level = type === "heading_1" ? 1 : type === "heading_2" ? 2 : 3;
      const id = slugifyHeading(text, block.id ?? `h-${level}`);
      if (level >= 2) {
        acc.toc.push({ id, text, level: level as 2 | 3 });
      }
      appendLine(acc, "\n\n" + text + "\n");
    }
    return;
  }

  if (type === "paragraph") {
    const text = richTextToPlain(block.paragraph?.rich_text);
    if (text) appendLine(acc, text);
    return;
  }

  if (type === "bulleted_list_item") {
    const text = richTextToPlain(block.bulleted_list_item?.rich_text);
    if (text) appendLine(acc, (listPrefix?.bullet ?? "- ") + text);
    const children = block.children;
    if (Array.isArray(children) && children.length > 0) {
      children.forEach((ch) => walkBlock(ch, acc, { bullet: "  - ", index: 0 }));
    }
    return;
  }

  if (type === "numbered_list_item") {
    const text = richTextToPlain(block.numbered_list_item?.rich_text);
    if (text) appendLine(acc, (listPrefix ? `${listPrefix.index}. ` : "1. ") + text);
    const children = block.children;
    if (Array.isArray(children) && children.length > 0) {
      children.forEach((ch, i: number) =>
        walkBlock(ch, acc, { bullet: "", index: (listPrefix?.index ?? 1) + i + 1 }),
      );
    }
    return;
  }

  if (type === "quote") {
    const text = richTextToPlain(block.quote?.rich_text);
    if (text) appendLine(acc, "「 " + text + " 」");
    return;
  }

  if (type === "callout") {
    const text = richTextToPlain(block.callout?.rich_text);
    if (text) appendLine(acc, text);
    const children = block.children;
    if (Array.isArray(children)) {
      children.forEach((ch) => walkBlock(ch, acc));
    }
    return;
  }

  if (type === "column_list" && Array.isArray(block.children)) {
    block.children.forEach((col) => {
      if (Array.isArray(col?.children)) col.children.forEach((c) => walkBlock(c, acc));
    });
    return;
  }

  if (type === "table" && Array.isArray(block.children)) {
    block.children.forEach((row) => {
      const cells = row?.table_row?.cells;
      if (Array.isArray(cells)) {
        const rowText = cells.map((cell) => richTextToPlain(cell)).filter(Boolean).join(" ");
        if (rowText) appendLine(acc, rowText);
      }
    });
    return;
  }

  if (type === "divider") {
    appendLine(acc, "\n---\n");
    return;
  }

  if (Array.isArray(block.children)) {
    block.children.forEach((ch) => walkBlock(ch, acc, listPrefix));
  }
}

/**
 * Raw Notion blocks에서 SEO용 excerpt 텍스트와 TOC 추출
 */
export function extractNotionSeoFromBlocks(
  rawBlocks: NotionRawBlock[],
  options?: { maxExcerptLength?: number },
): { excerptText: string; toc: NotionSeoTocItem[] } {
  const maxLength = options?.maxExcerptLength ?? DEFAULT_MAX_EXCERPT_LENGTH;
  const acc: BlockAcc = { lines: [], toc: [], length: 0, maxLength };

  for (const block of rawBlocks) {
    walkBlock(block, acc);
    if (acc.length >= maxLength) break;
  }

  let excerptText = acc.lines.join("\n").trim();
  if (excerptText.length > maxLength) {
    excerptText = excerptText.slice(0, maxLength).trim();
    const lastSpace = excerptText.lastIndexOf(" ");
    if (lastSpace > maxLength * 0.8) {
      excerptText = excerptText.slice(0, lastSpace);
    }
    excerptText = excerptText + "…";
  }

  return { excerptText, toc: acc.toc };
}
