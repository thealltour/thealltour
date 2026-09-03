import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MarketingAssetConflictError } from "@/lib/marketing/assets/errors";
import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import {
  DEVELOPMENT_TTS_PROFILES,
  TTS_MAX_INPUT_CHARS,
  TTS_NARRATION_WAV_RELATIVE_PATH,
  TTS_GENERATION_JSON_RELATIVE_PATH,
  TtsError,
  VoiceStudioTtsProvider,
  assertTtsAudioIntegrity,
  buildTtsGenerationArtifact,
  buildTtsGenerationRequest,
  hashTtsAudio,
  mapVoiceStudioSpeechBody,
  normalizeNarrationForTts,
  parseTtsProfile,
  parseTestMarketingTtsArgs,
  persistTtsGeneration,
  resolveTtsProfile,
  runTestMarketingTtsCommand,
  ttsGenerationRequestSchema,
  ttsGenerationResultSchema,
  ttsProfileSchema,
  ttsSegmentAudioRelativePath,
  type TtsProfile,
} from "@/lib/marketing/tts";

const SECRET = "omnivoice-test-secret-key";
const tempDirs: string[] = [];

function tempRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), "marketing-tts-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function pcmWav(samples = 240, sampleRate = 24_000, channels = 1, fill = 0): Buffer {
  const dataSize = samples * channels * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28);
  buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  if (fill !== 0) buf.fill(fill, 44);
  return buf;
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function hangingFetch(_input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    const signal = init?.signal;
    if (!signal) return;
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    signal.addEventListener("abort", () => reject(abortError()));
  });
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function wavResponse(buffer: Buffer, status = 200): Response {
  return new Response(buffer, {
    status,
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(buffer.byteLength),
    },
  });
}

function standardProfile(): TtsProfile {
  return resolveTtsProfile("standard-ko-development");
}

function designedProfile(): TtsProfile {
  return parseTtsProfile({
    contract: "tts-profile-v1",
    profileId: "designed-ko-development",
    displayName: "Development designed/custom slot",
    provider: "voicestudio",
    kind: "designed",
    language: "ko",
    locale: "ko-KR",
    voiceRef: null,
    modelRef: "tts-1",
    speakingStyle: "warm",
    speed: 1,
    enabled: true,
    metadata: { cloneConfigured: null, notes: "Not a production voice." },
  });
}

function createProvider(fetchImpl: typeof fetch, overrides: Partial<ConstructorParameters<typeof VoiceStudioTtsProvider>[0]> = {}) {
  return new VoiceStudioTtsProvider({
    baseUrl: "http://voicestudio.test",
    apiKey: SECRET,
    timeoutMs: 1_000,
    fetch: fetchImpl,
    retryDelayMs: 0,
    ...overrides,
  });
}

function secretLeak(value: unknown): boolean {
  const serialized = JSON.stringify(value, (_key, nested) => {
    if (Buffer.isBuffer(nested)) return undefined;
    return nested;
  });
  return serialized.includes(SECRET) || /OMNIVOICE_API_KEY|Bearer /i.test(serialized);
}

describe("TTS profile contracts", () => {
  it("1. TtsProfile contract validates", () => {
    expect(ttsProfileSchema.parse(standardProfile()).contract).toBe("tts-profile-v1");
  });

  it("2. standard profile validates", () => {
    const profile = DEVELOPMENT_TTS_PROFILES["standard-ko-development"];
    expect(profile.kind).toBe("standard");
    expect(profile.language).toBe("ko");
    expect(profile.locale).toBe("ko-KR");
    expect(profile.enabled).toBe(true);
    expect(parseTtsProfile(profile).profileId).toBe("standard-ko-development");
  });

  it("3. cloned and designed profiles validate", () => {
    const cloned = DEVELOPMENT_TTS_PROFILES["owner-clone-development"];
    expect(cloned.kind).toBe("cloned");
    expect(cloned.enabled).toBe(false);
    expect(cloned.metadata.cloneConfigured).toBe(false);
    expect(cloned.voiceRef).toBeNull();
    expect(parseTtsProfile(cloned).profileId).toBe("owner-clone-development");
    expect(designedProfile().kind).toBe("designed");
  });

  it("4. unknown profile typed error", () => {
    try {
      resolveTtsProfile("production-owner-voice");
      throw new Error("expected unknown_profile");
    } catch (error) {
      expect(error).toBeInstanceOf(TtsError);
      expect((error as TtsError).code).toBe("unknown_profile");
    }
  });

  it("5. disabled profile typed error", () => {
    try {
      resolveTtsProfile("owner-clone-development");
      throw new Error("expected disabled_profile");
    } catch (error) {
      expect(error).toBeInstanceOf(TtsError);
      expect((error as TtsError).code).toBe("disabled_profile");
    }
  });

  it("6. no secrets in profile object and no production default", () => {
    for (const profile of Object.values(DEVELOPMENT_TTS_PROFILES)) {
      expect("apiKey" in profile).toBe(false);
      expect("authorization" in profile).toBe(false);
      expect(secretLeak(profile)).toBe(false);
      expect(() => parseTtsProfile({ ...profile, apiKey: SECRET })).toThrow(TtsError);
    }
    expect(DEVELOPMENT_TTS_PROFILES["standard-ko-development"].metadata.notes).toMatch(/production voice/i);
    expect(DEVELOPMENT_TTS_PROFILES["owner-clone-development"].metadata.notes).toMatch(/does not imply an owner voice/i);
  });
});

