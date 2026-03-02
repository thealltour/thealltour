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

