import { requireAdminPermission } from "@/lib/apiAuth";
import { z } from "zod";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { readExternalResearchSummary } from "@/lib/marketing/canonicalAsset/applyExternalResearchConflicts";
import { resolveCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/persistence";
import { resolveCandidatePackageRoot } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";
import {
  ExternalEditorialCandidateExistsError,
  applyExternalCandidateToAllChannels,
  importExternalEditorialResult,
} from "@/lib/marketing/publishable/channelSources";
import { channelLabel } from "@/lib/marketing/review/channelReviews";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  raw: z.string().min(1).max(500_000),
});

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Import editorial-research-bundle-chatgpt-result-v1 as an immutable External Editorial candidate,
 * then apply every channel it carries (human drafts overwritten) so channel review shows it at once.
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

    const result = importExternalEditorialResult({
      packageRoot,
      candidateId,
      approvedCanonical,
      raw: parsed.data.raw,
      importedBy: auth.session.username ?? null,
    });
    if (!result.ok) {
      const status = result.code === "invalid_json" ? 400 : result.code.startsWith("canonical_") || result.code === "stale_identity" ? 409 : 422;
      return Response.json(
        { message: result.messageKo, code: result.code, details: result.details },
        { status },
      );
    }

    const { candidate } = result;
    const research = readExternalResearchSummary(candidate.result, approvedCanonical);

    const review =
      detail.review ?? (await service.getOrCreateHumanReview(candidateId, auth.session.username ?? "admin"));
    const applyResult = applyExternalCandidateToAllChannels({
      packageRoot,
      candidateId,
      approvedCanonical,
      importId: candidate.importId,
      selectedBy: auth.session.username ?? null,
      review,
    });
    let updatedReview = applyResult.review;
    if (applyResult.reviewChanged) {
      const { createHumanMarketingReviewRepository } = await import(
        "@/lib/marketing/review/repository/createHumanMarketingReviewRepository"
      );
      const repo = await createHumanMarketingReviewRepository();
      updatedReview = await repo.update(applyResult.review);
    }

    const appliedLabel = applyResult.applied.map((c) => channelLabel(c)).join(", ");
    const failedLabel = applyResult.failed
      .map((f) => `${channelLabel(f.channel)}(${[f.messageKo, ...f.details].join(" ")})`)
      .join(", ");
    const message =
      applyResult.applied.length > 0
        ? `외부 편집 결과를 가져와 ${appliedLabel} 채널에 바로 적용했습니다. 채널별 검토에서 확인하세요.${
            failedLabel ? ` 적용 실패: ${failedLabel}` : ""
          }`
        : applyResult.failed.length > 0
          ? `외부 편집 결과를 저장했지만 채널 적용에 실패했습니다: ${failedLabel}`
          : "외부 편집 결과를 저장했지만 ChatGPT가 보낸 채널 결과가 없습니다. ChatGPT에서 채널 결과를 모두 작성하도록 다시 실행하세요.";

    return Response.json({
      importId: candidate.importId,
      candidateRef: result.candidateRef,
      importedAt: candidate.importedAt,
      warnings: [...candidate.warnings, ...applyResult.warnings],
      channelReadiness: candidate.channelReadiness,
      researchStatus: research?.status ?? null,
      appliedChannels: applyResult.applied,
      failedChannels: applyResult.failed,
      review: updatedReview,
      message,
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
