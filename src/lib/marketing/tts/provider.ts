import {
  TTS_GENERATION_REQUEST_CONTRACT,
  TTS_OUTPUT_FORMAT,
  ttsGenerationRequestSchema,
  type TtsAudioResult,
  type TtsGenerationRequest,
  type TtsProfile,
} from "@/lib/marketing/tts/contracts";
import { TtsError } from "@/lib/marketing/tts/errors";
import { normalizeNarrationForTts } from "@/lib/marketing/tts/normalize";

export type TtsProviderGenerateInput = {
  requestId: string;
  profile: TtsProfile;
  text: string;
  language?: string;
  locale?: string;
  speed?: number | null;
  speakingStyle?: string | null;
  segmentId?: string | null;
};

export interface TtsProvider {
  readonly providerId: TtsProfile["provider"];
  generate(input: TtsProviderGenerateInput): Promise<TtsAudioResult>;
}

export function buildTtsGenerationRequest(input: TtsProviderGenerateInput): TtsGenerationRequest {
  if (!input.profile.enabled) {
    throw new TtsError("disabled_profile", `TTS profile is disabled: ${input.profile.profileId}`);
  }

  const language = (input.language ?? input.profile.language).trim();
  const locale = (input.locale ?? input.profile.locale).trim();
  if (!language || !locale) {
    throw new TtsError("invalid_request", "TTS language and locale are required");
  }
  if (language !== input.profile.language) {
    throw new TtsError(
      "unsupported_language",
      `TTS request language ${language} does not match profile ${input.profile.language}`,
    );
  }

  const parsed = ttsGenerationRequestSchema.safeParse({
    contract: TTS_GENERATION_REQUEST_CONTRACT,
    requestId: input.requestId.trim(),
    profileId: input.profile.profileId,
    text: normalizeNarrationForTts(input.text),
    language,
    locale,
    outputFormat: TTS_OUTPUT_FORMAT,
    speed: input.speed ?? input.profile.speed,
    speakingStyle: input.speakingStyle ?? input.profile.speakingStyle,
    segmentId: input.segmentId ?? null,
  });
  if (!parsed.success) {
    throw new TtsError("invalid_request", "TTS generation request contract is invalid");
  }
  return parsed.data;
}
