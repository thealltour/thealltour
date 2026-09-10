import { requireAdminPermission } from "@/lib/apiAuth";
import { createServerMarketingTraceReadRepository } from "@/lib/marketing/observability/viewer/serverReadRepository";
import { toTraceListItemDto } from "@/lib/marketing/observability/viewer/dto";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limitRaw)))
    : DEFAULT_LIMIT;
  const status = url.searchParams.get("status")?.trim() || null;

  try {
    const repo = await createServerMarketingTraceReadRepository();
    if (!repo) {
      return Response.json({ message: "observability_store_unavailable" }, { status: 503 });
    }
    const traces = await repo.listRecentTraces({ limit, status });
    return Response.json(
      { traces: traces.map(toTraceListItemDto) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof Error
            ? error.message.replace(/(api[_-]?key|token|secret)=[^\s]+/gi, "[redacted]")
            : "marketing_observability_unavailable",
      },
      { status: 500 },
    );
  }
}
