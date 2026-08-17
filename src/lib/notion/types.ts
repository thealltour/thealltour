export type NotionRichText = {
  plain_text?: string;
  href?: string | null;
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    code?: boolean;
    color?: string;
  };
};

/**
 * Notion API가 반환하는 raw block 구조 (필요한 필드만 명시, 그 외는 index signature로 허용).
 * `@notionhq/client`의 discriminated union 전체를 그대로 옮기지 않고,
 * 이 코드베이스가 실제로 사용하는 필드만 좁게 타입해 any를 제거하는 목적.
 */
export type NotionRawBlock = {
  id?: string;
  type: string;
  has_children?: boolean;
  children?: NotionRawBlock[];
  heading_1?: { rich_text?: NotionRichText[] };
  heading_2?: { rich_text?: NotionRichText[] };
  heading_3?: { rich_text?: NotionRichText[] };
  paragraph?: { rich_text?: NotionRichText[] };
  bulleted_list_item?: { rich_text?: NotionRichText[] };
  numbered_list_item?: { rich_text?: NotionRichText[] };
  quote?: { rich_text?: NotionRichText[] };
  callout?: { rich_text?: NotionRichText[]; icon?: { emoji?: string } };
  table?: { has_column_header?: boolean; has_row_header?: boolean };
  table_row?: { cells?: NotionRichText[][] };
  image?: {
    type?: string;
    external?: { url?: string };
    file?: { url?: string };
    caption?: NotionRichText[];
  };
  [key: string]: unknown;
};

export type NotionPropertyValue = {
  type: string;
  title?: NotionRichText[];
  [key: string]: unknown;
};

/** `client.pages.retrieve()` 응답 중 이 코드베이스가 실제로 읽는 필드만 좁게 타입 */
export type NotionPageMeta = {
  id?: string;
  last_edited_time?: string;
  cover?: {
    type?: string;
    external?: { url?: string };
    file?: { url?: string };
  } | null;
  properties?: Record<string, NotionPropertyValue>;
};

/**
 * 동적 키(`block[type]`)로 rich_text를 읽어야 하는 지점 전용 헬퍼.
 * NotionRawBlock의 index signature(unknown)를 여기 한 곳에서만 narrow한다.
 */
export function getBlockRichText(block: NotionRawBlock, key: string): NotionRichText[] {
  const value = block[key];
  if (value && typeof value === "object" && Array.isArray((value as { rich_text?: unknown }).rich_text)) {
    return (value as { rich_text: NotionRichText[] }).rich_text;
  }
  return [];
}

/** 헤딩 텍스트 → anchor id (notion/text.ts, notion/normalize.ts 공용) */
export function slugifyHeading(text: string, fallbackId: string): string {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return normalized || fallbackId;
}

/** Notion 페이지 커버 URL 추출 (notion/normalize.ts, notionSync.ts 공용) */
export function extractNotionCoverUrl(pageMeta: NotionPageMeta | null | undefined): string | undefined {
  const cover = pageMeta?.cover;
  if (!cover) return undefined;
  if (cover.type === "external" && cover.external?.url) return cover.external.url;
  if (cover.type === "file" && cover.file?.url) return cover.file.url;
  return undefined;
}

/** Notion 페이지 properties에서 title 속성의 plain text 추출 (notion/cache.ts, notionSync.ts 공용) */
export function extractNotionTitleFromProperties(
  properties: Record<string, NotionPropertyValue> | undefined,
): string {
  if (!properties) return "";
  for (const value of Object.values(properties)) {
    if (value?.type === "title" && Array.isArray(value.title) && value.title[0]?.plain_text) {
      return value.title.map((item) => item.plain_text ?? "").join("");
    }
  }
  return "";
}

export type GuideImage = {
  src: string;
  width?: number;
  height?: number;
  alt: string;
  caption?: string;
};

export type GuideBlock =
  | {
      type: "heading";
      id: string;
      level: 1 | 2 | 3;
      richText: NotionRichText[];
    }
  | {
      type: "paragraph";
      id: string;
      richText: NotionRichText[];
    }
  | {
      type: "list";
      id: string;
      ordered: boolean;
      items: Array<{
        id: string;
        richText: NotionRichText[];
        children: GuideBlock[];
      }>;
    }
  | {
      type: "quote";
      id: string;
      richText: NotionRichText[];
    }
  | {
      type: "callout";
      id: string;
      icon?: string;
      richText: NotionRichText[];
      children: GuideBlock[];
    }
  | {
      type: "image";
      id: string;
      image: GuideImage;
    }
  | {
      type: "image_group";
      id: string;
      groupId: string;
      images: GuideImage[];
    }
  | {
      type: "columns";
      id: string;
      columns: Array<{
        id: string;
        blocks: GuideBlock[];
      }>;
    }
  | {
      type: "table";
      id: string;
      hasColumnHeader: boolean;
      hasRowHeader: boolean;
      rows: Array<{
        id: string;
        cells: NotionRichText[][];
      }>;
    }
  | {
      type: "divider";
      id: string;
    };

export type GuideTocItem = {
  id: string;
  level: 2 | 3;
  text: string;
};

export type GuideContent = {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  excerpt: string;
  /** SEO 본문용 장문 텍스트(노션 블록에서 추출, 1500~3000자 수준) */
  excerptText?: string;
  /** SEO용 제목 (비우면 title 사용) */
  seoTitle?: string | null;
  /** meta description (비우면 excerptText 160자 또는 summary 사용) */
  seoDescription?: string | null;
  ogImage?: string;
  coverImage?: string;
  publishedAt?: string;
  /** 원문 보기 iframe용 공유 URL */
  notionUrl?: string;
  is_published?: boolean;
  notionPageId: string;
  /** 노션 최종 수정 시각 (JSON-LD dateModified용) */
  notionLastEditedTime?: string;
  blocks: GuideBlock[];
  toc: GuideTocItem[];
};

