import { ensureNotionClient } from "@/lib/notion/client";

export function extractNotionPageId(notionUrl: string): string | null {
  if (!notionUrl) return null;
  try {
    const url = new URL(notionUrl.trim());
    const lastSegment = url.pathname.split("/").filter(Boolean).pop() ?? "";
    const match = lastSegment.match(/([0-9a-fA-F]{32})$/);
    if (match) {
      const raw = match[1].toLowerCase();
      return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
    }
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

/** Notion Integration으로 해당 페이지 접근 가능 여부 검증 (등록/수정 시 호출) */
export async function validateNotionPageAccess(
  pageId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await fetchNotionPageMeta(pageId);
    return { ok: true };
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "";
    if (/could not find|not found|404|403|unauthorized|restrict/i.test(msg)) {
      return {
        ok: false,
        message:
          "Notion Integration에 공유되지 않은 페이지입니다. 노션에서 해당 페이지를 연동된 Integration에 공유해 주세요.",
      };
    }
    return {
      ok: false,
      message: msg || "노션 페이지에 접근할 수 없습니다. Integration 설정을 확인해 주세요.",
    };
  }
}

export async function fetchNotionBlocks(pageId: string) {
  const client = ensureNotionClient();

  async function listBlockChildren(blockId: string): Promise<any[]> {
    const blocks: any[] = [];
    let cursor: string | undefined;

    do {
      const response = await client.blocks.children.list({
        block_id: blockId,
        start_cursor: cursor,
        page_size: 100,
      });

      blocks.push(...response.results);
      cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);

    return blocks;
  }

  async function attachChildrenRecursive(items: any[]): Promise<any[]> {
    const next = await Promise.all(
      items.map(async (block) => {
        if (block?.has_children && block?.id) {
          const children = await listBlockChildren(block.id);
          return {
            ...block,
            children: await attachChildrenRecursive(children),
          };
        }
        return block;
      }),
    );
    return next;
  }

  const topLevelBlocks = await listBlockChildren(pageId);
  return attachChildrenRecursive(topLevelBlocks);
}

