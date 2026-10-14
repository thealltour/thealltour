import { requireAdminPermission } from "@/lib/apiAuth";
import { loadSceneApiContext, sceneApiError } from "@/lib/marketing/publishable/narrationScenes/apiContext";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
import { visualSourceMutationSchema } from "@/lib/marketing/publishable/narrationVisualSources/contracts";
import { draftSearchPlan, saveSearchPlan } from "@/lib/marketing/publishable/narrationVisualSources/searchPlan";
import { fetchNextPage, revealMoreCandidates, runSceneSearch } from "@/lib/marketing/publishable/narrationVisualSources/search";
import { proposeSupplement, runSupplement } from "@/lib/marketing/publishable/narrationVisualSources/supplement";
import { clearCandidateReview, reviewCandidate, setSceneNoSuitable } from "@/lib/marketing/publishable/narrationVisualSources/reviews";
import { approveStockClip, makeStockClip, selectImageMotion, selectStockSource, updateStockPlaceReview } from "@/lib/marketing/publishable/narrationVisualSources/clips";
import { visualSourcesView } from "@/lib/marketing/publishable/narrationVisualSources/view";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ candidateId: string }> };
/** Reads stored state only; never searches providers. */
export async function GET(_request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try { const { candidateId } = await context.params; const { root, canEdit } = await loadSceneApiContext(candidateId, false);
    return Response.json({ ...visualSourcesView(root, candidateId), canEdit });
  } catch (error) { return sceneApiError(error); }
}
export async function POST(request: Request, context: Context) {
  const auth = await requireAdminPermission("settings.manage"); if (!auth.ok) return auth.res;
  try {
    const { candidateId } = await context.params; const { root } = await loadSceneApiContext(candidateId, true);
    const input = visualSourceMutationSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new NarrationError(input.error.issues.find(i => i.code === "custom")?.message ?? "영상 소스 요청 형식을 확인해주세요.", 400);
    const data = input.data; let notice: string | null = null;
    if (data.action === "draft-search-plan") await draftSearchPlan(root, candidateId, data.expectedPlanFingerprint, data.expectedSearchPlanFingerprint);
    else if (data.action === "save-search-plan") saveSearchPlan(root, candidateId, data.expectedPlanFingerprint, data.expectedSearchPlanFingerprint, data.scenes);
    else if (data.action === "search") await runSceneSearch(root, candidateId, data);
    else if (data.action === "reveal-more") revealMoreCandidates(root, candidateId, data);
    else if (data.action === "fetch-next-page") await fetchNextPage(root, candidateId, data);
    else if (data.action === "propose-supplement") await proposeSupplement(root, candidateId, data);
    else if (data.action === "run-supplement") await runSupplement(root, candidateId, data);
    else if (data.action === "review-candidate") reviewCandidate(root, candidateId, data);
    else if (data.action === "clear-review") clearCandidateReview(root, candidateId, data);
    else if (data.action === "scene-no-suitable") setSceneNoSuitable(root, candidateId, data);
    else if (data.action === "use-stock") notice = selectStockSource(root, candidateId, data).queueMessage;
    else if (data.action === "update-place-review") notice = updateStockPlaceReview(root, candidateId, data).queueMessage;
    else if (data.action === "use-image-motion") selectImageMotion(root, candidateId, data);
    else if (data.action === "make-clip") makeStockClip(root, candidateId, data);
    else approveStockClip(root, candidateId, data);
    return Response.json({ ...visualSourcesView(root, candidateId), canEdit: true, notice }, { status: data.action === "make-clip" ? 202 : 200 });
  } catch (error) { return sceneApiError(error); }
}
