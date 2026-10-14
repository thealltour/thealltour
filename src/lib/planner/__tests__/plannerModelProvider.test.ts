import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createOpenAI = vi.hoisted(() =>
  vi.fn((settings: { apiKey?: string }) => (modelId: string) => ({
    provider: "openai.responses",
    modelId,
    keyTag: settings.apiKey === "planner-test-key" ? "planner" : "other",
  })),
);
const openai = vi.hoisted(() => vi.fn((modelId: string) => `openai-default:${modelId}`));
const createGoogleGenerativeAI = vi.hoisted(() =>
  vi.fn((settings: { apiKey?: string }) => (modelId: string) => `google:${settings.apiKey}:${modelId}`),
);

vi.mock("@ai-sdk/openai", () => ({ createOpenAI, openai }));
vi.mock("@ai-sdk/google", () => ({ createGoogleGenerativeAI }));

import {
  DEFAULT_PLANNER_AI_PROVIDER,
  PlannerModelConfigError,
  resolvePlannerAiProvider,
  resolvePlannerLanguageModel,
  resolvePlannerModelIdForAttempt,
  resolvePlannerOpenAiReasoningEffort,
} from "@/lib/planner/modelProvider";
import {
  DEFAULT_PLANNER_GOOGLE_PRIMARY_MODEL,
  DEFAULT_PLANNER_GOOGLE_SEMANTIC_FALLBACK_MODEL,
} from "@/lib/planner/modelConfig";
import {
  DEFAULT_GOOGLE_IMPORT_MODEL,
  DEFAULT_OPENAI_IMPORT_MODEL,
  resolveImportAiProvider,
  resolveImportModelId,
} from "@/lib/admin/ai/importAiModel";

