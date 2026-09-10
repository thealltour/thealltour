import { requireAdminPermission } from "@/lib/apiAuth";
import {
  isMarketingObsAnalyticsRange,
  DEFAULT_MARKETING_OBS_ANALYTICS_RANGE,
} from "@/lib/marketing/observability/viewer/analytics/range";
import { createServerMarketingObsAnalyticsRepository } from "@/lib/marketing/observability/viewer/analytics/serverRepository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const rangeRaw = (url.searchParams.get("range") ?? DEFAULT_MARKETING_OBS_ANALYTICS_RANGE).toLowerCase();
  if (!isMarketingObsAnalyticsRange(rangeRaw)) {
    return Response.json(
      { message: "invalid_range", allowed: ["24h", "7d", "30d"] },
      { status: 400 },
    );
  }

  try {
    const repo = await createServerMarketingObsAnalyticsRepository();
    if (!repo) {
      return Response.json({ message: "observability_store_unavailable" }, { status: 503 });
    }
    const analytics = await repo.getSummary(rangeRaw);
    return Response.json(analytics, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message.replace(/(api[_-]?key|token|secret)=[^\s]+/gi, "[redacted]")
            : "marketing_observability_analytics_unavailable",
      },
      { status: 500 },
    );
  }
}
