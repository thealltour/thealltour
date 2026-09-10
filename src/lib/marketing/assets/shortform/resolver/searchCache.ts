/**
 * Search metadata cache (Pixabay compliance: ≥24h).
 * Metadata JSON only — no binaries, not under MARKETING_ASSET_ROOT.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { SHORTFORM_PIXABAY_SEARCH_CACHE_TTL_MS } from "@/lib/marketing/assets/shortform/resolver/constants";

export type SourceSearchCache = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs?: number): Promise<void>;
};

type CacheEnvelope = {
  expiresAtMs: number;
  body: string;
};

export function defaultShortformSearchCacheDir(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string {
  const configured = env.SHORTFORM_SOURCE_SEARCH_CACHE_DIR?.trim();
  if (configured) return configured;
  return join(homedir(), ".cache", "thealltour-shortform-search");
}

export function createMemorySourceSearchCache(): SourceSearchCache {
  const map = new Map<string, CacheEnvelope>();
  return {
    async get(key) {
      const row = map.get(key);
      if (!row) return null;
      if (Date.now() >= row.expiresAtMs) {
        map.delete(key);
        return null;
      }
      return row.body;
    },
    async set(key, value, ttlMs = SHORTFORM_PIXABAY_SEARCH_CACHE_TTL_MS) {
      map.set(key, { body: value, expiresAtMs: Date.now() + ttlMs });
    },
  };
}

export function createFileSourceSearchCache(input?: {
  rootDir?: string;
}): SourceSearchCache {
  const rootDir = input?.rootDir ?? defaultShortformSearchCacheDir();
  mkdirSync(rootDir, { recursive: true });

  const pathFor = (key: string) => {
    const digest = createHash("sha256").update(key).digest("hex");
    return join(rootDir, `${digest}.json`);
  };

  return {
    async get(key) {
      const path = pathFor(key);
      if (!existsSync(path)) return null;
      try {
        const parsed = JSON.parse(readFileSync(path, "utf8")) as CacheEnvelope;
        if (!parsed || typeof parsed.body !== "string" || typeof parsed.expiresAtMs !== "number") {
          unlinkSync(path);
          return null;
        }
        if (Date.now() >= parsed.expiresAtMs) {
          unlinkSync(path);
          return null;
        }
        return parsed.body;
      } catch {
        return null;
      }
    },
    async set(key, value, ttlMs = SHORTFORM_PIXABAY_SEARCH_CACHE_TTL_MS) {
      const envelope: CacheEnvelope = {
        body: value,
        expiresAtMs: Date.now() + ttlMs,
      };
      atomicWriteFile(pathFor(key), Buffer.from(JSON.stringify(envelope), "utf8"));
    },
  };
}

export function cacheKeyForSearch(parts: Record<string, string>): string {
  return Object.keys(parts)
    .sort()
    .map((key) => `${key}=${parts[key]}`)
    .join("&");
}
