import type { TtsProfile } from "@/lib/marketing/tts/contracts";
import type { TtsGenerationRequest } from "@/lib/marketing/tts/contracts";

/**
 * VoiceStudio 0.5.1 OpenAI-compatible speech body.
 * Always requests WAV. Does not encode a production voice choice.
 */
export type VoiceStudioSpeechBody = {
  model: string;
  input: string;
  voice: string;
  response_format: "wav";
  speed?: number;
  language?: string;
  instruct?: string;
};

export function mapVoiceStudioSpeechBody(input: {
  profile: TtsProfile;
  request: TtsGenerationRequest;
}): VoiceStudioSpeechBody {
  const body: VoiceStudioSpeechBody = {
    model: input.profile.modelRef ?? "tts-1",
    input: input.request.text,
    voice: input.profile.voiceRef ?? "default",
    response_format: "wav",
  };
  if (input.request.speed != null) {
    body.speed = input.request.speed;
  }
  if (input.request.language) {
    body.language = input.request.language;
  }
  if (input.request.speakingStyle) {
    body.instruct = input.request.speakingStyle;
  }
  return body;
}
