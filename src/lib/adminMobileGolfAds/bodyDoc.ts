import type { MobileGolfAdFontSize, MobileGolfAdSectionStyle, MobileGolfAdStyleConfig } from "@/lib/adminMobileGolfAds/types";
import { DEFAULT_MOBILE_GOLF_AD_STYLE_CONFIG } from "@/lib/adminMobileGolfAds/types";

export type MobileGolfAdBodyMark =
  | { type: "bold" }
  | { type: "fontSize"; attrs: { size: MobileGolfAdFontSize } }
  | { type: "textColor"; attrs: { color: string } }
  | { type: "highlightBox"; attrs: { backgroundColor: string; roundBox: boolean } };

export type MobileGolfAdBodyTextNode = {
  type: "text";
  text: string;
  marks?: MobileGolfAdBodyMark[];
};

export type MobileGolfAdBodyParagraphNode = {
  type: "paragraph";
  content?: MobileGolfAdBodyTextNode[];
};

export type GolfProductRailSource = "home_default" | "custom";

export type GolfProductRailAttrs = {
  source: GolfProductRailSource;
  productIds: string[];
  eyebrow: string;
  title: string;
  description: string;
};

export type MobileGolfAdGolfProductRailNode = {
  type: "golfProductRail";
  attrs: GolfProductRailAttrs;
};

export type MobileGolfAdBodyBlockNode =
  | MobileGolfAdBodyParagraphNode
  | MobileGolfAdGolfProductRailNode;

export type MobileGolfAdBodyDoc = {
  type: "doc";
  content: MobileGolfAdBodyBlockNode[];
};

export const EMPTY_MOBILE_GOLF_AD_BODY_DOC: MobileGolfAdBodyDoc = {
  type: "doc",
  content: [],
};

export const DEFAULT_GOLF_RAIL_EYEBROW = "GOLF TOURS";
export const DEFAULT_GOLF_RAIL_TITLE = "추천 골프투어";
export const DEFAULT_GOLF_RAIL_DESCRIPTION = "인기 골프·파크골프 여행을 만나보세요.";
export const MAX_GOLF_RAIL_PRODUCTS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFontSize(raw: unknown): MobileGolfAdFontSize | null {
  return raw === "sm" || raw === "md" || raw === "lg" ? raw : null;
}

function parseMark(raw: unknown): MobileGolfAdBodyMark | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;
  if (raw.type === "bold") return { type: "bold" };
  if (raw.type === "fontSize" && isRecord(raw.attrs)) {
    const size = parseFontSize(raw.attrs.size);
    if (!size) return null;
    return { type: "fontSize", attrs: { size } };
  }
  if (raw.type === "textColor" && isRecord(raw.attrs) && typeof raw.attrs.color === "string") {
    const color = raw.attrs.color.trim();
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return null;
    return { type: "textColor", attrs: { color: color.toLowerCase() } };
  }
  if (raw.type === "highlightBox" && isRecord(raw.attrs)) {
    const backgroundColor =
      typeof raw.attrs.backgroundColor === "string" ? raw.attrs.backgroundColor.trim() : "#f8fafc";
    const roundBox = raw.attrs.roundBox === true;
    if (!/^#[0-9a-fA-F]{6}$/.test(backgroundColor)) return null;
    return {
      type: "highlightBox",
      attrs: { backgroundColor: backgroundColor.toLowerCase(), roundBox },
    };
  }
  return null;
}

function parseTextNode(raw: unknown): MobileGolfAdBodyTextNode | null {
  if (!isRecord(raw) || raw.type !== "text" || typeof raw.text !== "string") return null;
  const marks = Array.isArray(raw.marks)
    ? raw.marks.map(parseMark).filter((m): m is MobileGolfAdBodyMark => m != null)
    : undefined;
  return marks?.length ? { type: "text", text: raw.text, marks } : { type: "text", text: raw.text };
}

function parseParagraphNode(raw: unknown): MobileGolfAdBodyParagraphNode | null {
  if (!isRecord(raw) || raw.type !== "paragraph") return null;
  const content = Array.isArray(raw.content)
    ? raw.content.map(parseTextNode).filter((n): n is MobileGolfAdBodyTextNode => n != null)
    : [];
  return { type: "paragraph", content };
}

