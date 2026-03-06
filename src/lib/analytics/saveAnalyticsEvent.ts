/**
 * Analytics 이벤트 저장 레이어.
 * 실패 시 throw 하지 않고 로깅 후 결과만 반환하여 기존 UX에 영향을 주지 않는다.
 */

import { supabase } from "@/lib/supabase";
import type { AnalyticsPayload } from "./types";

export type SaveAnalyticsEventResult =
  | { success: true }
  | { success: false; error: string };

/** Payload → DB row (snake_case). API route에서 supabaseAdmin insert 시 사용. */
export function toRow(payload: AnalyticsPayload): Record<string, unknown> {
  return {
    event_name: payload.eventName,
    source: payload.source,
    page_path: payload.pagePath ?? null,
    device_type: payload.deviceType ?? null,
    taxonomy_type: payload.taxonomyType ?? null,
    taxonomy_id: payload.taxonomyId ?? null,
    taxonomy_slug: payload.taxonomySlug ?? null,
    taxonomy_name: payload.taxonomyName ?? null,
    section: payload.section ?? null,
    label: payload.label ?? null,
    href: payload.href ?? null,
    position: payload.position ?? null,
    query: payload.query ?? null,
    result_count: payload.resultCount ?? null,
    product_id: payload.productId ?? null,
    metadata: null,
    occurred_at: payload.occurredAt,
  };
}

/**
 * 이벤트 한 건 적재. 실패 시 throw 없이 { success: false, error } 반환.
 */
export async function saveAnalyticsEvent(
  payload: AnalyticsPayload,
): Promise<SaveAnalyticsEventResult> {
  try {
    const row = toRow(payload);
    const { error } = await supabase.from("analytics_events").insert(row).select("id").limit(1);

    if (error) {
      console.error("[analytics] saveAnalyticsEvent failed:", error.message, {
        eventName: payload.eventName,
        source: payload.source,
      });
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analytics] saveAnalyticsEvent threw:", message, {
      eventName: payload.eventName,
      source: payload.source,
    });
    return { success: false, error: message };
  }
}
