import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { NarrationError } from "../narration/persistence";
import { layoutPolicyFingerprint, SHORTFORM_LAYOUT_POLICY } from "./layoutPolicy";

/**
 * Human records of watching the QA video on a real phone app. The common preset is a project choice, not a platform guarantee:
 * only a real-device record with evidence can pass, a pass covers only its own platform/app/UI state, and nothing here marks the
 * preset as validated for every UI state. Records are tied to the preset fingerprint; a preset change leaves them as history.
 */
export const PLATFORMS = { youtube_shorts: "YouTube Shorts", instagram_reels: "Instagram Reels", tiktok: "TikTok" } as const;
export const UI_STATES = { default_playback: "기본 재생 화면", description_expanded: "설명·캡션 펼침", comments_open: "댓글 열림", paused_controls: "일시정지·재생 컨트롤 표시" } as const;
/** Combinations reported in the coverage summary. Other states may be recorded but are never implied. */
export const REQUIRED_UI_STATES = ["default_playback", "description_expanded"] as const;
const EVIDENCE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov" } as const;
const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const evidenceSchema = z.object({ fileName: z.string().regex(/^[a-f0-9-]{36}\.(png|jpg|webp|mp4|mov)$/), originalName: z.string().max(200), mediaType: z.enum(Object.keys(EVIDENCE_TYPES) as [keyof typeof EVIDENCE_TYPES]), sha256: hash, byteSize: z.number().int().positive() }).strict();
export const platformValidationInputSchema = z.object({ platform: z.enum(Object.keys(PLATFORMS) as [keyof typeof PLATFORMS]), os: z.enum(["ios", "android"]), osVersion: z.string().trim().min(1).max(40),
  device: z.string().trim().min(1).max(80), screen: z.object({ widthPx: z.number().int().min(200).max(10000), heightPx: z.number().int().min(200).max(10000) }).strict(), appVersion: z.string().trim().min(1).max(40),
  checkedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), uiState: z.enum(Object.keys(UI_STATES) as [keyof typeof UI_STATES]), method: z.enum(["real_device", "local_overlay"]),
  result: z.enum(["pass", "fail", "inconclusive"]), qaVideo: z.enum(["720x1280", "1080x1920"]), qaVideoSha256: hash.nullable(), notes: z.string().max(2000) }).strict()
  .refine(r => r.result !== "pass" || r.method === "real_device", { message: "real_device_only" });
export const platformValidationRecordSchema = z.object({ recordId: z.string().uuid(), presetPolicyId: z.string(), presetFingerprint: hash, recordedAt: z.string().datetime(),
  input: platformValidationInputSchema, evidence: z.array(evidenceSchema).max(5) }).strict()
  .refine(r => r.input.result !== "pass" || r.evidence.length > 0, { message: "evidence_required" });
export type PlatformValidationRecord = z.infer<typeof platformValidationRecordSchema>;
const fileSchema = z.object({ contract: z.literal("narration-platform-validation-records-v1"), records: z.array(platformValidationRecordSchema).max(2000) }).strict();

