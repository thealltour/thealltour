// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ plan: vi.fn() }));
vi.mock("../service", () => ({
  requireFreshScenePlan: state.plan, buildSceneHandoff: () => ({ fingerprint: "b".repeat(64) }),
  readSceneHandoff: () => ({ fingerprint: "b".repeat(64) }), readSceneAssets: () => null,
  sceneDirectory: (root: string) => root, withSceneLock: (_root: string, callback: () => unknown) => callback(),
}));
import { uploadSceneAsset } from "../assets";
const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "scene-upload-"));
  state.plan.mockReturnValue({ fingerprint: "a".repeat(64), scenes: ids.map(visualId => ({ visualId, sceneId: visualId, sentenceId: visualId })) });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
const bytes = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#ef4444" } }).png().toBuffer();
function upload(image: Buffer, fit?: "contain", visualId = ids[0]) {
  return uploadSceneAsset({ root, candidateId: "candidate", visualId, planFingerprint: "a".repeat(64), handoffFingerprint: "b".repeat(64), bytes: image, fit });
}
it("keeps an exact 9:16 image at its original resolution", async () => {
  const asset = await upload(await bytes(90, 160));
  expect([asset.width, asset.height]).toEqual([90, 160]);
});
it("pads a 2:3 image without cropping or scaling the original pixels", async () => {
  const asset = await upload(await bytes(60, 90), "contain");
  expect([asset.width, asset.height]).toEqual([63, 112]);
  const image = sharp(readFileSync(join(root, asset.relativePath)));
  const corner = await image.clone().extract({ left: 0, top: 0, width: 1, height: 1 }).removeAlpha().raw().toBuffer();
  expect([...corner]).toEqual([17, 24, 39]);
  const center = await image.clone().extract({ left: 1, top: 11, width: 60, height: 90 }).png().toBuffer();
  expect(await sharp(center).raw().toBuffer()).toEqual(await sharp(await bytes(60, 90)).raw().toBuffer());
});
it("reports actual dimensions when padding is not selected", async () => {
  await expect(upload(await bytes(60, 90))).rejects.toThrow("60×90");
});
it("rejects reuse of the same original in another slot after padding", async () => {
  const image = await bytes(60, 90);
  await upload(image, "contain");
  await expect(upload(image, "contain", ids[1])).rejects.toThrow("재사용할 수 없습니다");
});
