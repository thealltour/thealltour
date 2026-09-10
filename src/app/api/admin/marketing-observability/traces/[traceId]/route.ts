import { requireAdminPermission } from "@/lib/apiAuth";
import { isValidTraceId } from "@/lib/marketing/observability/ids";
import { createServerMarketingTraceReadRepository } from "@/lib/marketing/observability/viewer/serverReadRepository";
import { toTraceDetailDto } from "@/lib/marketing/observability/viewer/dto";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ traceId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { traceId: raw } = await context.params;
  const traceId = raw?.trim().toLowerCase() ?? "";
  if (!isValidTraceId(traceId)) {
    return Response.json({ message: "invalid_trace_id" }, { status: 400 });
  }

  try {
    const repo = await createServerMarketingTraceReadRepository();
    if (!repo) {
      return Response.json({ message: "observability_store_unavailable" }, { status: 503 });
    }
    const spans = await repo.listTraceSpans(traceId);
    const trace = await repo.getTrace(traceId);
    if (!trace) {
      return Response.json({ message: "trace_not_found" }, { status: 404 });
    }
    return Response.json(toTraceDetailDto(trace, spans), {
      headers: { "Cache-Control": "no-store" },
    });
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