export const platformValidationDirectory = () => process.env.NARRATION_PLATFORM_VALIDATION_DIR || join(process.cwd(), "data/narration-platform-validation");
const recordsPath = () => join(platformValidationDirectory(), "records.json");
export function readPlatformValidationRecords(): PlatformValidationRecord[] {
  if (!existsSync(recordsPath())) return [];
  return fileSchema.parse(JSON.parse(readFileSync(recordsPath(), "utf8"))).records;
}
export function platformEvidencePath(fileName: string) {
  if (!evidenceSchema.shape.fileName.safeParse(fileName).success) throw new NarrationError("증빙 파일 이름이 올바르지 않습니다.", 400);
  return join(platformValidationDirectory(), "evidence", fileName);
}
export function addPlatformValidationRecord(input: z.infer<typeof platformValidationInputSchema>, files: { name: string; type: string; bytes: Buffer }[]) {
  if (input.result === "pass" && input.method !== "real_device") throw new NarrationError("통과는 실제 기기 앱에서 확인한 기록만 가능합니다. 로컬 박스 검사·가상 오버레이는 참고 기록입니다.", 400);
  if (input.result === "pass" && !files.length) throw new NarrationError("통과 기록에는 화면 캡처나 녹화 같은 증빙 파일이 필요합니다.", 400);
  if (files.length > 5) throw new NarrationError("증빙 파일은 5개까지 올릴 수 있습니다.", 400);
  mkdirSync(join(platformValidationDirectory(), "evidence"), { recursive: true }); const lock = join(platformValidationDirectory(), ".lock");
  try { mkdirSync(lock); } catch { throw new NarrationError("다른 검수 기록을 저장하는 중입니다. 잠시 후 다시 시도해주세요."); }
  try {
    const evidence = files.map(file => {
      const extension = EVIDENCE_TYPES[file.type as keyof typeof EVIDENCE_TYPES]; if (!extension) throw new NarrationError("증빙은 PNG·JPEG·WebP 이미지나 MP4·MOV 영상만 올릴 수 있습니다.", 400);
      if (!file.bytes.length || file.bytes.length > MAX_EVIDENCE_BYTES) throw new NarrationError("증빙 파일은 25MB 이하여야 합니다.", 400);
      const fileName = `${randomUUID()}.${extension}`; atomicWriteFile(platformEvidencePath(fileName), file.bytes, 0o600);
      return { fileName, originalName: file.name.slice(0, 200), mediaType: file.type as keyof typeof EVIDENCE_TYPES, sha256: sha256Buffer(file.bytes), byteSize: file.bytes.length };
    });
    const record = platformValidationRecordSchema.parse({ recordId: randomUUID(), presetPolicyId: SHORTFORM_LAYOUT_POLICY.policyId, presetFingerprint: layoutPolicyFingerprint(), recordedAt: new Date().toISOString(), input, evidence });
    atomicWriteFile(recordsPath(), JSON.stringify(fileSchema.parse({ contract: "narration-platform-validation-records-v1", records: [...readPlatformValidationRecords(), record] }), null, 2), 0o600);
    return record;
  } finally { rmSync(lock, { recursive: true }); }
}
type CellStatus = "not_checked" | "pass_on_real_device" | "fail" | "inconclusive";
/**
 * Per platform × required UI state for the current preset: the latest real-device result (local overlays never count).
 * `platformValidation` stays "pending" — a summary of listed combinations, never a claim about every UI state.
 */
export function platformValidationSummary(records = readPlatformValidationRecords()) {
  const fingerprint = layoutPolicyFingerprint(); const current = records.filter(r => r.presetFingerprint === fingerprint);
  const cells = (Object.keys(PLATFORMS) as (keyof typeof PLATFORMS)[]).flatMap(platform => REQUIRED_UI_STATES.map(uiState => {
    const real = current.filter(r => r.input.platform === platform && r.input.uiState === uiState && r.input.method === "real_device").sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
    const latest = real[0]; const status: CellStatus = !latest ? "not_checked" : latest.input.result === "pass" ? "pass_on_real_device" : latest.input.result;
    return { platform, uiState, status, recordId: latest?.recordId ?? null, device: latest ? `${latest.input.device} · ${latest.input.os} ${latest.input.osVersion} · 앱 ${latest.input.appVersion}` : null, checkedOn: latest?.input.checkedOn ?? null };
  }));
  return { presetPolicyId: SHORTFORM_LAYOUT_POLICY.policyId, presetFingerprint: fingerprint, platformValidation: SHORTFORM_LAYOUT_POLICY.platformValidation, cells,
    otherStateRecords: current.filter(r => !(REQUIRED_UI_STATES as readonly string[]).includes(r.input.uiState)).length, localReferenceRecords: current.filter(r => r.input.method === "local_overlay").length,
    previousPresetRecords: records.length - current.length,
    statement: "표시된 플랫폼·앱 버전·화면 상태에서 확인한 결과만 나타냅니다. 다른 기기·앱 버전·화면 상태에서 가리지 않는다는 뜻이 아닙니다." };
}
export const platformLabels = { platforms: PLATFORMS, uiStates: UI_STATES };
