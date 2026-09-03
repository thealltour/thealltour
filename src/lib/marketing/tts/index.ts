export {
  TTS_PROFILE_CONTRACT,
  TTS_GENERATION_REQUEST_CONTRACT,
  TTS_GENERATION_RESULT_CONTRACT,
  TTS_PROFILE_KINDS,
  TTS_PROVIDERS,
  TTS_OUTPUT_FORMAT,
  ttsProfileSchema,
  ttsGenerationRequestSchema,
  ttsGenerationResultSchema,
  type TtsProfile,
  type TtsProfileKind,
  type TtsProviderId,
  type TtsGenerationRequest,
  type TtsGenerationResult,
  type TtsAudioResult,
} from "@/lib/marketing/tts/contracts";
export { TTS_ERROR_CODES, TtsError, isTtsError, type TtsErrorCode } from "@/lib/marketing/tts/errors";
export { TTS_MAX_INPUT_CHARS, normalizeNarrationForTts } from "@/lib/marketing/tts/normalize";
export {
  DEVELOPMENT_TTS_PROFILES,
  parseTtsProfile,
  resolveTtsProfile,
  type TtsProfileRegistry,
} from "@/lib/marketing/tts/profiles";
export {
  TTS_MAX_AUDIO_BYTES,
  TTS_WAV_MEDIA_TYPE,
  assertTtsAudioIntegrity,
  hashTtsAudio,
  parseWavPcmFacts,
} from "@/lib/marketing/tts/audioIntegrity";
export {
  buildTtsGenerationRequest,
  type TtsProvider,
  type TtsProviderGenerateInput,
} from "@/lib/marketing/tts/provider";
export {
  VOICESTUDIO_BASE_URL_ENV,
  VOICESTUDIO_API_KEY_ENV,
  VOICESTUDIO_TIMEOUT_MS_ENV,
  DEFAULT_VOICESTUDIO_TIMEOUT_MS,
  VOICESTUDIO_SPEECH_PATH,
  parseVoiceStudioConfig,
  isLoopbackVoiceStudioUrl,
} from "@/lib/marketing/tts/voiceStudio/config";
export { mapVoiceStudioSpeechBody } from "@/lib/marketing/tts/voiceStudio/mapRequest";
export { VoiceStudioTtsProvider, createVoiceStudioTtsProvider } from "@/lib/marketing/tts/voiceStudio/adapter";
export {
  TTS_GENERATION_ARTIFACT_CONTRACT,
  TTS_NARRATION_WAV_RELATIVE_PATH,
  TTS_GENERATION_JSON_RELATIVE_PATH,
  ttsSegmentAudioRelativePath,
  buildTtsGenerationArtifact,
  persistTtsGeneration,
  parsePersistedTtsGeneration,
} from "@/lib/marketing/tts/persist";
export {
  TTS_AUTHORITATIVE_CLOCK,
  DEFAULT_FFPROBE_TIMEOUT_MS,
  durationSecondsToMs,
  parseFfprobeDurationJson,
  type AudioDurationProbe,
  type PersistedWavDuration,
} from "@/lib/marketing/tts/duration/probe";
export { createFfprobeDurationProbe } from "@/lib/marketing/tts/duration/ffprobe";
export {
  AUDIO_MASTER_TIMELINE_CONTRACT,
  TTS_INTER_SEGMENT_PAUSE_MS,
  TTS_TRAILING_PAUSE_MS,
  TTS_TIMELINE_RELATIVE_PATH,
  TTS_MAX_NARRATION_SEGMENTS,
  audioMasterTimelineSchema,
  type AudioMasterTimeline,
  type AudioMasterTimelineSegment,
} from "@/lib/marketing/tts/timeline/contracts";
export {
  ttsOrderedSegmentStem,
  ttsOrderedSegmentAudioRelativePath,
  ttsOrderedSegmentGenerationRelativePath,
} from "@/lib/marketing/tts/timeline/paths";
export { buildAudioMasterTimeline } from "@/lib/marketing/tts/timeline/build";
export { persistAudioMasterTimeline } from "@/lib/marketing/tts/timeline/persist";
export {
  generateNarrationMasterTimeline,
  type NarrationSegmentInput,
  type GenerateNarrationMasterTimelineResult,
} from "@/lib/marketing/tts/timeline/orchestrate";
export {
  TTS_A6_VERIFICATION_CANDIDATE_ID,
  createA6VerificationSegments,
  parseGenerateNarrationTimelineArgs,
  runGenerateNarrationTimelineCommand,
} from "@/lib/marketing/tts/timeline/cli";
export { parseTestMarketingTtsArgs, runTestMarketingTtsCommand } from "@/lib/marketing/tts/cli";
