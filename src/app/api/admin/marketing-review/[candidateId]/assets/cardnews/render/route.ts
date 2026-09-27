import { requireAdminPermission } from "@/lib/apiAuth";
import { marketingAssetErrorResponse } from "@/lib/marketing/assets/assetApiErrors";
import type { RenderInstagramCardnewsResult } from "@/lib/marketing/assets/cardnews/instagramCardnews";
import { renderCandidateInstagramCardnews } from "@/lib/marketing/assets/cardnews/renderCandidateInstagramCardnews";
import { INSTAGRAM_CARD_COPY_REVIEW_GATE_MESSAGES_KO } from "@/lib/marketing/publishable/instagramEditorial/cardCopyReview";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Sharp rasterization for 5 cards × 2 ratios can take several minutes on Pi. */
export const maxDuration = 300;

type RouteContext = { params: Promise<{ candidateId: string }> };

function skippedNote(result: RenderInstagramCardnewsResult): string {
  const state = result.cardCopyReviewState;
  if (result.skipReason === "card_copy_review_required" && state && state !== "approved" && state !== "not_applicable") {
    return INSTAGRAM_CARD_COPY_REVIEW_GATE_MESSAGES_KO[state];
  }
  return `렌더를 건너뛰었습니다 (${result.skipReason ?? "unknown"}).`;
}

function renderedNote(result: RenderInstagramCardnewsResult): string {
  const done = `카드뉴스 ${result.cardCount}장 × ${result.aspectRatios.join(", ")} 렌더를 완료했습니다.`;
  return result.visualPlanStale
    ? `${done} 이미지는 이전 카드 구성·문구 기준 비주얼 계획의 업로드본입니다. 문구와 맞지 않으면 Shared Visual Plan을 다시 생성하세요.`
    : done;
}

/**
 * Admin: start Instagram cardnews PNG render for a candidate HDD package.
 * Same eligibility rules as `scripts/render-instagram-cardnews.ts`.
 * Does not publish / SNS.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let dryRun = false;
  let graphicOnly = false;
  try {
    const body = (await request.json()) as { dryRun?: unknown; graphicOnly?: unknown };
    dryRun = Boolean(body?.dryRun);
    graphicOnly = Boolean(body?.graphicOnly);
  } catch {
    dryRun = false;
    graphicOnly = false;
  }

  try {
    const outcome = await renderCandidateInstagramCardnews({
      candidateId,
      dryRun,
      graphicOnly,
    });
    if (!outcome.ok) {
      return Response.json(
        { message: "후보를 찾을 수 없습니다.", code: "candidate_not_found" },
        { status: 404 },
      );
    }

    const { result, businessDateKst } = outcome;
    const paths = result.renders.flatMap((render) =>
      render.artifacts.map((artifact) => artifact.relativePath),
    );

    return Response.json(
      {
        candidateId: result.candidateId ?? candidateId,
        businessDateKst,
        status: result.status,
        skipReason: result.skipReason ?? null,
        cardCount: result.cardCount,
        aspectRatios: result.aspectRatios,
        dryRun,
        wrote: result.status === "rendered" && !dryRun,
        paths,
        sharedVisualInjection: result.sharedVisualInjection ?? null,
        cardCopyReviewState: result.cardCopyReviewState ?? null,
        visualPlanStale: result.visualPlanStale ?? false,
        note:
          result.status === "skipped"
            ? skippedNote(result)
            : dryRun
              ? "dry-run: 파일을 쓰지 않았습니다."
              : renderedNote(result),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return marketingAssetErrorResponse(error);
  }
}
