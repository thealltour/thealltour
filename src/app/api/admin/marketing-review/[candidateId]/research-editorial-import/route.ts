import { requireAdminPermission } from "@/lib/apiAuth";
import { z } from "zod";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { humanReviewErrorResponse } from "@/lib/marketing/review/apiErrors";
import { readExternalResearchSummary } from "@/lib/marketing/canonicalAsset/applyExternalResearchConflicts";
import { resolveCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/persistence";
import { resolveCandidatePackageRoot } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";
import {
  ExternalEditorialCandidateExistsError,
  importExternalEditorialResult,
} from "@/lib/marketing/publishable/channelSources";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  raw: z.string().min(1).max(500_000),
});

type RouteContext = { params: Promise<{ candidateId: string }> };

/**
 * Import editorial-research-bundle-chatgpt-result-v1 as an immutable External Editorial candidate.
 * Does not touch publishable-content.json, sidecars, the shared narrative, or the review DB.
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
    const selectable = Object.entries(candidate.channelReadiness)
      .filter(([, r]) => r.materializable)
      .map(([channel]) => channel);
    const research = readExternalResearchSummary(candidate.result, approvedCanonical);
    const researchBlocked = research?.status === "blocked";
    return Response.json({
      importId: candidate.importId,
      candidateRef: result.candidateRef,
      importedAt: candidate.importedAt,
      warnings: candidate.warnings,
      channelReadiness: candidate.channelReadiness,
      researchStatus: research?.status ?? null,
      message:
        selectable.length > 0
          ? `외부 편집 결과를 저장했습니다. 선택 가능한 채널: ${selectable.join(", ")}`
          : researchBlocked
            ? "ChatGPT가 승인본 범위 충돌로 연구를 보류해 채널 결과가 없습니다. 아래 연구 결과에서 충돌을 검토하세요."
            : "외부 편집 결과를 저장했지만 선택 가능한 채널이 없습니다.",
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
