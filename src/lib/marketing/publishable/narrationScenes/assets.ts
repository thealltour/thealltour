import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { validateSharedVisualUploadBytes } from "@/lib/marketing/publishable/sharedVisualAssets/upload";
import { NarrationError } from "../narration/persistence";
import type { NarrationScenePlan, SceneAssets } from "./contracts";
import { buildSceneHandoff, readSceneAssets, readSceneHandoff, requireFreshScenePlan, sceneDirectory, withSceneLock } from "./service";

const ledgerSchema = z.record(z.string().length(64), z.object({ planFingerprint: z.string().length(64), visualId: z.string().uuid() }).strict());
export function verifySceneAsset(root: string, plan: NarrationScenePlan, visualId: string) {
  const asset = readSceneAssets(root, plan)?.assets.find(a => a.visualId === visualId);
  if (!asset) throw new NarrationError("이 장면의 이미지를 업로드해주세요.", 404);
  const expected = `media/narration-scenes/${plan.fingerprint}/${visualId}/${asset.sha256}.png`;
  if (asset.relativePath !== expected || asset.width * 16 !== asset.height * 9) throw new NarrationError("이미지 저장 경로나 비율이 일치하지 않습니다.", 409);
  const path = resolvePackageArtifactPath({ packageRoot: root, relativePath: expected });
  if (!existsSync(path)) throw new NarrationError("업로드 이미지 파일이 없습니다.", 409);
  const bytes = readFileSync(path);
  if (createHash("sha256").update(bytes).digest("hex") !== asset.sha256) throw new NarrationError("업로드 이미지가 변경되었습니다. 다시 업로드해주세요.", 409);
  return { asset, bytes };
}
export function sceneAssetStatus(root: string, plan: NarrationScenePlan) {
  const manifest = readSceneAssets(root, plan);
  const slots = plan.scenes.map(scene => {
    try { const { asset } = verifySceneAsset(root, plan, scene.visualId); return { visualId: scene.visualId, ready: true, asset }; }
    catch { return { visualId: scene.visualId, ready: false, asset: null }; }
  });
  return { manifest, slots, complete: !!plan.approval && slots.every(s => s.ready) };
}
export async function uploadSceneAsset(input: { root: string; candidateId: string; visualId: string;
  planFingerprint: string; handoffFingerprint: string; bytes: Buffer }) {
  if (!z.string().uuid().safeParse(input.visualId).success) throw new NarrationError("비주얼 ID를 확인해주세요.", 400);
  requireFreshScenePlan(input.root, input.candidateId, input.planFingerprint);
  validateSharedVisualUploadBytes(input.bytes);
  // Decode/rotate/strip metadata; never crop or silently change the requested ratio.
  const pipeline = sharp(input.bytes, { limitInputPixels: 40_000_000, animated: false });
  const metadata = await pipeline.metadata();
  if ((metadata.pages ?? 1) !== 1) throw new NarrationError("움직이는 이미지 또는 여러 페이지는 사용할 수 없습니다.", 400);
  const image = await pipeline.rotate().png().toBuffer({ resolveWithObject: true });
  if (image.info.width * 16 !== image.info.height * 9) throw new NarrationError("9:16 비율의 이미지를 업로드해주세요.", 400);
  const digest = createHash("sha256").update(image.data).digest("hex");
  return withSceneLock(input.root, () => {
    const plan = requireFreshScenePlan(input.root, input.candidateId, input.planFingerprint);
    const handoff = buildSceneHandoff(plan);
    if (handoff.fingerprint !== input.handoffFingerprint || !readSceneHandoff(input.root, plan)) throw new NarrationError("최신 Astra 요청문을 만든 후 업로드해주세요.");
    const scene = plan.scenes.find(s => s.visualId === input.visualId);
    if (!scene) throw new NarrationError("현재 장면 계획에 없는 비주얼입니다.", 400);
    const ledgerPath = join(sceneDirectory(input.root), "image-ledger.json");
    const ledger = ledgerSchema.parse(existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, "utf8")) : {});
    const previousUse = ledger[digest];
    if (previousUse && (previousUse.planFingerprint !== plan.fingerprint || previousUse.visualId !== scene.visualId)) throw new NarrationError("다른 장면이나 이전 계획의 이미지를 재사용할 수 없습니다. 새 이미지를 생성해주세요.", 409);
    const relativePath = `media/narration-scenes/${plan.fingerprint}/${scene.visualId}/${digest}.png`;
    const asset = { sentenceId: scene.sentenceId, sceneId: scene.sceneId, visualId: scene.visualId,
      planFingerprint: plan.fingerprint, handoffFingerprint: handoff.fingerprint, relativePath, sha256: digest,
      width: image.info.width, height: image.info.height, uploadedAt: new Date().toISOString() };
    const previous = readSceneAssets(input.root, plan);
    const manifest: SceneAssets = { contract: "narration-scene-assets-v1", planFingerprint: plan.fingerprint,
      handoffFingerprint: handoff.fingerprint, assets: [...(previous?.assets ?? []).filter(a => a.visualId !== scene.visualId), asset]
        .sort((a, b) => plan.scenes.findIndex(s => s.visualId === a.visualId) - plan.scenes.findIndex(s => s.visualId === b.visualId)) };
    atomicWriteFile(resolvePackageArtifactPath({ packageRoot: input.root, relativePath }), image.data);
    ledger[digest] = { planFingerprint: plan.fingerprint, visualId: scene.visualId };
    // Reserve identity before publishing the mapping; a failed mapping write can be retried in the same slot.
    atomicWriteFile(ledgerPath, JSON.stringify(ledger, null, 2));
    requireFreshScenePlan(input.root, input.candidateId, plan.fingerprint);
    atomicWriteFile(join(sceneDirectory(input.root), `${plan.fingerprint}.assets.json`), JSON.stringify(manifest, null, 2));
    return asset;
  });
}
