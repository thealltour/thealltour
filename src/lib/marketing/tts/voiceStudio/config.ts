import "server-only";

import { TtsError } from "@/lib/marketing/tts/errors";

export const VOICESTUDIO_BASE_URL_ENV = "VOICESTUDIO_BASE_URL";
export const VOICESTUDIO_API_KEY_ENV = "OMNIVOICE_API_KEY";
export const VOICESTUDIO_TIMEOUT_MS_ENV = "VOICESTUDIO_TIMEOUT_MS";

export const DEFAULT_VOICESTUDIO_TIMEOUT_MS = 120_000;
export const VOICESTUDIO_SPEECH_PATH = "/v1/audio/speech";

export type VoiceStudioConfig = {
  baseUrl: string;
  apiKey: string | null;
  timeoutMs: number;
};

function readEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string,
): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function parsePositiveInt(raw: string | undefined, fallback: number, envName: string): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new TtsError("invalid_request", `${envName} must be a positive integer`);
  }
  return value;
}

export function isLoopbackVoiceStudioUrl(baseUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return false;
  }
  return url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
}

export function parseVoiceStudioBaseUrl(raw: string | undefined): string {
  if (!raw) {
    throw new TtsError("invalid_request", "VOICESTUDIO_BASE_URL is required");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new TtsError("invalid_request", "VOICESTUDIO_BASE_URL is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TtsError("invalid_request", "VOICESTUDIO_BASE_URL must be http or https");
  }
  return raw.replace(/\/+$/, "");
}

export function parseVoiceStudioConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): VoiceStudioConfig {
  const baseUrl = parseVoiceStudioBaseUrl(readEnv(env, VOICESTUDIO_BASE_URL_ENV));
  const apiKey = readEnv(env, VOICESTUDIO_API_KEY_ENV) ?? null;
  if (!isLoopbackVoiceStudioUrl(baseUrl) && !apiKey) {
    throw new TtsError(
      "authentication_failed",
      "OMNIVOICE_API_KEY is required for non-loopback VoiceStudio URLs",
    );
  }
  return {
    baseUrl,
    apiKey,
    timeoutMs: parsePositiveInt(
      readEnv(env, VOICESTUDIO_TIMEOUT_MS_ENV),
      DEFAULT_VOICESTUDIO_TIMEOUT_MS,
      VOICESTUDIO_TIMEOUT_MS_ENV,
    ),
  };
}
