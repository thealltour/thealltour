import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AviasalesCacheStore } from "@/lib/affiliate/planner/providers/aviasales/aviasalesCache";

export const supabaseAviasalesCache: AviasalesCacheStore = {
  async readFresh(cacheKey) {
    try {
      const { data, error } = await supabaseAdmin
        .from("aviasales_api_cache")
        .select("payload_json")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error || !data) return null;
      return data.payload_json as never;
    } catch {
      return null;
    }
  },
  async readStale(cacheKey) {
    try {
      const { data, error } = await supabaseAdmin
        .from("aviasales_api_cache")
        .select("payload_json, fetched_at")
        .eq("cache_key", cacheKey)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      const fetchedAt = Date.parse(String(data.fetched_at ?? ""));
      return {
        payload: data.payload_json as never,
        fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : 0,
      };
    } catch {
      return null;
    }
  },
  async write(cacheKey, kind, payload, ttlMs) {
    try {
      const { error } = await supabaseAdmin.from("aviasales_api_cache").upsert(
        {
          cache_key: cacheKey,
          kind,
          payload_json: payload,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + ttlMs).toISOString(),
        },
        { onConflict: "cache_key" },
      );
      if (error) {
        console.info("[aviasales] cache_write_failed", {
          providerId: "aviasales",
          operation: "cache_write",
          errorCode: "db_error",
        });
      }
    } catch {
      console.info("[aviasales] cache_write_failed", {
        providerId: "aviasales",
        operation: "cache_write",
        errorCode: "db_exception",
      });
    }
  },
};
