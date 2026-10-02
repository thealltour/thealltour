import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { resolveCandidatePackageRoot } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";
import { NarrationError } from "../narration/persistence";
export async function loadSceneApiContext(candidateId: string, mutate: boolean) {
  const detail = await (await createHumanMarketingReviewService()).getHumanReviewDetail(candidateId);
  if (!detail) throw new NarrationError("후보를 찾을 수 없습니다.", 404);
  if (mutate && !detail.canEdit) throw new NarrationError("현재 후보는 편집할 수 없습니다.", 403);
  const root = resolveCandidatePackageRoot(detail.candidate);
  if (!root) throw new NarrationError("자료 폴더를 찾을 수 없습니다.", 404);
  return { root, canEdit: detail.canEdit };
}
export function sceneApiError(error: unknown) {
  return Response.json({ message: error instanceof NarrationError ? error.message : "장면 계획 또는 이미지 파일을 확인해주세요." }, { status: error instanceof NarrationError ? error.status : 409 });
}
