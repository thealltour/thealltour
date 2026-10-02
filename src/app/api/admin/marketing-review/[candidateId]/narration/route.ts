import { requireAdminPermission } from "@/lib/apiAuth";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_MARKETING_ASSET_RELATIVE_PATH } from "@/lib/marketing/canonicalAsset/paths";
import { createHumanMarketingReviewService } from "@/lib/marketing/review/humanMarketingReviewService";
import { resolveCandidatePackageRoot } from "@/lib/marketing/editorialDirector/researchHandoff/loadResearchHandoffSource";
import { readCanonicalAssetFromPackage, resolveCanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/persistence";
import { mutationSchema } from "@/lib/marketing/publishable/narration/contracts";
import { mutateNarration, narrationGate, narrationLineage, NarrationError, readNarration } from "@/lib/marketing/publishable/narration/persistence";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ candidateId: string }> };
async function handle(request: Request, context: Context, mutate: boolean) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params;
    const service = await createHumanMarketingReviewService();
    const detail = await service.getHumanReviewDetail(candidateId);
    if (!detail) throw new NarrationError("후보를 찾을 수 없습니다.", 404);
    const root = resolveCandidatePackageRoot(detail.candidate);
    if (!root) throw new NarrationError("후보의 자료 폴더를 찾을 수 없습니다.", 404);
    const getSource = () => {
      if (existsSync(join(root, CANONICAL_MARKETING_ASSET_RELATIVE_PATH)) && !readCanonicalAssetFromPackage(root)) {
        throw new NarrationError("공통 원문 저장 파일을 읽을 수 없습니다. 파일을 확인해주세요.", 409);
      }
      const asset = resolveCanonicalMarketingAsset({ candidate: detail.candidate, packageRoot: root });
      if (!asset) throw new NarrationError("공통 원문을 찾을 수 없습니다.", 404);
      return asset;
    };
    const getLineage = () => narrationLineage(getSource());
    let narration = readNarration(root, candidateId);
    if (mutate) {
      if (!detail.canEdit) throw new NarrationError("현재 후보는 편집할 수 없습니다.", 403);
      const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) throw new NarrationError("1~16개 문장과 현재 revision 정보를 확인해주세요.", 400);
      narration = mutateNarration(root, candidateId, parsed.data, getLineage);
    }
    const lineage = getLineage();
    const source = getSource();
    return Response.json({ narration, lineage, gateState: narrationGate(narration, lineage), canEdit: detail.canEdit,
      source: { titleKo: source.titleKo, bodyKo: source.bodyKo, limitationsKo: source.limitationsKo, forbiddenClaimsKo: source.forbiddenClaimsKo } });
  } catch (error) {
    return Response.json({ message: error instanceof NarrationError ? error.message : "Narration을 처리하지 못했습니다." },
      { status: error instanceof NarrationError ? error.status : 500 });
  }
}
export function GET(request: Request, context: Context) { return handle(request, context, false); }
export function POST(request: Request, context: Context) { return handle(request, context, true); }
