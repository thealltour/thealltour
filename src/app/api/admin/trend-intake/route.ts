import { requireAdminPermission } from "@/lib/apiAuth";
import { createTravelTrendsStagingRepository } from "@/lib/marketing/trends/staging/createTravelTrendsStagingRepository";
import {
  ingestTrendIntakePaste,
  previewTrendIntakePaste,
} from "@/lib/marketing/trends/intake/trendIntakeService";

export const dynamic = "force-dynamic";

function redact(message: string): string {
  return message.replace(/(api[_-]?key|token|secret|service[_-]?role)=[^\s]+/gi, "[redacted]");
}

/** GET — recent ingest history for Trend Inbox. */
export async function GET() {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  try {
    const repo = await createTravelTrendsStagingRepository();
    const recent = await repo.listRecentIngested(20);
    return Response.json(
      {
        recent: recent.map((r) => ({
          id: r.id,
          provider: r.provider,
          observationId: r.observationId,
          trendType: r.trendType,
          topic: r.payload.topic,
          status: r.status,
          observedAt: r.observedAt,
          ingestedAt: r.ingestedAt,
          clusterLabel: r.clusterLabel,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        message: redact(
          error instanceof Error ? error.message : "trend_intake_history_unavailable",
        ),
      },
      { status: 500 },
    );
  }
}

/**
 * POST — validate and/or ingest Meta TrendSignal batch (human paste).
 * Body: { action: "validate" | "ingest", paste: string }
 */
export async function POST(request: Request) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "invalid_json_body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ message: "expected_object" }, { status: 400 });
  }

  const action = (body as { action?: string }).action ?? "ingest";
  const paste = (body as { paste?: unknown }).paste;
  if (typeof paste !== "string" || !paste.trim()) {
    return Response.json({ message: "paste_required" }, { status: 400 });
  }

  try {
    if (action === "validate") {
      const preview = previewTrendIntakePaste(paste);
      return Response.json(preview, { headers: { "Cache-Control": "no-store" } });
    }

    if (action !== "ingest") {
      return Response.json({ message: "unsupported_action" }, { status: 400 });
    }

    const repo = await createTravelTrendsStagingRepository();
    const result = await ingestTrendIntakePaste(paste, repo);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json(
      {
        message: redact(error instanceof Error ? error.message : "trend_intake_failed"),
      },
      { status: 500 },
    );
  }
}
