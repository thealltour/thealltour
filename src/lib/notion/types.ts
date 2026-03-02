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
  ogImage?: string;
  coverImage?: string;
  publishedAt?: string;
  notionPageId: string;
  blocks: GuideBlock[];
  toc: GuideTocItem[];
};