describe("TTS narration normalization", () => {
  it("7. Korean narration normalization preserved", () => {
    expect(normalizeNarrationForTts("  다낭,  효도여행!\n ")).toBe("다낭, 효도여행!");
  });

  it("8. empty narration rejected", () => {
    expect(() => normalizeNarrationForTts("   \n\t  ")).toThrow(TtsError);
    try {
      normalizeNarrationForTts("");
    } catch (error) {
      expect((error as TtsError).code).toBe("invalid_request");
    }
  });

  it("9. oversized narration rejected", () => {
    expect(() => normalizeNarrationForTts("가".repeat(TTS_MAX_INPUT_CHARS + 1))).toThrow(/exceeds/);
  });
});

describe("VoiceStudio request mapping and auth", () => {
  it("10. provider request mapping is deterministic", () => {
    const profile = standardProfile();
    const request = buildTtsGenerationRequest({
      requestId: "req_1",
      profile,
      text: "  다낭  ",
    });
    expect(ttsGenerationRequestSchema.parse(request).text).toBe("다낭");
    expect(mapVoiceStudioSpeechBody({ profile, request })).toEqual({
      model: "tts-1",
      input: "다낭",
      voice: "default",
      response_format: "wav",
      language: "ko",
    });
  });

  it("11-12. API auth is sent server-side only and never appears in result or error", async () => {
    const wav = pcmWav();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("http://voicestudio.test/v1/audio/speech");
      const headers = new Headers(init?.headers);
      expect(headers.get("Authorization")).toBe(`Bearer ${SECRET}`);
      expect(JSON.parse(String(init?.body)).response_format).toBe("wav");
      return wavResponse(wav);
    });
    const provider = createProvider(fetchMock as unknown as typeof fetch);
    const result = await provider.generate({
      requestId: "req_auth",
      profile: standardProfile(),
      text: "다낭",
    });
    expect(secretLeak(result)).toBe(false);
    expect(JSON.stringify(provider)).not.toContain(SECRET);
    expect(result.sha256).toBe(createHash("sha256").update(wav).digest("hex"));

    const failing = vi.fn(async () => jsonResponse({ detail: `API key required ${SECRET}` }, 401));
    try {
      await createProvider(failing as unknown as typeof fetch).generate({
        requestId: "req_auth_fail",
        profile: standardProfile(),
        text: "다낭",
      });
      throw new Error("expected authentication_failed");
    } catch (error) {
      expect((error as TtsError).code).toBe("authentication_failed");
      expect((error as TtsError).message).not.toContain(SECRET);
      expect(secretLeak(error)).toBe(false);
    }
  });
});

describe("audio integrity", () => {
  it("13. successful WAV is accepted even if Content-Type is wrong", async () => {
    const wav = pcmWav(480, 24_000, 1);
    const provider = createProvider(async () => wavResponse(wav) as unknown as Response);
    const result = await provider.generate({
      requestId: "req_wav",
      profile: standardProfile(),
      text: "다낭",
    });
    expect(result.format).toBe("wav");
    expect(result.mediaType).toBe("audio/wav");
    expect(result.sampleRate).toBe(24_000);
    expect(result.channels).toBe(1);
  });

  it("14. empty response is rejected", async () => {
    const provider = createProvider(async () => wavResponse(Buffer.alloc(0)));
    await expect(
      provider.generate({ requestId: "req_empty", profile: standardProfile(), text: "다낭" }),
    ).rejects.toMatchObject({ code: "malformed_provider_response" });
  });

  it("15. JSON/error response is rejected as audio", async () => {
    const provider = createProvider(async () =>
      wavResponse(Buffer.from(JSON.stringify({ detail: "engine exploded" }))),
    );
    await expect(
      provider.generate({ requestId: "req_json", profile: standardProfile(), text: "다낭" }),
    ).rejects.toMatchObject({ code: "malformed_provider_response" });
  });

  it("16. invalid WAV signature is rejected", () => {
    const fake = Buffer.alloc(44, 0);
    fake.write("RIFF", 0);
    fake.write("XXXX", 8);
    expect(() => assertTtsAudioIntegrity(fake)).toThrow(TtsError);
  });

  it("17-18. SHA-256 and byteSize are correct", () => {
    const wav = pcmWav();
    const hashed = hashTtsAudio(wav);
    expect(hashed.byteSize).toBe(wav.byteLength);
    expect(hashed.sha256).toBe(createHash("sha256").update(wav).digest("hex"));
  });
});

