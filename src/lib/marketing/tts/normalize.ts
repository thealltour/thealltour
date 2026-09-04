import { TtsError } from "@/lib/marketing/tts/errors";

export const TTS_MAX_INPUT_CHARS = 4096;

export function normalizeNarrationForTts(text: string): string {
  if (typeof text !== "string") {
    throw new TtsError("invalid_request", "TTS narration text must be a string");
  }

  const normalized = text.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!normalized) {
    throw new TtsError("invalid_request", "TTS narration text is empty");
  }
  if (normalized.length > TTS_MAX_INPUT_CHARS) {
    throw new TtsError(
      "invalid_request",
      `TTS narration text exceeds ${TTS_MAX_INPUT_CHARS} characters`,
    );
  }
  return normalized;
}
