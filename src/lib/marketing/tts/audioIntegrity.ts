import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { TtsError } from "@/lib/marketing/tts/errors";

export const TTS_MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const TTS_WAV_MEDIA_TYPE = "audio/wav" as const;

export type WavPcmFacts = {
  sampleRate: number | null;
  channels: number | null;
  containerDurationMs: number | null;
};

function startsWithAscii(buffer: Buffer, offset: number, expected: string): boolean {
  return buffer.toString("ascii", offset, offset + expected.length) === expected;
}

function looksLikeDocumentPayload(buffer: Buffer): boolean {
  const start = buffer.subarray(0, Math.min(buffer.byteLength, 64)).toString("utf8").trimStart();
  return start.startsWith("{") || start.startsWith("[") || start.startsWith("<");
}

function readChunkSize(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

export function parseWavPcmFacts(buffer: Buffer): WavPcmFacts {
  if (buffer.byteLength < 44 || !startsWithAscii(buffer, 0, "RIFF") || !startsWithAscii(buffer, 8, "WAVE")) {
    throw new TtsError("malformed_provider_response", "TTS audio is not a RIFF/WAVE payload");
  }

  let offset = 12;
  let sampleRate: number | null = null;
  let channels: number | null = null;
  let byteRate: number | null = null;
  let dataBytes: number | null = null;

  while (offset + 8 <= buffer.byteLength) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = readChunkSize(buffer, offset + 4);
    const dataOffset = offset + 8;
    if (size < 0 || dataOffset + size > buffer.byteLength) {
      break;
    }
    if (id === "fmt " && size >= 16) {
      channels = buffer.readUInt16LE(dataOffset + 2);
      sampleRate = buffer.readUInt32LE(dataOffset + 4);
      byteRate = buffer.readUInt32LE(dataOffset + 8);
    }
    if (id === "data") {
      dataBytes = size;
    }
    offset = dataOffset + size + (size % 2);
  }

  const containerDurationMs =
    byteRate && byteRate > 0 && dataBytes != null
      ? Math.round((dataBytes / byteRate) * 1000)
      : null;

  return { sampleRate, channels, containerDurationMs };
}

export function assertTtsAudioIntegrity(buffer: Buffer): WavPcmFacts {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength === 0) {
    throw new TtsError("malformed_provider_response", "TTS audio is empty");
  }
  if (buffer.byteLength > TTS_MAX_AUDIO_BYTES) {
    throw new TtsError(
      "malformed_provider_response",
      `TTS audio exceeds ${TTS_MAX_AUDIO_BYTES} bytes`,
    );
  }
  if (looksLikeDocumentPayload(buffer)) {
    throw new TtsError("malformed_provider_response", "TTS audio looks like JSON or HTML, not WAV");
  }
  return parseWavPcmFacts(buffer);
}

export function hashTtsAudio(buffer: Buffer): { sha256: string; byteSize: number } {
  return {
    sha256: sha256Buffer(buffer),
    byteSize: buffer.byteLength,
  };
}
