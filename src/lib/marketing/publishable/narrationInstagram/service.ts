import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { readCanonicalAssetFromPackage } from "@/lib/marketing/canonicalAsset/persistence";
import { NarrationError } from "../narration/persistence";
import { readScenePlan, requireFreshScenePlan, sceneHash } from "../narrationScenes/service";
import type { NarrationScenePlan } from "../narrationScenes/contracts";
import { verifySceneAsset } from "../narrationScenes/assets";
import { instagramAdaptationSchema, type InstagramAdaptation, type InstagramMutation, type InstagramCardCopy } from "./contracts";

export const adaptationDirectory = (root: string) => join(root, "context/narration/instagram");
function visualInventory(root: string, plan: NarrationScenePlan) {
  return plan.scenes.map(scene => {
    try { const { asset } = verifySceneAsset(root, plan, scene.visualId); return { sceneId: scene.sceneId, imageSha256: asset.sha256 }; }
    catch { return { sceneId: scene.sceneId, imageSha256: null }; }
  });
}
export function adaptationFingerprint(value: Pick<InstagramAdaptation, "candidateId" | "revision" | "source" | "cards">) {
  return sceneHash({ contract: "narration-instagram-adaptation-v1", candidateId: value.candidateId, revision: value.revision, source: value.source, cards: value.cards });
}
export function readAdaptation(root: string, candidateId: string): InstagramAdaptation | null {
  const path = join(adaptationDirectory(root), "current.json"); if (!existsSync(path)) return null;
  const value = instagramAdaptationSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  if (value.candidateId !== candidateId || value.source.upstream.candidateId !== candidateId || adaptationFingerprint(value) !== value.fingerprint ||
      new Set(value.cards.map(c => c.sceneId)).size !== value.cards.length ||
      value.cards.some((c, i) => c.order !== i || c.cardId !== c.sceneId || c.sentenceId !== c.sceneId || c.visualId !== c.sceneId) ||
      (value.approval && (value.approval.revision !== value.revision || value.approval.fingerprint !== value.fingerprint))) throw new NarrationError("Instagram 파생 문서의 연결 정보가 일치하지 않습니다.", 409);
  return value;
}
export function adaptationFresh(root: string, candidateId: string, value: InstagramAdaptation) {
  try {
    const plan = requireFreshScenePlan(root, candidateId, value.source.scenePlanFingerprint);
    if (plan.revision !== value.source.scenePlanRevision || sceneHash(plan.source) !== sceneHash(value.source.upstream)) return false;
    let previousOrder = -1;
    for (const card of value.cards) {
      const scene = plan.scenes.find(s => s.sceneId === card.sceneId);
      if (!scene || scene.order <= previousOrder) return false;
      previousOrder = scene.order;
      const { asset } = verifySceneAsset(root, plan, card.visualId);
      if (asset.sha256 !== card.image.sha256 || asset.relativePath !== card.image.relativePath) return false;
    }
    return true;
  } catch { return false; }
}
export function requireApprovedAdaptation(root: string, candidateId: string, fingerprint: string) {
  const value = readAdaptation(root, candidateId);
  if (!value || !value.approval || value.fingerprint !== fingerprint || !adaptationFresh(root, candidateId, value)) throw new NarrationError("현재 장면·이미지 기준으로 카드 구성을 저장하고 승인해주세요.");
  return value;
}
export function withAdaptationLock<T>(root: string, action: () => T): T {
  const directory = adaptationDirectory(root); mkdirSync(directory, { recursive: true }); const lock = join(directory, ".mutation-lock");
  try { mkdirSync(lock); } catch { throw new NarrationError("다른 카드 저장이 진행 중입니다. 잠시 후 다시 시도해주세요."); }
  try { return action(); } finally { rmSync(lock, { recursive: true }); }
}
export function mutateAdaptation(root: string, candidateId: string, input: InstagramMutation) {
  if (input.action === "render") throw new NarrationError("렌더 전용 경로를 사용해주세요.", 400);
  return withAdaptationLock(root, () => {
    const current = readAdaptation(root, candidateId);
    if ((current?.revision ?? null) !== input.expectedRevision || (current?.fingerprint ?? null) !== input.expectedFingerprint) throw new NarrationError("다른 화면에서 카드를 변경했습니다. 다시 불러와주세요.");
    const plan = requireFreshScenePlan(root, candidateId, input.expectedScenePlanFingerprint);
    if (plan.scenes.length < 4) throw new NarrationError("현재 장면 수로는 카드 4~10장을 구성할 수 없습니다.", 409);
    const source = { scenePlanRevision: plan.revision, scenePlanFingerprint: plan.fingerprint, upstream: plan.source };
    if (input.action === "handoff") {
      const canonical = readCanonicalAssetFromPackage(root);
      if (!canonical) throw new NarrationError("공통 원문이 없습니다.");
      const inventory = visualInventory(root, plan);
      if (inventory.filter(v => v.imageSha256 !== null).length < 4) throw new NarrationError("카드 파생 전에 서로 다른 장면의 이미지 4개 이상을 준비해주세요.");
      const payload = { contract: "narration-instagram-chatgpt-handoff-v1", candidateId, source,
        baseRevision: current?.revision ?? null, baseFingerprint: current?.fingerprint ?? null,
        visualInventoryFingerprint: sceneHash(inventory),
        approvedCanonical: { titleKo: canonical.titleKo, dekKo: canonical.dekKo, openingHookKo: canonical.openingHookKo,
          bodyKo: canonical.bodyKo, keyTakeawaysKo: canonical.keyTakeawaysKo, decisionGuidanceKo: canonical.decisionGuidanceKo,
          optionalCtaIntentKo: canonical.optionalCtaIntentKo, evidenceRefs: canonical.evidenceRefs,
          limitationsKo: canonical.limitationsKo, forbiddenClaimsKo: canonical.forbiddenClaimsKo,
          supportedClaimBoundaryKo: canonical.supportedClaimBoundaryKo, unresolvedQuestionsKo: canonical.unresolvedQuestionsKo },
        scenes: plan.scenes.map((scene, i) => ({ sceneId: scene.sceneId, order: scene.order, sentenceText: scene.sentenceText,
          purpose: scene.purpose, imageReady: inventory[i]!.imageSha256 !== null })),
        currentCards: current && adaptationFresh(root, candidateId, current) ? current.cards.map(({ sceneId, kicker, headline, body, microcopy }) => ({ sceneId, kicker, headline, body, microcopy })) : [],
        instructions: ["Return only narration-instagram-chatgpt-result-v1 JSON with candidateId, source, baseRevision, baseFingerprint, visualInventoryFingerprint and cards.",
          "Copy identity/source/base/inventory fields exactly. Select 4–10 distinct imageReady scenes, preserving narration order. Never default to five cards.",
          "Each card references exactly one sceneId; never invent a scene, combine visuals, duplicate a scene or alter Canonical.",
          "Write natural Korean copy following the selected narration. Do not pad/truncate narration for card count or duration.",
          "Card fields: sceneId, kicker (nullable, <=40), headline (required, <=80), body (nullable, <=400), microcopy (nullable, <=120).", "No additional fields or provenance in reader-facing copy."] };
      requireFreshScenePlan(root, candidateId, plan.fingerprint);
      return { adaptation: current, handoff: payload };
    }
    let next: InstagramAdaptation;
    if (input.action === "approve") {
      if (!current || !adaptationFresh(root, candidateId, current) || current.source.scenePlanFingerprint !== plan.fingerprint) throw new NarrationError("최신 장면 기준으로 카드 구성을 먼저 저장해주세요.");
      next = { ...current, approval: { revision: current.revision, fingerprint: current.fingerprint, approvedAt: new Date().toISOString() } };
    } else {
      let copy: InstagramCardCopy[] | undefined = input.cards;
      if (input.action === "import") {
        const result = input.result;
        if (!result || result.candidateId !== candidateId || sceneHash(result.source) !== sceneHash(source) || result.baseRevision !== input.expectedRevision || result.baseFingerprint !== input.expectedFingerprint || result.visualInventoryFingerprint !== sceneHash(visualInventory(root, plan))) throw new NarrationError("가져온 결과의 원문·장면·이미지·revision 연결 정보가 다릅니다.");
        copy = result.cards;
      }
      if (!copy || copy.length < 4 || copy.length > 10 || new Set(copy.map(c => c.sceneId)).size !== copy.length) throw new NarrationError("서로 다른 장면으로 카드 4~10장을 구성해주세요.", 400);
      let previousOrder = -1;
      const cards = copy.map((card, order) => {
        const scene = plan.scenes.find(s => s.sceneId === card.sceneId);
        if (!scene || scene.order <= previousOrder) throw new NarrationError("카드는 Narration의 장면 순서를 따라야 합니다.", 400);
        previousOrder = scene.order;
        const { asset } = verifySceneAsset(root, plan, scene.visualId);
        return { ...card, cardId: scene.sceneId, sentenceId: scene.sentenceId, visualId: scene.visualId, order,
          image: { relativePath: asset.relativePath, sha256: asset.sha256 }, crop: "center-4:5" as const };
      });
      if (current && sceneHash({ source, cards }) === sceneHash({ source: current.source, cards: current.cards })) return { adaptation: current, handoff: null };
      const revision = (current?.revision ?? 0) + 1;
      next = instagramAdaptationSchema.parse({ contract: "narration-instagram-adaptation-v1", candidateId, revision, source, cards,
        fingerprint: adaptationFingerprint({ candidateId, revision, source, cards }), createdAt: new Date().toISOString(), approval: null });
    }
    if (!adaptationFresh(root, candidateId, next)) throw new NarrationError("저장 중 장면 또는 이미지가 변경되었습니다.");
    if (current && next.revision !== current.revision) atomicWriteFile(join(adaptationDirectory(root), "revisions", `${current.revision}-${current.fingerprint}.json`), JSON.stringify(current, null, 2));
    atomicWriteFile(join(adaptationDirectory(root), "current.json"), JSON.stringify(next, null, 2));
    return { adaptation: next, handoff: null };
  });
}
export function loadAdaptationView(root: string, candidateId: string) {
  const plan = readScenePlan(root); const adaptation = readAdaptation(root, candidateId);
  if (plan && plan.source.candidateId !== candidateId) throw new NarrationError("후보와 장면 계획이 일치하지 않습니다.", 409);
  let planReady = false; try { if (plan) { requireFreshScenePlan(root, candidateId, plan.fingerprint); planReady = true; } } catch { /* Historical plan stays visible. */ }
  return { plan, planReady, adaptation, gateState: !adaptation ? "missing" : !adaptationFresh(root, candidateId, adaptation) ? "stale" : adaptation.approval ? "approved" : "draft",
    scenes: planReady && plan ? plan.scenes.map(scene => {
      try { const { asset } = verifySceneAsset(root, plan, scene.visualId); return { ...scene, imageReady: true, imageSha256: asset.sha256 }; }
      catch { return { ...scene, imageReady: false, imageSha256: null }; }
    }) : [] };
}
