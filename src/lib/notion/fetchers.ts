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

