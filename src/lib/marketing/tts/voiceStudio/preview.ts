import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { configuredNarrationAudioProfiles } from "@/lib/marketing/publishable/narration/audio";
import { stableFingerprint } from "@/lib/marketing/publishable/narration/fingerprint";
import { NarrationError } from "@/lib/marketing/publishable/narration/persistence";
import { assertTtsAudioIntegrity } from "@/lib/marketing/tts/audioIntegrity";
import { parseVoiceStudioConfig } from "./config";
import { VoiceStudioTtsProvider } from "./adapter";
import { withVoiceStudioPreviewLock } from "./executionLock";

export const NARRATION_VOICE_PREVIEW_TEXT = "안녕하세요";

/** Only fixed audition audio is cached; candidate sentences/jobs/timelines are never reused. */
export async function narrationVoicePreview(profileId: string, speed: number): Promise<Buffer> {
  const base = configuredNarrationAudioProfiles().find(p => p.profileId === profileId);
  if (!base) throw new NarrationError("설정된 목소리를 선택해주세요.", 400);
  if (!Number.isFinite(speed) || speed < 0.7 || speed > 2) throw new NarrationError("속도는 0.7~2.0배 범위에서 선택해주세요.", 400);
  const profile = { ...base, speed };
  const config = parseVoiceStudioConfig();
  const key = stableFingerprint({ contract: "narration-voice-preview-v1", profile, endpoint: config.baseUrl, text: NARRATION_VOICE_PREVIEW_TEXT });
  const path = join(homedir(), ".cache/thealltour/narration-voice-previews", `${key}.wav`);
  const cached = () => {
    if (!existsSync(path)) return null;
    try { const audio = readFileSync(path); assertTtsAudioIntegrity(audio); return audio; } catch { return null; }
  };
  const audio = cached(); if (audio) return audio;
  return withVoiceStudioPreviewLock(config.baseUrl, async () => {
    const existing = cached(); if (existing) return existing;
    const result = await new VoiceStudioTtsProvider({ ...config, timeoutMs: Math.min(config.timeoutMs, 60_000) })
      .generate({ requestId: `voice-preview-${randomUUID()}`, profile, text: NARRATION_VOICE_PREVIEW_TEXT });
    atomicWriteFile(path, result.audio, 0o600);
    return result.audio;
  });
}
