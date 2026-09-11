import { requireAdminPermission } from "@/lib/apiAuth";
import { SHORTFORM_FINAL_RELATIVE_PATH } from "@/lib/marketing/assets/shortform/production/paths";
import { evaluateShortformRenderReady } from "@/lib/marketing/assets/shortform/renderReady";
import { createShortformVideoRenderJobRepository } from "@/lib/marketing/assets/shortform/renderJob/createRepository";
import { shortformSourceReviewErrorResponse } from "@/lib/marketing/assets/shortform/review/service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * CG-3 — Read shortform RenderJob status for Admin Marketing Review.
 * Does not expose claim tokens. Does not enqueue or approve.
 */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  try {
    const evaluation = await evaluateShortformRenderReady({ candidateId });
    const job = evaluation.job;
    return Response.json(
      {
        candidateId,
        shortformIntended: evaluation.shortformIntended,
        uiStatus: evaluation.uiStatus,
        renderReady: evaluation.renderReady,
        reason: evaluation.reason,
        requiredSceneCount: evaluation.requiredSceneCount,
        pickedSceneCount: evaluation.pickedSceneCount,
        issues: evaluation.issues.map((issue) => ({
          sceneId: issue.sceneId,
          code: issue.code,
          message: issue.message,
        })),
        job: job
          ? {
              jobId: job.jobId,
              status: job.status,
              logicalRunKey: job.logicalRunKey,
              attemptCount: job.attemptCount,
              maxAttempts: job.maxAttempts,
              errorCode: job.errorCode,
              errorSummary: job.errorSummary,
              outputArtifactPath: job.outputArtifactPath,
              updatedAt: job.updatedAt,
              completedAt: job.completedAt,
            }
          : null,
        finalArtifact: {
          relativePath: evaluation.finalRelativePath,
          exists: evaluation.finalArtifactExists,
          previewPath:
            evaluation.finalArtifactExists
              ? evaluation.job?.outputArtifactPath?.trim() || SHORTFORM_FINAL_RELATIVE_PATH
              : null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return shortformSourceReviewErrorResponse(error);
  }
}

/**
 * CG-3 — Explicit operator requeue for FAILED RenderJob (same logical key).
 * Body: { action: "requeue" }
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const action =
    typeof body === "object" && body && "action" in body
      ? String((body as { action: unknown }).action)
      : "";

  if (action !== "requeue") {
    return Response.json(
      { message: "action=requeue 만 지원합니다.", code: "INVALID_ACTION" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const evaluation = await evaluateShortformRenderReady({ candidateId });
    if (!evaluation.job || evaluation.job.status !== "FAILED") {
      return Response.json(
        {
          message: "FAILED RenderJob이 있을 때만 재시도할 수 있습니다.",
          code: "REQUEUE_REQUIRES_FAILED",
          uiStatus: evaluation.uiStatus,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    const repo = await createShortformVideoRenderJobRepository();
    const requeued = await repo.requeueFailed({
      logicalRunKey: evaluation.job.logicalRunKey,
    });
    return Response.json(
      {
        ok: true,
        message: "실패한 렌더 작업을 다시 대기열에 넣었습니다.",
        job: {
          jobId: requeued.jobId,
          status: requeued.status,
          logicalRunKey: requeued.logicalRunKey,
          attemptCount: requeued.attemptCount,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return shortformSourceReviewErrorResponse(error);
  }
}
