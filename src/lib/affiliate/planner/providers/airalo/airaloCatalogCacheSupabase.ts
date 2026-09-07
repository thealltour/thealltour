import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isAiraloRecordArray,
  type AiraloCatalogCacheStore,
} from "@/lib/affiliate/planner/providers/airalo/airaloCatalogCache";
import { AIRALO_CATALOG_TTL_MS } from "@/lib/affiliate/planner/providers/airalo/airaloTypes";

export const supabaseAiraloCatalogCache: AiraloCatalogCacheStore = {
  async readFresh(cacheKey) {
    try {
      const { data, error } = await supabaseAdmin
        .from("airalo_esim_catalog_cache")
        .select("records_json")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (error || !data) return null;
      return isAiraloRecordArray(data.records_json) ? data.records_json : null;
    } catch {
      return null;
    }
  },
  async readStale(cacheKey) {
    try {
      const { data, error } = await supabaseAdmin
        .from("airalo_esim_catalog_cache")
        .select("records_json")
        .eq("cache_key", cacheKey)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return isAiraloRecordArray(data.records_json) ? data.records_json : null;
    } catch {
      return null;
    }
  },
  async write(cacheKey, records, ttlMs = AIRALO_CATALOG_TTL_MS) {
    try {
      const { error } = await supabaseAdmin.from("airalo_esim_catalog_cache").upsert(
        {
          cache_key: cacheKey,
          records_json: records,
          record_count: records.length,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + ttlMs).toISOString(),
        },
        { onConflict: "cache_key" },
      );
      if (error) {
        console.info("[airalo] catalog_cache_write_failed", {
          providerId: "airalo",
          operation: "cache_write",
          errorCode: "db_error",
        });
      }
    } catch {
      console.info("[airalo] catalog_cache_write_failed", {
        providerId: "airalo",
        operation: "cache_write",
        errorCode: "db_exception",
      });
    }
  },
};
