import type { ContentHistoryItem } from "@/lib/marketing/context/types";
import {
  CONTENT_MEMORY_AI_SOURCE_TYPE,
  CONTENT_MEMORY_CONFIDENCE,
  CONTENT_MEMORY_IMPORTANCE_DEFAULT,
  CONTENT_MEMORY_IMPORTANCE_OLD,
  CONTENT_MEMORY_IMPORTANCE_RECENT,
  CONTENT_MEMORY_MAX_BODY_CHARS,
  CONTENT_MEMORY_MAX_CHARS,
  CONTENT_MEMORY_RECENT_DAYS,
  CONTENT_MEMORY_TYPE,
} from "@/lib/marketing/memory/constants";
import { normalizeMemoryText } from "@/lib/marketing/memory/normalization";
import type { MemoryDocument } from "@/lib/marketing/memory/types";

export type ContentMemoryMappingInput = {
  history: ContentHistoryItem;
  channels: string[];
  publishedAt: string | null;
  productTitle: string | null;
  campaignName: string | null;
  agendaTopic: string | null;
  agendaKey: string | null;
  hook: string | null;
  cta: string | null;
};

const HTML_ENTITY: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};

export function stripHtmlToMemoryText(value: string | null | undefined): string {
  if (!value) return "";
  const withoutMarkup = value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => decodeHtmlEntity(entity));
  return normalizeMemoryText(withoutMarkup);
}

function decodeHtmlEntity(entity: string): string {
  const named = HTML_ENTITY[entity.toLowerCase()];
  if (named) return named;
  if (entity.startsWith("#x") || entity.startsWith("#X")) {
    const code = Number.parseInt(entity.slice(2), 16);
    return Number.isFinite(code) ? String.fromCharCode(code) : "";
  }
  if (entity.startsWith("#")) {
    const code = Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(code) ? String.fromCharCode(code) : "";
  }
  return "";
}

export function truncateMemoryText(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars).trimEnd();
}

export function hasContentMemoryText(input: {
  title?: string | null;
  body?: string | null;
  summary?: string | null;
  hook?: string | null;
  cta?: string | null;
}): boolean {
  return [input.title, input.body, input.summary, input.hook, input.cta].some(
    (value) => stripHtmlToMemoryText(value).length > 0,
  );
}

export function uniqueContentChannels(channels: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const channel of channels) {
    const key = channel?.trim().toLowerCase();
    if (!key) continue;
    seen.add(key);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export function contentPublishedDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function contentMemoryImportance(publishedAt: string | null, now: Date): number {
  const day = contentPublishedDate(publishedAt);
  if (!day) return CONTENT_MEMORY_IMPORTANCE_DEFAULT;
  const published = Date.parse(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(published)) return CONTENT_MEMORY_IMPORTANCE_DEFAULT;
  const ageMs = now.getTime() - published;
  if (ageMs < 0) return CONTENT_MEMORY_IMPORTANCE_RECENT;
  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  if (ageDays <= CONTENT_MEMORY_RECENT_DAYS) return CONTENT_MEMORY_IMPORTANCE_RECENT;
  return CONTENT_MEMORY_IMPORTANCE_OLD;
}

function line(label: string, value: string | null | undefined): string | null {
  const text = stripHtmlToMemoryText(value);
  return text ? `${label}: ${text}` : null;
}

function block(label: string, value: string | null | undefined): string | null {
  const text = stripHtmlToMemoryText(value);
  return text ? `${label}:\n${text}` : null;
}

export function buildContentMemoryContent(input: ContentMemoryMappingInput): string {
  const title = stripHtmlToMemoryText(input.history.title);
  const summary = stripHtmlToMemoryText(input.history.summary);
  const hook = stripHtmlToMemoryText(input.hook);
  const cta = stripHtmlToMemoryText(input.cta);
  const channels = uniqueContentChannels(input.channels);
  const header = [
    title ? `제목: ${title}` : null,
    channels.length > 0 ? `채널: ${channels.join(", ")}` : null,
    line("게시일", contentPublishedDate(input.publishedAt)),
    line("상품", input.productTitle),
    line("주제", input.agendaTopic),
    line("아젠다", input.agendaKey),
    line("캠페인", input.campaignName),
  ].filter((item): item is string => Boolean(item));
  const footer = [block("요약", summary), block("훅", hook), block("CTA", cta)].filter(
    (item): item is string => Boolean(item),
  );
  const headerText = header.join("\n");
  const footerText = footer.join("\n\n");
  const reserved = headerText.length + (footerText ? footerText.length + 2 : 0) + 8;
  const bodyBudget = Math.max(0, Math.min(CONTENT_MEMORY_MAX_BODY_CHARS, CONTENT_MEMORY_MAX_CHARS - reserved));
  const body = truncateMemoryText(stripHtmlToMemoryText(input.history.body), bodyBudget);
  const sections = [...header, body ? `본문:\n${body}` : null, ...footer].filter(
    (item): item is string => Boolean(item),
  );
  return truncateMemoryText(sections.join("\n\n"), CONTENT_MEMORY_MAX_CHARS);
}

export function mapContentToMemoryDocument(
  input: ContentMemoryMappingInput,
  now: Date = new Date(),
): MemoryDocument | null {
  if (input.history.sourceType === "thread_marketing_post") return null;
  if (
    !hasContentMemoryText({
      title: input.history.title,
      body: input.history.body,
      summary: input.history.summary,
      hook: input.hook,
      cta: input.cta,
    })
  ) {
    return null;
  }
  const content = buildContentMemoryContent(input);
  if (!content) return null;
  const publishedAt = contentPublishedDate(input.publishedAt) ?? contentPublishedDate(input.history.createdAt);
  const title = stripHtmlToMemoryText(input.history.title) || "콘텐츠";
  const channels = uniqueContentChannels(input.channels);
  return {
    memoryType: CONTENT_MEMORY_TYPE,
    title,
    content,
    sourceType: input.history.sourceType || CONTENT_MEMORY_AI_SOURCE_TYPE,
    sourceId: input.history.sourceId,
    importance: contentMemoryImportance(publishedAt, now),
    confidence: CONTENT_MEMORY_CONFIDENCE,
    expiresAt: null,
    metadata: {
      contentId: input.history.id,
      source: input.history.sourceType,
      channels,
      productId: input.history.productId,
      campaignName: input.campaignName,
      agendaKey: input.agendaKey,
      publishedAt,
    },
  };
}