function parseGolfProductRailNode(raw: unknown): MobileGolfAdGolfProductRailNode | null {
  if (!isRecord(raw) || raw.type !== "golfProductRail" || !isRecord(raw.attrs)) return null;
  const source: GolfProductRailSource =
    raw.attrs.source === "custom" ? "custom" : "home_default";
  const productIds = Array.isArray(raw.attrs.productIds)
    ? raw.attrs.productIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, MAX_GOLF_RAIL_PRODUCTS)
    : [];
  return {
    type: "golfProductRail",
    attrs: {
      source,
      productIds,
      eyebrow:
        typeof raw.attrs.eyebrow === "string" && raw.attrs.eyebrow.trim()
          ? raw.attrs.eyebrow.trim()
          : DEFAULT_GOLF_RAIL_EYEBROW,
      title:
        typeof raw.attrs.title === "string" && raw.attrs.title.trim()
          ? raw.attrs.title.trim()
          : DEFAULT_GOLF_RAIL_TITLE,
      description:
        typeof raw.attrs.description === "string" ? raw.attrs.description.trim() : DEFAULT_GOLF_RAIL_DESCRIPTION,
    },
  };
}

function parseBlockNode(raw: unknown): MobileGolfAdBodyBlockNode | null {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;
  if (raw.type === "paragraph") return parseParagraphNode(raw);
  if (raw.type === "golfProductRail") return parseGolfProductRailNode(raw);
  return null;
}

export function parseMobileGolfAdBodyDoc(raw: unknown): MobileGolfAdBodyDoc {
  if (!isRecord(raw) || raw.type !== "doc") return { ...EMPTY_MOBILE_GOLF_AD_BODY_DOC, content: [] };
  const content = Array.isArray(raw.content)
    ? raw.content.map(parseBlockNode).filter((n): n is MobileGolfAdBodyBlockNode => n != null)
    : [];
  return { type: "doc", content };
}

export function isBodyDocEmpty(doc: MobileGolfAdBodyDoc): boolean {
  if (doc.content.length === 0) return true;
  return doc.content.every((block) => {
    if (block.type === "golfProductRail") return false;
    return !block.content?.some((t) => t.text.trim().length > 0);
  });
}

function sectionStyleToMarks(style: MobileGolfAdSectionStyle, bold: boolean): MobileGolfAdBodyMark[] {
  const marks: MobileGolfAdBodyMark[] = [];
  if (bold) marks.push({ type: "bold" });
  marks.push({ type: "fontSize", attrs: { size: style.fontSize } });
  if (style.accentColor) marks.push({ type: "textColor", attrs: { color: style.accentColor } });
  if (style.roundBox) {
    marks.push({
      type: "highlightBox",
      attrs: { backgroundColor: "#f8fafc", roundBox: true },
    });
  }
  return marks;
}

function textToParagraph(text: string, marks: MobileGolfAdBodyMark[]): MobileGolfAdBodyParagraphNode {
  const lines = text.split("\n");
  if (lines.length <= 1) {
    return {
      type: "paragraph",
      content: text ? [{ type: "text", text, marks }] : [],
    };
  }
  // Multi-line: single paragraph with hard breaks simulated as separate paragraphs
  return {
    type: "paragraph",
    content: text ? [{ type: "text", text, marks }] : [],
  };
}

export function migrateLegacyMobileGolfAdToBodyDoc(input: {
  benefitText: string;
  trustActionText: string;
  styleConfig: MobileGolfAdStyleConfig;
}): MobileGolfAdBodyDoc {
  const content: MobileGolfAdBodyBlockNode[] = [];
  const benefit = input.benefitText.trim();
  const trust = input.trustActionText.trim();

  if (benefit) {
    for (const line of benefit.split("\n")) {
      if (!line.trim() && content.length > 0) {
        content.push({ type: "paragraph", content: [] });
        continue;
      }
      if (line.trim()) {
        content.push(
          textToParagraph(line, sectionStyleToMarks(input.styleConfig.benefit, true)),
        );
      }
    }
  }

  if (benefit && trust) {
    content.push({ type: "paragraph", content: [] });
  }

  if (trust) {
    for (const line of trust.split("\n")) {
      if (!line.trim() && content.length > 0) {
        content.push({ type: "paragraph", content: [] });
        continue;
      }
      if (line.trim()) {
        content.push(
          textToParagraph(line, sectionStyleToMarks(input.styleConfig.trust, false)),
        );
      }
    }
  }

  return { type: "doc", content };
}

