import "server-only";

import {
  TTS_GENERATION_RESULT_CONTRACT,
  ttsGenerationResultSchema,
  type TtsAudioResult,
} from "@/lib/marketing/tts/contracts";
import { TtsError, type TtsErrorCode } from "@/lib/marketing/tts/errors";
import { assertTtsAudioIntegrity, hashTtsAudio, TTS_WAV_MEDIA_TYPE } from "@/lib/marketing/tts/audioIntegrity";
import { buildTtsGenerationRequest, type TtsProvider, type TtsProviderGenerateInput } from "@/lib/marketing/tts/provider";
import {
  parseVoiceStudioConfig,
  VOICESTUDIO_SPEECH_PATH,
  type VoiceStudioConfig,
} from "@/lib/marketing/tts/voiceStudio/config";
import { mapVoiceStudioSpeechBody } from "@/lib/marketing/tts/voiceStudio/mapRequest";

export type VoiceStudioFetch = typeof fetch;

export type VoiceStudioTtsProviderOptions = VoiceStudioConfig & {
  fetch?: VoiceStudioFetch;
  retryDelayMs?: number;
};

/**
 * VoiceStudio 0.5.1 contract used by this adapter (do not guess other paths):
 *
 * POST {baseUrl}/v1/audio/speech
 * Header: Authorization: Bearer $OMNIVOICE_API_KEY (required off-loopback)
 * JSON body: model, input, voice, response_format="wav", optional speed/language/instruct
 * Success: streaming raw audio bytes (not JSON). Content-Length, Content-Disposition.
 * Errors: FastAPI {detail}; 401 API key; 400 unknown/unavailable engine; 429 GPU pool;
 *         503 load timeout; 500 generate fail. Duration is not returned.
 */
export class VoiceStudioTtsProvider implements TtsProvider {
  readonly providerId = "voicestudio" as const;
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly #apiKey: string | null;
  readonly #fetchImpl: VoiceStudioFetch;
  readonly #retryDelayMs: number;

  constructor(input: VoiceStudioTtsProviderOptions) {
    this.baseUrl = input.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = input.timeoutMs;
    this.#apiKey = input.apiKey?.trim() || null;
    this.#fetchImpl = input.fetch ?? fetch;
    this.#retryDelayMs = input.retryDelayMs ?? 50;
  }

  async generate(input: TtsProviderGenerateInput): Promise<TtsAudioResult> {
    if (input.profile.provider !== "voicestudio") {
      throw new TtsError("invalid_request", "Profile provider is not voicestudio");
    }
    const request = buildTtsGenerationRequest(input);
    const body = mapVoiceStudioSpeechBody({ profile: input.profile, request });
    const audio = await this.requestSpeech(body);
    const facts = assertTtsAudioIntegrity(audio);
    const integrity = hashTtsAudio(audio);
    const generatedAt = new Date().toISOString();
    const result = ttsGenerationResultSchema.parse({
      contract: TTS_GENERATION_RESULT_CONTRACT,
      requestId: request.requestId,
      provider: this.providerId,
      profileId: request.profileId,
      mediaType: TTS_WAV_MEDIA_TYPE,
      format: "wav",
      sampleRate: facts.sampleRate,
      channels: facts.channels,
      byteSize: integrity.byteSize,
      sha256: integrity.sha256,
      providerGenerationId: null,
      providerReportedDurationMs: null,
      containerDurationMs: facts.containerDurationMs,
      timelineAuthoritative: false,
      generatedAt,
      segmentId: request.segmentId,
      metadata: {
        modelRef: input.profile.modelRef,
        voiceRef: input.profile.voiceRef,
        httpStatus: 200,
      },
    });
    return { ...result, audio };
  }

  private async requestSpeech(
    body: ReturnType<typeof mapVoiceStudioSpeechBody>,
    attempt = 0,
  ): Promise<Buffer> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "audio/wav, application/octet-stream");
    if (this.#apiKey) {
      headers.set("Authorization", `Bearer ${this.#apiKey}`);
    }

    try {
      const response = await this.#fetchImpl(joinUrl(this.baseUrl, VOICESTUDIO_SPEECH_PATH), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: "no-store",
      });
      return await this.readSpeechResponse(response, body, attempt);
    } catch (error) {
      if (error instanceof TtsError) throw error;
      if (isAbortError(error)) {
        throw new TtsError("provider_timeout", `VoiceStudio timed out after ${this.timeoutMs}ms`);
      }
      if (attempt === 0 && isTransientNetworkError(error)) {
        await delay(this.#retryDelayMs);
        return this.requestSpeech(body, 1);
      }
      throw new TtsError("provider_unavailable", redact("VoiceStudio network request failed", this.#apiKey));
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readSpeechResponse(
    response: Response,
    body: ReturnType<typeof mapVoiceStudioSpeechBody>,
    attempt: number,
  ): Promise<Buffer> {
    if (response.status === 401 || response.status === 403) {
      throw new TtsError("authentication_failed", "VoiceStudio authentication failed");
    }
    if (response.status === 504) {
      throw new TtsError("provider_timeout", "VoiceStudio generation timed out");
    }
    if ((response.status === 502 || response.status === 503) && attempt === 0) {
      await delay(this.#retryDelayMs);
      return this.requestSpeech(body, 1);
    }
    if (response.status !== 200) {
      const detail = await readErrorDetail(response);
      throw new TtsError(classifyVoiceStudioStatus(response.status, detail), redact(detail, this.#apiKey));
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new TtsError("malformed_provider_response", "VoiceStudio returned empty audio");
    }
    return bytes;
  }
}

export function createVoiceStudioTtsProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  options: { fetch?: VoiceStudioFetch; retryDelayMs?: number } = {},
): VoiceStudioTtsProvider {
  return new VoiceStudioTtsProvider({
    ...parseVoiceStudioConfig(env),
    fetch: options.fetch,
    retryDelayMs: options.retryDelayMs,
  });
}

function joinUrl(baseUrl: string, path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl.replace(/\/+$/, "")}${suffix}`;
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function isTransientNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === "TypeError" ||
    message.includes("fetch failed") ||
    message.includes("econnreset") ||
    message.includes("econnrefused")
  );
}

function classifyVoiceStudioStatus(status: number, detail: string): TtsErrorCode {
  const lowered = detail.toLowerCase();
  if (status === 401 || status === 403) return "authentication_failed";
  if (status === 429 || status === 502 || status === 503) return "provider_unavailable";
  if (status === 504) return "provider_timeout";
  if (status === 404) return "unsupported_voice";
  if (status === 422) return "invalid_request";
  if (status === 400) {
    if (lowered.includes("language")) return "unsupported_language";
    if (
      lowered.includes("unknown model") ||
      lowered.includes("not available") ||
      lowered.includes("voice") ||
      lowered.includes("engine") ||
      lowered.includes("profile")
    ) {
      return "unsupported_voice";
    }
    return "invalid_request";
  }
  if (status === 500) return "generation_failed";
  return "generation_failed";
}

async function readErrorDetail(response: Response): Promise<string> {
  const raw = await response.text();
  if (!raw) return `VoiceStudio HTTP ${response.status}`;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "detail" in parsed) {
      const detail = (parsed as { detail: unknown }).detail;
      if (typeof detail === "string" && detail.trim()) return detail.trim();
    }
  } catch {
    // not JSON
  }
  return `VoiceStudio HTTP ${response.status}`;
}

function redact(message: string, secret: string | null): string {
  if (!secret) return message;
  return message.includes(secret) ? message.split(secret).join("[redacted]") : message;
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
