export const TTS_ERROR_CODES = [
  "invalid_request",
  "unknown_profile",
  "disabled_profile",
  "authentication_failed",
  "provider_unavailable",
  "provider_timeout",
  "unsupported_language",
  "unsupported_voice",
  "generation_failed",
  "malformed_provider_response",
] as const;

export type TtsErrorCode = (typeof TTS_ERROR_CODES)[number];

export class TtsError extends Error {
  readonly name = "TtsError";
  readonly code: TtsErrorCode;

  constructor(code: TtsErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function isTtsError(error: unknown): error is TtsError {
  return error instanceof TtsError;
}
