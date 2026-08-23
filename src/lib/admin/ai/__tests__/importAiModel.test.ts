import { afterEach, describe, expect, it, vi } from "vitest";

const createGoogleMock = vi.fn((apiKey: string) => (modelId: string) => `google:${apiKey}:${modelId}`);
const openaiMock = vi.fn((modelId: string) => `openai:${modelId}`);

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: ({ apiKey }: { apiKey: string }) => createGoogleMock(apiKey),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: (modelId: string) => openaiMock(modelId),
}));

import {
  DEFAULT_GOOGLE_IMPORT_MODEL,
  DEFAULT_OPENAI_IMPORT_MODEL,
  FALLBACK_GOOGLE_IMPORT_MODEL,
  hasImportAiKey,
  resolveGooglePrimaryAndFallbackModelIds,
  resolveImportAiProvider,
  resolveImportLanguageModel,
  resolveImportModelId,
  withGoogleModelFallback,
} from "@/lib/admin/ai/importAiModel";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  createGoogleMock.mockClear();
  openaiMock.mockClear();
});

describe("importAiModel", () => {
  it("prefers Google when a Gemini key is set", () => {
    delete process.env.IMPORT_AI_PROVIDER;
    delete process.env.BAND_IMPORT_MODEL;
    delete process.env.IMPORT_AI_MODEL;
    delete process.env.OPENAI_API_KEY;
    process.env.GEMINI_API_KEY = "gem-key";

    expect(hasImportAiKey()).toBe(true);
    expect(resolveImportAiProvider()).toBe("google");
    expect(resolveImportModelId()).toEqual({
      provider: "google",
      modelId: DEFAULT_GOOGLE_IMPORT_MODEL,
    });
    expect(DEFAULT_GOOGLE_IMPORT_MODEL).toBe("gemini-3.5-flash-lite");
    expect(FALLBACK_GOOGLE_IMPORT_MODEL).toBe("gemini-3.1-flash-lite");
    expect(resolveImportLanguageModel()).toBe(`google:gem-key:${DEFAULT_GOOGLE_IMPORT_MODEL}`);
  });

  it("falls back to OpenAI when only OPENAI_API_KEY is set", () => {
    delete process.env.IMPORT_AI_PROVIDER;
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.BAND_IMPORT_MODEL;
    process.env.OPENAI_API_KEY = "sk-test";

    expect(resolveImportAiProvider()).toBe("openai");
    expect(resolveImportModelId()).toEqual({
      provider: "openai",
      modelId: DEFAULT_OPENAI_IMPORT_MODEL,
    });
    expect(resolveImportLanguageModel()).toBe(`openai:${DEFAULT_OPENAI_IMPORT_MODEL}`);
  });

  it("ignores gpt model override when provider is Google", () => {
    delete process.env.IMPORT_AI_PROVIDER;
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-key";
    process.env.BAND_IMPORT_MODEL = "gpt-4o-mini";

    expect(resolveImportModelId().modelId).toBe(DEFAULT_GOOGLE_IMPORT_MODEL);
  });

  it("honors gemini model override for primary only", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-key";
    process.env.BAND_IMPORT_MODEL = "gemini-3.6-pro";
    delete process.env.IMPORT_AI_FALLBACK_MODEL;

    expect(resolveImportModelId()).toEqual({
      provider: "google",
      modelId: "gemini-3.6-pro",
    });
    expect(resolveGooglePrimaryAndFallbackModelIds()).toEqual({
      primary: "gemini-3.6-pro",
      fallback: FALLBACK_GOOGLE_IMPORT_MODEL,
    });
  });

  it("skips fallback when primary equals fallback", () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-key";
    delete process.env.BAND_IMPORT_MODEL;
    process.env.IMPORT_AI_MODEL = FALLBACK_GOOGLE_IMPORT_MODEL;
    delete process.env.IMPORT_AI_FALLBACK_MODEL;

    expect(resolveGooglePrimaryAndFallbackModelIds()).toEqual({
      primary: FALLBACK_GOOGLE_IMPORT_MODEL,
      fallback: null,
    });
  });
});

describe("withGoogleModelFallback", () => {
  it("retries with fallback model on RPD/quota error", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-key";
    delete process.env.BAND_IMPORT_MODEL;
    delete process.env.IMPORT_AI_MODEL;
    delete process.env.IMPORT_AI_FALLBACK_MODEL;
    delete process.env.IMPORT_AI_PROVIDER;

    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("You exceeded your current quota, free_tier limit"))
      .mockResolvedValueOnce("ok-fallback");

    const result = await withGoogleModelFallback("test", run);
    expect(result).toBe("ok-fallback");
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0][0]).toBe(`google:g-key:${DEFAULT_GOOGLE_IMPORT_MODEL}`);
    expect(run.mock.calls[1][0]).toBe(`google:g-key:${FALLBACK_GOOGLE_IMPORT_MODEL}`);
  });

  it("retries same model once on transient network error", async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-key";
    delete process.env.BAND_IMPORT_MODEL;
    delete process.env.IMPORT_AI_MODEL;

    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce("ok-retry");

    const result = await withGoogleModelFallback("test-net", run);
    expect(result).toBe("ok-retry");
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0][0]).toBe(`google:g-key:${DEFAULT_GOOGLE_IMPORT_MODEL}`);
    expect(run.mock.calls[1][0]).toBe(`google:g-key:${DEFAULT_GOOGLE_IMPORT_MODEL}`);
  });
});
