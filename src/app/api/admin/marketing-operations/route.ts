import { requireAdminPermission } from "@/lib/apiAuth";
import {
  getDailyMarketingOperationsStatus,
  getRecentDailyMarketingOperationsSummaries,
  sanitizeOperationsDtoForResponse,
} from "@/lib/marketing/operations";
import { formatKstBusinessDate } from "@/lib/marketing/cron/daily/kstBusinessDate";

export const dynamic = "force-dynamic";

function parseBusinessDate(value: string | null): string | null {
  if (!value?.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return null;
  return value.trim();
}

export async function GET(request: Request) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const businessDate = parseBusinessDate(url.searchParams.get("businessDate"));
  const recentDaysRaw = url.searchParams.get("days");
  const recentDays = recentDaysRaw ? Number(recentDaysRaw) : null;

  try {
    if (recentDays != null && Number.isFinite(recentDays) && recentDays > 0) {
      const days = Math.min(30, Math.max(1, Math.floor(recentDays)));
      const summaries = await getRecentDailyMarketingOperationsSummaries(days);
      return Response.json(sanitizeOperationsDtoForResponse({ summaries }), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    const status = await getDailyMarketingOperationsStatus({
      businessDateKst: businessDate ?? formatKstBusinessDate(),
    });

    return Response.json(sanitizeOperationsDtoForResponse({ status }), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message.replace(/(api[_-]?key|token|secret)=[^\s]+/gi, "[redacted]")
            : "marketing_operations_unavailable",
      },
      { status: 500 },
    );
  }
}