describe("VoiceStudio error taxonomy", () => {
  it("19. provider timeout classified", async () => {
    const provider = createProvider(hangingFetch as unknown as typeof fetch, { timeoutMs: 20 });
    await expect(
      provider.generate({ requestId: "req_timeout", profile: standardProfile(), text: "다낭" }),
    ).rejects.toMatchObject({ code: "provider_timeout" });
  });

  it("20. authentication error classified", async () => {
    const provider = createProvider(async () => jsonResponse({ detail: "API key required" }, 401));
    await expect(
      provider.generate({ requestId: "req_401", profile: standardProfile(), text: "다낭" }),
    ).rejects.toMatchObject({ code: "authentication_failed" });
  });

  it("21. unsupported voice classified", async () => {
    const provider = createProvider(async () =>
      jsonResponse({ detail: "Unknown model 'missing-voice'" }, 400),
    );
    await expect(
      provider.generate({ requestId: "req_voice", profile: standardProfile(), text: "다낭" }),
    ).rejects.toMatchObject({ code: "unsupported_voice" });
  });

  it("unsupported language classified", async () => {
    const provider = createProvider(async () => jsonResponse({ detail: "unsupported language" }, 400));
    await expect(
      provider.generate({ requestId: "req_lang", profile: standardProfile(), text: "다낭" }),
    ).rejects.toMatchObject({ code: "unsupported_language" });
  });

  it("retries a transient 503 once then succeeds", async () => {
    const wav = pcmWav();
    const fetchMock = vi.fn(async () => {
      if (fetchMock.mock.calls.length === 1) {
        return jsonResponse({ detail: "engine loading" }, 503);
      }
      return wavResponse(wav);
    });
    const result = await createProvider(fetchMock as unknown as typeof fetch).generate({
      requestId: "req_retry",
      profile: standardProfile(),
      text: "다낭",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.format).toBe("wav");
  });

  it("22. malformed provider response classified", async () => {
    const provider = createProvider(async () => wavResponse(Buffer.from("<html>nope</html>")));
    await expect(
      provider.generate({ requestId: "req_html", profile: standardProfile(), text: "다낭" }),
    ).rejects.toMatchObject({ code: "malformed_provider_response" });
  });

  it("23. no blind auth retry", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ detail: "API key required" }, 401));
    const provider = createProvider(fetchMock as unknown as typeof fetch);
    await expect(
      provider.generate({ requestId: "req_once", profile: standardProfile(), text: "다낭" }),
    ).rejects.toMatchObject({ code: "authentication_failed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("24. segment-level requests are independently supported", async () => {
    const first = pcmWav(240, 24_000, 1, 1);
    const second = pcmWav(240, 24_000, 1, 2);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { input: string };
      return wavResponse(body.input === "첫 문장" ? first : second);
    });
    const provider = createProvider(fetchMock as unknown as typeof fetch);
    const profile = standardProfile();
    const a = await provider.generate({
      requestId: "seg_1",
      profile,
      text: "첫 문장",
      segmentId: "segment-01",
    });
    const b = await provider.generate({
      requestId: "seg_2",
      profile,
      text: "둘째 문장",
      segmentId: "segment-02",
    });
    expect(a.segmentId).toBe("segment-01");
    expect(b.segmentId).toBe("segment-02");
    expect(a.sha256).not.toBe(b.sha256);
    expect(ttsSegmentAudioRelativePath("segment-01")).toBe("reel/audio/segments/segment-01.wav");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("25. provider duration is not the authoritative timeline", async () => {
    const wav = pcmWav();
    const result = await createProvider(async () => wavResponse(wav)).generate({
      requestId: "req_clock",
      profile: standardProfile(),
      text: "다낭",
    });
    expect(result.timelineAuthoritative).toBe(false);
    expect(result.providerReportedDurationMs).toBeNull();
    const { audio: _audio, ...rest } = result;
    expect(ttsGenerationResultSchema.parse(rest).timelineAuthoritative).toBe(false);
  });
});

