import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  AGENDA_QUALITY_V2_PROMPT_VERSION,
  AGENDA_QUALITY_V2_TRANSFORM_REVISION,
} from "@/lib/marketing/agendaQualityV2/shadow/config";
import type { MarketingAgendaTransformerLlmOutput } from "@/lib/marketing/agendaQualityV2/contracts";

export type TransformCacheEntry = {
  cacheKey: string;
  sourceFingerprint: string;
  transformRevision: string;
  promptVersion: string;
  llm: MarketingAgendaTransformerLlmOutput;
  transformModel: string | null;
  transformProvider: string | null;
  transformRouteSource: string | null;
  cachedAt: string;
};

export type AgendaTransformCache = {
  get(cacheKey: string): Promise<TransformCacheEntry | null>;
  set(entry: TransformCacheEntry): Promise<void>;
};

export function buildAgendaTransformCacheKey(params: {
  sourceFingerprint: string;
  sourceCandidateId?: string | null;
  transformRevision?: string;
  promptVersion?: string;
}): string {
  const material = JSON.stringify({
    fp: params.sourceFingerprint,
    id: params.sourceCandidateId ?? "",
    rev: params.transformRevision ?? AGENDA_QUALITY_V2_TRANSFORM_REVISION,
    prompt: params.promptVersion ?? AGENDA_QUALITY_V2_PROMPT_VERSION,
  });
  return `tcache_${createHash("sha256").update(material).digest("hex").slice(0, 24)}`;
}

export function createInMemoryAgendaTransformCache(): AgendaTransformCache {
  const map = new Map<string, TransformCacheEntry>();
  return {
    async get(cacheKey) {
      return map.get(cacheKey) ?? null;
    },
    async set(entry) {
      map.set(entry.cacheKey, entry);
    },
  };
}

export function createJsonFileAgendaTransformCache(params: {
  filePath: string;
}): AgendaTransformCache {
  let cache: Map<string, TransformCacheEntry> | null = null;

  async function load(): Promise<Map<string, TransformCacheEntry>> {
    if (cache) return cache;
    try {
      const raw = await fs.readFile(params.filePath, "utf8");
      const parsed = JSON.parse(raw) as TransformCacheEntry[];
      cache = new Map(parsed.map((e) => [e.cacheKey, e]));
    } catch {
      cache = new Map();
    }
    return cache;
  }

  async function persist(map: Map<string, TransformCacheEntry>): Promise<void> {
    await fs.mkdir(path.dirname(params.filePath), { recursive: true });
    await fs.writeFile(params.filePath, JSON.stringify([...map.values()], null, 2), "utf8");
  }

  return {
    async get(cacheKey) {
      const map = await load();
      return map.get(cacheKey) ?? null;
    },
    async set(entry) {
      const map = await load();
      map.set(entry.cacheKey, entry);
      await persist(map);
    },
  };
}
