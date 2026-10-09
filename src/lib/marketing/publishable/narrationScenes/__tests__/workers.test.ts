// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ invoke: vi.fn(), source: vi.fn(), plan: vi.fn(), save: vi.fn(), fresh: vi.fn(), handoff: vi.fn() }));
vi.mock("@/lib/marketing/hermesRuntime/launcher", () => ({ invokeMarketingHermesAgent: state.invoke }));
vi.mock("@/lib/marketing/canonicalAsset/persistence", () => ({ readCanonicalAssetFromPackage: () => null }));
vi.mock("../service", async () => {
  const { stableFingerprint } = await import("../../narration/fingerprint");
  return { loadSceneSource: state.source, readScenePlan: state.plan, mutateScenePlan: state.save, requireFreshScenePlan: state.fresh, readSceneHandoff: state.handoff, sceneDirectory: (root: string) => root, sceneHash: stableFingerprint, withSceneLock: (_root: string, action: () => unknown) => action() };
});
import { runSceneWorker, importSceneResult } from "../workers";
const ids = ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"];
const input = { action: "generate" as const, audioJobId: "00000000-0000-4000-8000-000000000003", expectedRevision: null, expectedFingerprint: null, expectedNarrationRevision: 1, expectedNarrationFingerprint: "a".repeat(64) };
const prompts = ids.map(sentenceId => ({ sentenceId, visualPrompt: "장소·피사체·구도를 구체적으로 표현하는 세로 이미지" }));
let root: string;
beforeEach(() => {
  vi.resetAllMocks(); root = mkdtempSync(join(tmpdir(), "scene-worker-test-"));
  state.source.mockReturnValue({ narration: { revision: 1, fingerprint: input.expectedNarrationFingerprint, sentences: ids.map(sentenceId => ({ sentenceId })) }, timeline: {} });
  state.plan.mockReturnValue(null); state.save.mockReturnValue({ plan: { approval: null } });
});
afterEach(() => rmSync(root, { recursive: true, force: true }));
describe("Narration shared visual workers", () => {
  it("saves a validated sentence draft without automatic approval", async () => {
    state.invoke.mockResolvedValue(JSON.stringify({ prompts }));
    await expect(runSceneWorker(root, "candidate", input)).resolves.toEqual({ plan: { approval: null } });
    expect(state.invoke).toHaveBeenCalledWith(expect.objectContaining({ profileId: "shared-visual-planner", withTransportRetry: false }));
    expect(state.save).toHaveBeenCalledWith(root, "candidate", expect.objectContaining({ action: "save", prompts }));
  });
  it("rejects reordered or missing sentence visuals and preserves the old plan", async () => {
    for (const value of [[prompts[1], prompts[0]], [prompts[0]]]) {
      state.invoke.mockResolvedValue(JSON.stringify({ prompts: value }));
      await expect(runSceneWorker(root, "candidate", input)).rejects.toThrow("문장 수·ID·순서");
    }
    expect(state.save).not.toHaveBeenCalled();
  });
  it("preserves the old plan on transport failure", async () => {
    state.invoke.mockRejectedValue(new Error("private provider error"));
    await expect(runSceneWorker(root, "candidate", input)).rejects.toThrow("기존 계획은 유지");
    expect(state.save).not.toHaveBeenCalled();
  });
  it("rejects an output generated against a concurrently changed baseline", async () => {
    state.invoke.mockResolvedValue(JSON.stringify({ prompts }));
    state.plan.mockReturnValueOnce(null).mockReturnValueOnce({ revision: 1, fingerprint: "b".repeat(64) });
    await expect(runSceneWorker(root, "candidate", input)).rejects.toThrow("원고·계획이 변경");
    expect(state.save).not.toHaveBeenCalled();
  });
  it("pins Astra results to the exact request and rejects stale/reordered/replaced results", async () => {
    const plan = { revision: 1, fingerprint: "b".repeat(64), scenes: ids.map(visualId => ({ visualId })) };
    state.plan.mockReturnValue(plan); state.fresh.mockReturnValue(plan); state.handoff.mockReturnValue({ fingerprint: "c".repeat(64) });
    const visuals = ids.map(visualId => ({ visualId, imagePrompt: "승인된 계획에 맞춘 구체적인 이미지", expectedFilename: `${visualId}.png` }));
    state.invoke.mockResolvedValue(JSON.stringify({ visuals }));
    const response = await runSceneWorker(root, "candidate", { ...input, action: "write-handoff", expectedRevision: 1, expectedFingerprint: plan.fingerprint });
    if (!("astraRequest" in response) || !response.astraRequest) throw new Error("missing request");
    const payload = { contract: "narration-astra-result-v1", candidateId: "candidate", requestFingerprint: response.astraRequest.fingerprint, visuals };
    expect(() => importSceneResult(root, "candidate", plan.fingerprint, { ...payload, requestFingerprint: "d".repeat(64) })).toThrow("현재 Astra 요청문");
    expect(() => importSceneResult(root, "candidate", plan.fingerprint, { ...payload, visuals: [...visuals].reverse() })).toThrow("ID·순서·파일명");
    expect(importSceneResult(root, "candidate", plan.fingerprint, payload)).toEqual({ imported: true });
    expect(importSceneResult(root, "candidate", plan.fingerprint, payload)).toEqual({ imported: true });
    expect(() => importSceneResult(root, "candidate", plan.fingerprint, { ...payload, visuals: visuals.map(v => ({ ...v, imagePrompt: "다른 프롬프트" })) })).toThrow("이미 확정");
  });
});
