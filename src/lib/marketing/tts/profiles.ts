import {
  ttsProfileSchema,
  type TtsProfile,
} from "@/lib/marketing/tts/contracts";
import { TtsError } from "@/lib/marketing/tts/errors";

export type TtsProfileRegistry = Readonly<Record<string, TtsProfile>>;

const STANDARD_KO_DEVELOPMENT: TtsProfile = ttsProfileSchema.parse({
  contract: "tts-profile-v1",
  profileId: "standard-ko-development",
  displayName: "Development standard Korean (not a production voice)",
  provider: "voicestudio",
  kind: "standard",
  language: "ko",
  locale: "ko-KR",
  voiceRef: "default",
  modelRef: "tts-1",
  speakingStyle: null,
  speed: null,
  enabled: true,
  metadata: {
    cloneConfigured: null,
    notes: "Development placeholder only. Does not select a production voice.",
  },
});

const OWNER_CLONE_DEVELOPMENT: TtsProfile = ttsProfileSchema.parse({
  contract: "tts-profile-v1",
  profileId: "owner-clone-development",
  displayName: "Development owner-clone slot (unconfigured)",
  provider: "voicestudio",
  kind: "cloned",
  language: "ko",
  locale: "ko-KR",
  voiceRef: null,
  modelRef: null,
  speakingStyle: null,
  speed: null,
  enabled: false,
  metadata: {
    cloneConfigured: false,
    notes: "Disabled until a clone is uploaded and approved. Does not imply an owner voice exists.",
  },
});

export const DEVELOPMENT_TTS_PROFILES: TtsProfileRegistry = {
  "standard-ko-development": STANDARD_KO_DEVELOPMENT,
  "owner-clone-development": OWNER_CLONE_DEVELOPMENT,
};

export function parseTtsProfile(value: unknown): TtsProfile {
  const parsed = ttsProfileSchema.safeParse(value);
  if (!parsed.success) {
    throw new TtsError("invalid_request", "TTS profile contract is invalid");
  }
  return parsed.data;
}

export function resolveTtsProfile(
  profileId: string,
  registry: TtsProfileRegistry = DEVELOPMENT_TTS_PROFILES,
): TtsProfile {
  const trimmed = profileId.trim();
  if (!trimmed) {
    throw new TtsError("invalid_request", "TTS profileId is required");
  }
  const profile = registry[trimmed];
  if (!profile) {
    throw new TtsError("unknown_profile", `Unknown TTS profile: ${trimmed}`);
  }
  const parsed = parseTtsProfile(profile);
  if (!parsed.enabled) {
    throw new TtsError("disabled_profile", `TTS profile is disabled: ${parsed.profileId}`);
  }
  return parsed;
}
