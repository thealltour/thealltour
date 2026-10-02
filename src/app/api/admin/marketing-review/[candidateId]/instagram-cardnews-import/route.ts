import { requireAdminPermission } from "@/lib/apiAuth";
import { z } from "zod";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { resolveCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/persistence";
import { resolveCandidatePackageRoot } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";
import {
  ExternalEditorialCandidateExistsError,
  importInstagramCardnewsResult,
  selectChannelSource,
} from "@/lib/marketing/publishable/channelSources";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  raw: z.string().min(1).max(500_000),
});

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Import instagram-cardnews-chatgpt-result-v1 as an immutable External Editorial candidate and
 * apply it to the Instagram channel only (human drafts / card copy review reset). Other channels
 * keep their current source.
 */
export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  const { candidateId } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "붙여넣은 JSON이 비어 있거나 너무 큽니다." }, { status: 400 });
  }

  try {
    const service = await createHumanMarketingReviewService();
    const detail = await service.getHumanReviewDetail(candidateId);
    if (!detail?.candidate) {
      return Response.json({ message: "후보를 찾을 수 없습니다." }, { status: 404 });
    }
    const packageRoot = resolveCandidatePackageRoot(detail.candidate);
    if (!packageRoot) {
      return Response.json({ message: "마케팅 패키지 폴더가 없습니다.", code: "package_missing" }, { status: 409 });
    }
    const approvedCanonical = resolveCanonicalMarketingAsset({ candidate: detail.candidate, packageRoot });

    const result = importInstagramCardnewsResult({
      packageRoot,
      candidateId,
      approvedCanonical,
      raw: parsed.data.raw,
      importedBy: auth.session.username ?? null,
    });
    if (!result.ok) {
      const status =
        result.code === "invalid_json"
          ? 400
          : result.code.startsWith("canonical_") || result.code === "stale_identity"
            ? 409
            : 422;
      return Response.json({ message: result.messageKo, code: result.code, details: result.details }, { status });
    }

    const { candidate } = result;
    const review =
      detail.review ?? (await service.getOrCreateHumanReview(candidateId, auth.session.username ?? "admin"));
    const applied = selectChannelSource({
      packageRoot,
      candidateId,
      approvedCanonical,
      channel: "instagram",
      source: "external_editorial",
      importId: candidate.importId,
      selectedBy: auth.session.username ?? null,
      allowOverwriteHuman: true,
      review,
    });
    if (!applied.ok) {
      return Response.json(
        {
          importId: candidate.importId,
          message: `Instagram 카드뉴스 결과를 저장했지만 적용에 실패했습니다: ${[applied.messageKo, ...applied.details].join(" ")}`,
          code: applied.code,
          details: applied.details,
          warnings: candidate.warnings,
        },
        { status: applied.status },
      );
    }

    let updatedReview = applied.review;
    if (applied.reviewChanged) {
      const { createHumanMarketingReviewRepository } = await import(
        "@/lib/marketing/review/repository/createHumanMarketingReviewRepository"
      );
      const repo = await createHumanMarketingReviewRepository();
      updatedReview = await repo.update(applied.review);
    }

    return Response.json({
      importId: candidate.importId,
      candidateRef: result.candidateRef,
      importedAt: candidate.importedAt,
      coverTitleKo: result.coverTitleKo,
      warnings: [...candidate.warnings, ...applied.warnings],
      review: updatedReview,
      message:
        "Instagram 카드뉴스 결과를 가져와 Instagram 채널에 적용했습니다. 아래 카드 문구 검수에서 확인하고 저장·승인하세요.",
    });
  } catch (error) {
    if (error instanceof ExternalEditorialCandidateExistsError) {
      return Response.json(
        { message: "같은 importId의 candidate가 이미 있습니다. 잠시 후 다시 시도하세요.", code: "import_id_exists" },
        { status: 409 },
      );
    }
    return humanReviewErrorResponse(error);
  }
}
