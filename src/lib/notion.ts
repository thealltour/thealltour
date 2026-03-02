import { Client } from "@notionhq/client";

const NOTION_TOKEN = process.env.NOTION_TOKEN;

const notionClient = NOTION_TOKEN
  ? new Client({ auth: NOTION_TOKEN })
  : null;

export function ensureNotionClient() {
  if (!notionClient) {
    throw new Error("NOTION_TOKEN 환경변수가 설정되어 있지 않습니다.");
  }
  return notionClient;
}

export function extractNotionPageId(notionUrl: string): string | null {
  if (!notionUrl) return null;
  try {
    const url = new URL(notionUrl.trim());
    const lastSegment = url.pathname.split("/").filter(Boolean).pop() ?? "";
    const match = lastSegment.match(/([0-9a-fA-F]{32})$/);
    if (match) {
      // 32자리 하이픈 없는 ID -> 하이픈 포함 형식으로 변환
      const raw = match[1].toLowerCase();
      return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
    }
    // 이미 하이픈 포함 형식인 경우
    if (/^[0-9a-fA-F-]{36}$/.test(lastSegment)) {
      return lastSegment.toLowerCase();
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchNotionPageMeta(pageId: string) {
  const client = ensureNotionClient();
  const page = await client.pages.retrieve({ page_id: pageId });
  return page as any;
}

export async function fetchNotionBlocks(pageId: string) {
  const client = ensureNotionClient();
  const blocks: any[] = [];
  let cursor: string | undefined;

  // 기본 children을 paging으로 수집
  do {
    const response = await client.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });

    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return blocks;
}

