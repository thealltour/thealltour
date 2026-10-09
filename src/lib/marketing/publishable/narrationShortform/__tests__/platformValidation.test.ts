import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { layoutPolicyFingerprint } from "../layoutPolicy";
import { addPlatformValidationRecord, platformEvidencePath, platformValidationInputSchema, platformValidationSummary, readPlatformValidationRecords } from "../platformValidation";

const base = { platform: "youtube_shorts", os: "android", osVersion: "16", device: "Pixel 9", screen: { widthPx: 1080, heightPx: 2424 }, appVersion: "20.40.37", checkedOn: "2026-10-10",
  uiState: "default_playback", method: "real_device", result: "pass", qaVideo: "1080x1920", qaVideoSha256: null, notes: "" } as const;
const png = { name: "capture.png", type: "image/png", bytes: Buffer.from("fake-png") };

describe("platform validation records", () => {
  let dir = ""; const previous = process.env.NARRATION_PLATFORM_VALIDATION_DIR;
  beforeAll(() => { dir = mkdtempSync(join(tmpdir(), "platform-validation-")); process.env.NARRATION_PLATFORM_VALIDATION_DIR = dir; });
  afterAll(() => { rmSync(dir, { recursive: true, force: true }); if (previous === undefined) delete process.env.NARRATION_PLATFORM_VALIDATION_DIR; else process.env.NARRATION_PLATFORM_VALIDATION_DIR = previous; });

  it("only lets a real-device record with evidence pass, and keeps the preset pending", () => {
    expect(platformValidationInputSchema.safeParse({ ...base, method: "local_overlay" }).success).toBe(false);
    expect(() => addPlatformValidationRecord({ ...base, method: "local_overlay" }, [png])).toThrow(/실제 기기/);
    expect(() => addPlatformValidationRecord({ ...base }, [])).toThrow(/증빙/);
    expect(() => addPlatformValidationRecord({ ...base }, [{ ...png, type: "application/pdf" }])).toThrow(/PNG/);
    expect(readPlatformValidationRecords()).toHaveLength(0); expect(existsSync(join(dir, ".lock"))).toBe(false);

    const empty = platformValidationSummary();
    expect(empty.platformValidation).toBe("pending"); expect(empty.cells.every(c => c.status === "not_checked")).toBe(true);
    expect(empty.cells.map(c => c.uiState)).not.toContain("comments_open");

    addPlatformValidationRecord({ ...base, method: "local_overlay", result: "inconclusive", platform: "tiktok" }, []);
    const pass = addPlatformValidationRecord({ ...base }, [png]);
    expect(pass.presetFingerprint).toBe(layoutPolicyFingerprint()); expect(pass.evidence[0]!.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(platformEvidencePath(pass.evidence[0]!.fileName)).toString()).toBe("fake-png");
    addPlatformValidationRecord({ ...base, uiState: "comments_open", result: "fail" }, []);

    const summary = platformValidationSummary(); const cell = (p: string, s: string) => summary.cells.find(c => c.platform === p && c.uiState === s)!;
    expect(summary.platformValidation).toBe("pending");
    expect(cell("youtube_shorts", "default_playback").status).toBe("pass_on_real_device");
    // A pass in normal playback says nothing about the expanded description state.
    expect(cell("youtube_shorts", "description_expanded").status).toBe("not_checked");
    // A local overlay never fills a platform cell, even for another result.
    expect(cell("tiktok", "default_playback").status).toBe("not_checked"); expect(summary.localReferenceRecords).toBe(1);
    expect(summary.otherStateRecords).toBe(1);

    addPlatformValidationRecord({ ...base, result: "fail" }, []);
    expect(platformValidationSummary().cells.find(c => c.platform === "youtube_shorts" && c.uiState === "default_playback")!.status).toBe("fail");
  });

  it("keeps records from another preset fingerprint as history only", () => {
    const file = join(dir, "records.json"); const data = JSON.parse(readFileSync(file, "utf8")) as { records: { presetFingerprint: string; input: { platform: string } }[] };
    data.records.push({ ...data.records.find(r => r.input.platform === "youtube_shorts" && (r as unknown as { evidence: unknown[] }).evidence.length)!, recordId: "7b0c8c2e-8f43-4c55-9c8b-3f0d7c0e6a11", presetFingerprint: "0".repeat(64), input: { ...base, platform: "instagram_reels" } } as never);
    writeFileSync(file, JSON.stringify(data));
    const summary = platformValidationSummary();
    expect(summary.previousPresetRecords).toBe(1);
    expect(summary.cells.find(c => c.platform === "instagram_reels" && c.uiState === "default_playback")!.status).toBe("not_checked");
    expect(() => platformEvidencePath("../records.json")).toThrow();
  });
});
