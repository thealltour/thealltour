import { z } from "zod";

export const TTS_PROFILE_CONTRACT = "tts-profile-v1" as const;
export const TTS_GENERATION_REQUEST_CONTRACT = "tts-generation-request-v1" as const;
export const TTS_GENERATION_RESULT_CONTRACT = "tts-generation-result-v1" as const;

export const TTS_PROFILE_KINDS = ["standard", "cloned", "designed"] as const;
export type TtsProfileKind = (typeof TTS_PROFILE_KINDS)[number];

export const TTS_PROVIDERS = ["voicestudio"] as const;
export type TtsProviderId = (typeof TTS_PROVIDERS)[number];

export const TTS_OUTPUT_FORMAT = "wav" as const;

const boundedString = (max: number) => z.string().max(max);

export const ttsProfileSchema = z
  .object({
    contract: z.literal(TTS_PROFILE_CONTRACT),
    profileId: boundedString(64),
    displayName: boundedString(120),
    provider: z.enum(TTS_PROVIDERS),
    kind: z.enum(TTS_PROFILE_KINDS),
    language: boundedString(16),
    locale: boundedString(32),
    voiceRef: boundedString(128).nullable(),
    modelRef: boundedString(128).nullable(),
    speakingStyle: boundedString(200).nullable(),
    speed: z.number().min(0.25).max(4).nullable(),
    enabled: z.boolean(),
    metadata: z
      .object({
        cloneConfigured: z.boolean().nullable(),
        notes: boundedString(240).nullable(),
      })
      .strict(),
  })
  .strict();

export const ttsGenerationRequestSchema = z
  .object({
    contract: z.literal(TTS_GENERATION_REQUEST_CONTRACT),
    requestId: boundedString(80),
    profileId: boundedString(64),
    text: boundedString(4096),
    language: boundedString(16),
    locale: boundedString(32),
    outputFormat: z.literal(TTS_OUTPUT_FORMAT),
    speed: z.number().min(0.25).max(4).nullable(),
    speakingStyle: boundedString(200).nullable(),
    segmentId: boundedString(64).nullable(),
  })
  .strict();

export const ttsGenerationResultSchema = z
  .object({
    contract: z.literal(TTS_GENERATION_RESULT_CONTRACT),
    requestId: boundedString(80),
    provider: z.enum(TTS_PROVIDERS),
    profileId: boundedString(64),
    mediaType: z.literal("audio/wav"),
    format: z.literal(TTS_OUTPUT_FORMAT),
    sampleRate: z.number().int().positive().nullable(),
    channels: z.number().int().positive().nullable(),
    byteSize: z.number().int().nonnegative(),
    sha256: z.string().length(64),
    providerGenerationId: boundedString(128).nullable(),
    providerReportedDurationMs: z.number().nonnegative().nullable(),
    containerDurationMs: z.number().nonnegative().nullable(),
    timelineAuthoritative: z.literal(false),
    generatedAt: boundedString(64),
    segmentId: boundedString(64).nullable(),
    metadata: z
      .object({
        modelRef: boundedString(128).nullable(),
        voiceRef: boundedString(128).nullable(),
        httpStatus: z.number().int().nullable(),
      })
      .strict(),
  })
  .strict();

export type TtsProfile = z.infer<typeof ttsProfileSchema>;
export type TtsGenerationRequest = z.infer<typeof ttsGenerationRequestSchema>;
export type TtsGenerationResult = z.infer<typeof ttsGenerationResultSchema>;

export type TtsAudioResult = TtsGenerationResult & {
  audio: Buffer;
};
