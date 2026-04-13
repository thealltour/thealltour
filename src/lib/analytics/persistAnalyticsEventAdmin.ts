/**
 * 서버에서 analytics_events 적재 (service role). 실패 시 throw 없음.
 */

import { createAnalyticsPayload } from "./payload";
import { toRow } from "./saveAnalyticsEvent";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AnalyticsPayload } from "./types";

export async function persistAnalyticsEventAdmin(
  partial: Partial<AnalyticsPayload> & Pick<AnalyticsPayload, "eventName" | "source">,
): Promise<void> {
  try {
    const payload = createAnalyticsPayload({
      ...partial,
      deviceType: partial.deviceType ?? "unknown",
      pagePath: partial.pagePath ?? null,
    });
    const row = toRow(payload);
    const { error } = await supabaseAdmin.from("analytics_events").insert(row);
    if (error) {
      console.error("[analytics] persistAnalyticsEventAdmin:", error.message, payload.eventName);
    }
  } catch (e) {
    console.error("[analytics] persistAnalyticsEventAdmin threw:", e);
  }
}