const AI_ENV_KEYS = [
  "PLANNER_AI_PROVIDER",
  "PLANNER_OPENAI_API_KEY",
  "PLANNER_PRIMARY_MODEL",
  "PLANNER_SEMANTIC_FALLBACK_MODEL",
  "PLANNER_OPENAI_REASONING_EFFORT",
  "OPENAI_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "IMPORT_AI_PROVIDER",
  "IMPORT_AI_MODEL",
  "BAND_IMPORT_MODEL",
  "IMPORT_AI_FALLBACK_MODEL",
] as const;

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of AI_ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("Planner provider isolation", () => {
  it("selects OpenAI for Planner even when Google and global OpenAI keys exist", () => {
    process.env.PLANNER_AI_PROVIDER = "openai";
    process.env.PLANNER_OPENAI_API_KEY = "planner-test-key";
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "google-test-key";
    process.env.OPENAI_API_KEY = "global-test-key";

    expect(resolvePlannerAiProvider()).toBe("openai");
    const target = resolvePlannerLanguageModel(1);
    expect(target.provider).toBe("openai");
    expect(target.model).toMatchObject({ modelId: "gpt-6.1-sol", keyTag: "planner" });
    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: "planner-test-key" });
    expect(openai).not.toHaveBeenCalled();
    expect(createGoogleGenerativeAI).not.toHaveBeenCalled();
  });

  it("defaults to OpenAI when PLANNER_AI_PROVIDER is unset (never key-presence Google)", () => {
    process.env.GEMINI_API_KEY = "gem-test-key";
    expect(DEFAULT_PLANNER_AI_PROVIDER).toBe("openai");
    expect(resolvePlannerAiProvider()).toBe("openai");
  });

  it("throws a Planner missing_key config error when only the global OpenAI key exists", () => {
    process.env.PLANNER_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "global-test-key";

    expect(() => resolvePlannerLanguageModel(1)).toThrow(PlannerModelConfigError);
    try {
      resolvePlannerLanguageModel(1);
    } catch (error) {
      expect((error as PlannerModelConfigError).code).toBe("missing_key");
      expect((error as Error).message).not.toContain("global-test-key");
    }
    expect(createOpenAI).not.toHaveBeenCalled();
    expect(openai).not.toHaveBeenCalled();
  });

  it("rejects unknown provider values as invalid_config", () => {
    process.env.PLANNER_AI_PROVIDER = "gemini";
    expect(() => resolvePlannerAiProvider()).toThrow(
      expect.objectContaining({ code: "invalid_config" }),
    );
  });

  it("creates the configured model per semantic attempt", () => {
    process.env.PLANNER_OPENAI_API_KEY = "planner-test-key";
    process.env.PLANNER_PRIMARY_MODEL = "gpt-custom-primary";
    process.env.PLANNER_SEMANTIC_FALLBACK_MODEL = "gpt-custom-fallback";

    expect(resolvePlannerLanguageModel(1).modelId).toBe("gpt-custom-primary");
    expect(resolvePlannerLanguageModel(2).modelId).toBe("gpt-custom-fallback");
  });

  it("parses reasoning effort from env with medium fallback", () => {
    expect(resolvePlannerOpenAiReasoningEffort()).toBe("medium");
    process.env.PLANNER_OPENAI_REASONING_EFFORT = "low";
    expect(resolvePlannerOpenAiReasoningEffort()).toBe("low");
    process.env.PLANNER_OPENAI_REASONING_EFFORT = "maximum";
    expect(resolvePlannerOpenAiReasoningEffort()).toBe("medium");
  });

  it("maps non-Gemini model IDs to Gemini defaults on the Google rollback path", () => {
    expect(resolvePlannerModelIdForAttempt("google", 1)).toBe(DEFAULT_PLANNER_GOOGLE_PRIMARY_MODEL);
    expect(resolvePlannerModelIdForAttempt("google", 2)).toBe(
      DEFAULT_PLANNER_GOOGLE_SEMANTIC_FALLBACK_MODEL,
    );
    process.env.PLANNER_PRIMARY_MODEL = "gemini-custom";
    expect(resolvePlannerModelIdForAttempt("google", 1)).toBe("gemini-custom");
    expect(resolvePlannerModelIdForAttempt("openai", 1)).toBe("gemini-custom");
  });

  it("Google rollback requires a Google key and sends no OpenAI options", () => {
    process.env.PLANNER_AI_PROVIDER = "google";
    expect(() => resolvePlannerLanguageModel(1)).toThrow(
      expect.objectContaining({ code: "missing_key" }),
    );

    process.env.GEMINI_API_KEY = "gem-test-key";
    const target = resolvePlannerLanguageModel(1);
    expect(target.provider).toBe("google");
    expect(target.providerOptions).toBeUndefined();
    expect(target.reasoningEffort).toBeNull();
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: "gem-test-key" });
  });
});

describe("Import AI isolation from Planner env", () => {
  it("keeps Google-first import precedence when Planner is set to OpenAI", () => {
    process.env.PLANNER_AI_PROVIDER = "openai";
    process.env.PLANNER_OPENAI_API_KEY = "planner-test-key";
    process.env.PLANNER_PRIMARY_MODEL = "gpt-6.1-sol";
    process.env.GEMINI_API_KEY = "gem-test-key";
    process.env.OPENAI_API_KEY = "global-test-key";

    expect(resolveImportAiProvider()).toBe("google");
    expect(resolveImportModelId()).toEqual({
      provider: "google",
      modelId: DEFAULT_GOOGLE_IMPORT_MODEL,
    });
  });

  it("does not let the Planner key make import AI available", () => {
    process.env.PLANNER_AI_PROVIDER = "openai";
    process.env.PLANNER_OPENAI_API_KEY = "planner-test-key";

    expect(() => resolveImportAiProvider()).toThrow();
  });

  it("keeps IMPORT_AI_PROVIDER=openai import behavior unchanged", () => {
    process.env.PLANNER_AI_PROVIDER = "google";
    process.env.IMPORT_AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "global-test-key";
    process.env.GEMINI_API_KEY = "gem-test-key";

    expect(resolveImportAiProvider()).toBe("openai");
    expect(resolveImportModelId()).toEqual({
      provider: "openai",
      modelId: DEFAULT_OPENAI_IMPORT_MODEL,
    });
  });
});