export function resolveMobileGolfAdBodyDoc(
  bodyDocRaw: unknown,
  legacy: {
    benefitText: string;
    trustActionText: string;
    styleConfig: MobileGolfAdStyleConfig;
  },
): MobileGolfAdBodyDoc {
  const parsed = parseMobileGolfAdBodyDoc(bodyDocRaw);
  if (!isBodyDocEmpty(parsed)) return parsed;
  if (legacy.benefitText.trim() || legacy.trustActionText.trim()) {
    return migrateLegacyMobileGolfAdToBodyDoc(legacy);
  }
  return { type: "doc", content: [{ type: "paragraph", content: [] }] };
}

export function extractPlainTextFromBodyDoc(doc: MobileGolfAdBodyDoc): string {
  const parts: string[] = [];
  for (const block of doc.content) {
    if (block.type === "golfProductRail") continue;
    const line = (block.content ?? []).map((t) => t.text).join("");
    if (line.trim()) parts.push(line);
  }
  return parts.join("\n");
}

export function collectGolfProductRailNodes(
  doc: MobileGolfAdBodyDoc,
): MobileGolfAdGolfProductRailNode[] {
  return doc.content.filter(
    (block): block is MobileGolfAdGolfProductRailNode => block.type === "golfProductRail",
  );
}

export function createDefaultGolfProductRailNode(): MobileGolfAdGolfProductRailNode {
  return {
    type: "golfProductRail",
    attrs: {
      source: "home_default",
      productIds: [],
      eyebrow: DEFAULT_GOLF_RAIL_EYEBROW,
      title: DEFAULT_GOLF_RAIL_TITLE,
      description: DEFAULT_GOLF_RAIL_DESCRIPTION,
    },
  };
}

/** TipTap editor empty document */
export function createEmptyTipTapBodyDoc(): MobileGolfAdBodyDoc {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  };
}

export function deriveLegacyFieldsFromBodyDoc(doc: MobileGolfAdBodyDoc): {
  benefitText: string;
  trustActionText: string;
} {
  const paragraphs = doc.content.filter(
    (b): b is MobileGolfAdBodyParagraphNode => b.type === "paragraph",
  );
  const texts = paragraphs
    .map((p) => (p.content ?? []).map((t) => t.text).join(""))
    .filter((t) => t.trim().length > 0);

  if (texts.length === 0) {
    return { benefitText: "", trustActionText: "" };
  }
  if (texts.length === 1) {
    return { benefitText: texts[0] ?? "", trustActionText: texts[0] ?? "" };
  }
  const midpoint = Math.ceil(texts.length / 2);
  return {
    benefitText: texts.slice(0, midpoint).join("\n"),
    trustActionText: texts.slice(midpoint).join("\n"),
  };
}

export function deriveStyleConfigFromBodyDoc(
  doc: MobileGolfAdBodyDoc,
): MobileGolfAdStyleConfig {
  const paragraphs = doc.content.filter(
    (b): b is MobileGolfAdBodyParagraphNode => b.type === "paragraph",
  );
  const benefitParagraph = paragraphs.find((p) =>
    (p.content ?? []).some((t) => t.marks?.some((m) => m.type === "bold")),
  );
  const trustParagraph = paragraphs.find(
    (p) => !(p.content ?? []).some((t) => t.marks?.some((m) => m.type === "bold")),
  );

  const fromMarks = (p: MobileGolfAdBodyParagraphNode | undefined, fallback: MobileGolfAdSectionStyle) => {
    if (!p?.content?.length) return { ...fallback };
    const marks = p.content[0]?.marks ?? [];
    let fontSize = fallback.fontSize;
    let accentColor = fallback.accentColor;
    let roundBox = fallback.roundBox;
    for (const mark of marks) {
      if (mark.type === "fontSize") fontSize = mark.attrs.size;
      if (mark.type === "textColor") accentColor = mark.attrs.color;
      if (mark.type === "highlightBox") roundBox = mark.attrs.roundBox;
    }
    return { fontSize, accentColor, roundBox };
  };

  return {
    benefit: fromMarks(benefitParagraph, DEFAULT_MOBILE_GOLF_AD_STYLE_CONFIG.benefit),
    trust: fromMarks(trustParagraph, DEFAULT_MOBILE_GOLF_AD_STYLE_CONFIG.trust),
  };
}