describe("Asset Store TTS persistence", () => {
  it("26-29. relative path, idempotent write, conflict, and secret-free metadata", () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(packageRoot, { recursive: true });
    const wav = pcmWav();
    const result = {
      contract: "tts-generation-result-v1" as const,
      requestId: "req_persist",
      provider: "voicestudio" as const,
      profileId: "standard-ko-development",
      mediaType: "audio/wav" as const,
      format: "wav" as const,
      sampleRate: 24_000,
      channels: 1,
      byteSize: wav.byteLength,
      sha256: hashTtsAudio(wav).sha256,
      providerGenerationId: null,
      providerReportedDurationMs: null,
      containerDurationMs: 10,
      timelineAuthoritative: false as const,
      generatedAt: "2026-09-03T00:00:00.000Z",
      segmentId: null,
      metadata: { modelRef: "tts-1", voiceRef: "default", httpStatus: 200 },
      audio: wav,
    };

    const first = persistTtsGeneration({ packageRoot, result, createdAt: result.generatedAt });
    const second = persistTtsGeneration({ packageRoot, result, createdAt: result.generatedAt });
    expect(first.audio.artifact.relativePath).toBe(TTS_NARRATION_WAV_RELATIVE_PATH);
    expect(first.audio.artifact.relativePath.startsWith("/")).toBe(false);
    expect(first.audio.status).toBe("created");
    expect(second.audio.status).toBe("reused");
    expect(readFileSync(join(packageRoot, TTS_NARRATION_WAV_RELATIVE_PATH)).equals(wav)).toBe(true);

    const changed = { ...result, audio: pcmWav(240, 24_000, 1, 9), sha256: hashTtsAudio(pcmWav(240, 24_000, 1, 9)).sha256 };
    expect(() => persistTtsGeneration({ packageRoot, result: changed, createdAt: result.generatedAt })).toThrow(
      MarketingAssetConflictError,
    );

    const metadata = JSON.parse(readFileSync(join(packageRoot, "reel/audio/generation.json"), "utf8"));
    expect(jsonContainsForbiddenBotLeak(metadata)).toBe(false);
    expect(secretLeak(metadata)).toBe(false);
    expect(secretLeak(buildTtsGenerationArtifact(result))).toBe(false);
    expect(metadata.profileId).toBe("standard-ko-development");
    expect(metadata.timelineAuthoritative).toBe(false);
  });

  it("same audio with a later generatedAt reuses first metadata and does not conflict", () => {
    const packageRoot = join(tempRoot(), "pkg");
    mkdirSync(packageRoot, { recursive: true });
    const wav = pcmWav();
    const hashed = hashTtsAudio(wav);
    const firstResult = {
      contract: "tts-generation-result-v1" as const,
      requestId: "req_persist_a",
      provider: "voicestudio" as const,
      profileId: "standard-ko-development",
      mediaType: "audio/wav" as const,
      format: "wav" as const,
      sampleRate: 24_000,
      channels: 1,
      byteSize: hashed.byteSize,
      sha256: hashed.sha256,
      providerGenerationId: null,
      providerReportedDurationMs: null,
      containerDurationMs: 10,
      timelineAuthoritative: false as const,
      generatedAt: "2026-09-03T00:00:00.000Z",
      segmentId: null,
      metadata: { modelRef: "tts-1", voiceRef: "default", httpStatus: 200 },
      audio: wav,
    };

    const first = persistTtsGeneration({
      packageRoot,
      result: firstResult,
      createdAt: firstResult.generatedAt,
    });
    const second = persistTtsGeneration({
      packageRoot,
      result: {
        ...firstResult,
        requestId: "req_persist_b",
        generatedAt: "2026-09-03T00:05:00.000Z",
      },
      createdAt: "2026-09-03T00:05:00.000Z",
    });

    expect(first.audio.status).toBe("created");
    expect(second.audio.status).toBe("reused");
    expect(second.metadata.status).toBe("reused");
    expect(readFileSync(join(packageRoot, TTS_NARRATION_WAV_RELATIVE_PATH)).equals(wav)).toBe(true);
    expect(readdirSync(join(packageRoot, "reel/audio")).sort()).toEqual(["generation.json", "narration.wav"]);

    const metadata = JSON.parse(readFileSync(join(packageRoot, TTS_GENERATION_JSON_RELATIVE_PATH), "utf8"));
    expect(metadata.generatedAt).toBe("2026-09-03T00:00:00.000Z");
    expect(metadata.requestId).toBe("req_persist_a");
    expect(metadata.sha256).toBe(hashed.sha256);
    expect(metadata.profileId).toBe("standard-ko-development");

    const changedWav = pcmWav(240, 24_000, 1, 9);
    expect(() =>
      persistTtsGeneration({
        packageRoot,
        result: {
          ...firstResult,
          audio: changedWav,
          sha256: hashTtsAudio(changedWav).sha256,
          generatedAt: "2026-09-03T00:06:00.000Z",
        },
      }),
    ).toThrow(MarketingAssetConflictError);
    expect(readFileSync(join(packageRoot, TTS_NARRATION_WAV_RELATIVE_PATH)).equals(wav)).toBe(true);
  });

  it("same WAV with different generation provenance conflicts and does not reuse first metadata", () => {
    const wav = pcmWav();
    const hashed = hashTtsAudio(wav);
    const firstResult = {
      contract: "tts-generation-result-v1" as const,
      requestId: "req_persist_a",
      provider: "voicestudio" as const,
      profileId: "standard-ko-development",
      mediaType: "audio/wav" as const,
      format: "wav" as const,
      sampleRate: 24_000,
      channels: 1,
      byteSize: hashed.byteSize,
      sha256: hashed.sha256,
      providerGenerationId: null,
      providerReportedDurationMs: null,
      containerDurationMs: 10,
      timelineAuthoritative: false as const,
      generatedAt: "2026-09-03T00:00:00.000Z",
      segmentId: null,
      metadata: { modelRef: "tts-1", voiceRef: "default", httpStatus: 200 },
      audio: wav,
    };
    const provenanceOverrides = [
      { profileId: "owner-clone-development" },
      { metadata: { modelRef: "omnivoice", voiceRef: "default", httpStatus: 200 } },
      { metadata: { modelRef: "tts-1", voiceRef: "alloy", httpStatus: 200 } },
      { segmentId: "segment-01" },
    ] as const;

    for (const override of provenanceOverrides) {
      const packageRoot = join(tempRoot(), `pkg-${JSON.stringify(override)}`);
      mkdirSync(packageRoot, { recursive: true });
      persistTtsGeneration({ packageRoot, result: firstResult, createdAt: firstResult.generatedAt });
      const originalWav = readFileSync(join(packageRoot, TTS_NARRATION_WAV_RELATIVE_PATH));
      const originalMeta = readFileSync(join(packageRoot, TTS_GENERATION_JSON_RELATIVE_PATH));

      try {
        persistTtsGeneration({
          packageRoot,
          result: {
            ...firstResult,
            ...override,
            requestId: "req_persist_b",
            generatedAt: "2026-09-03T00:05:00.000Z",
          },
          createdAt: "2026-09-03T00:05:00.000Z",
        });
        throw new Error(`expected provenance conflict for ${JSON.stringify(override)}`);
      } catch (error) {
        expect(error).toBeInstanceOf(MarketingAssetConflictError);
        expect((error as MarketingAssetConflictError).relativePath).toBe(TTS_GENERATION_JSON_RELATIVE_PATH);
      }

      expect(readFileSync(join(packageRoot, TTS_NARRATION_WAV_RELATIVE_PATH)).equals(originalWav)).toBe(true);
      expect(readFileSync(join(packageRoot, TTS_GENERATION_JSON_RELATIVE_PATH)).equals(originalMeta)).toBe(true);
      const metadata = JSON.parse(originalMeta.toString("utf8"));
      expect(metadata.profileId).toBe("standard-ko-development");
      expect(metadata.generatedAt).toBe("2026-09-03T00:00:00.000Z");
    }
  });
});

describe("development CLI", () => {
  it("dry-run resolves and prints a bounded plan without network or files", async () => {
    const options = parseTestMarketingTtsArgs([
      "--profile",
      "standard-ko-development",
      "--text",
      "  다낭 효도여행  ",
      "--dry-run",
    ]);
    const fetchMock = vi.fn();
    const result = await runTestMarketingTtsCommand({ options, fetch: fetchMock as unknown as typeof fetch });
    expect(result.dryRun).toBe(true);
    expect(result.network).toBe(false);
    expect(result.filesystem).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.request).toMatchObject({ text: "다낭 효도여행", outputFormat: "wav" });
    expect(secretLeak(result)).toBe(false);
  });
});
