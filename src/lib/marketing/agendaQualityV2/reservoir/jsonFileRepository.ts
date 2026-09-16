import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AgendaReservoirItem,
  AgendaReservoirListFilter,
  DurableAgendaReservoirRepository,
} from "@/lib/marketing/agendaQualityV2/reservoir/types";
import { assertAgendaReservoirShadowPayload } from "@/lib/marketing/agendaQualityV2/reservoir/types";

function filterItems(
  all: AgendaReservoirItem[],
  filter?: AgendaReservoirListFilter,
): AgendaReservoirItem[] {
  let rows = all;
  if (filter?.status) {
    const allowed = new Set(Array.isArray(filter.status) ? filter.status : [filter.status]);
    rows = rows.filter((item) => allowed.has(item.status));
  }
  if (filter?.topicFingerprint) {
    rows = rows.filter((item) => item.topicFingerprint === filter.topicFingerprint);
  }
  if (filter?.decisionAxisFingerprint) {
    rows = rows.filter((item) => item.decisionAxisFingerprint === filter.decisionAxisFingerprint);
  }
  if (filter?.sinceIso) {
    rows = rows.filter((item) => item.lastSeenAt >= filter.sinceIso!);
  }
  return rows;
}

/**
 * JSON-file durable reservoir for Phase-2 shadow testing without requiring Supabase.
 */
export function createJsonFileAgendaReservoir(params: {
  filePath: string;
}): DurableAgendaReservoirRepository {
  const filePath = params.filePath;
  let cache: Map<string, AgendaReservoirItem> | null = null;

  async function load(): Promise<Map<string, AgendaReservoirItem>> {
    if (cache) return cache;
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as AgendaReservoirItem[];
      cache = new Map(parsed.map((item) => [item.agendaId, item]));
    } catch {
      cache = new Map();
    }
    return cache;
  }

  async function persist(map: Map<string, AgendaReservoirItem>): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const rows = [...map.values()];
    await fs.writeFile(filePath, JSON.stringify(rows, null, 2), "utf8");
  }

  return {
    async get(agendaId) {
      const map = await load();
      return map.get(agendaId) ?? null;
    },
    async upsert(item) {
      assertAgendaReservoirShadowPayload(item);
      const map = await load();
      map.set(item.agendaId, item);
      await persist(map);
    },
    async list(filter) {
      const map = await load();
      return filterItems([...map.values()], filter);
    },
    async listRecent(params) {
      const map = await load();
      let rows = [...map.values()];
      if (params?.sinceIso) rows = rows.filter((r) => r.lastSeenAt >= params.sinceIso!);
      rows.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
      return rows.slice(0, params?.limit ?? 200);
    },
  };
}
