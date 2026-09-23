import { requireAdminPermission } from "@/lib/apiAuth";
import { marketingAssetErrorResponse } from "@/lib/marketing/assets/assetApiErrors";
import { renderCandidateInstagramCardnews } from "@/lib/marketing/assets/cardnews/renderCandidateInstagramCardnews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Sharp rasterization for 5 cards × 2 ratios can take several minutes on Pi. */
export const maxDuration = 300;

type RouteContext = { params: Promise<{ candidateId: string }> };

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
        note:
          result.status === "skipped"
            ? `렌더를 건너뛰었습니다 (${result.skipReason ?? "unknown"}).`
            : dryRun
              ? "dry-run: 파일을 쓰지 않았습니다."
              : `카드뉴스 ${result.cardCount}장 × ${result.aspectRatios.join(", ")} 렌더를 완료했습니다.`,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return marketingAssetErrorResponse(error);
  }
}
