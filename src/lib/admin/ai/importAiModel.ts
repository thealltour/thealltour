import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";

export const DEFAULT_GOOGLE_IMPORT_MODEL = "gemini-3.6-flash";
export const DEFAULT_OPENAI_IMPORT_MODEL = "gpt-4o-mini";

export type ImportAiProvider = "google" | "openai";

export function getGoogleGenerativeAiKey(): string | null {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    null
  );
}

export function getOpenAiApiKey(): string | null {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export function hasImportAiKey(): boolean {
  return Boolean(getGoogleGenerativeAiKey() || getOpenAiApiKey());
}

export const MISSING_IMPORT_AI_KEY_MESSAGE =
  "상품 파서용 AI 키가 없습니다. GOOGLE_GENERATIVE_AI_API_KEY(또는 GEMINI_API_KEY)를 설정해 주세요. OpenAI만 쓸 경우 OPENAI_API_KEY도 가능합니다.";

export function requireImportAiKey(): void {
  if (!hasImportAiKey()) {
    throw new Error(MISSING_IMPORT_AI_KEY_MESSAGE);
  }
}

function forcedProvider(): ImportAiProvider | null {
  const raw = process.env.IMPORT_AI_PROVIDER?.trim().toLowerCase();
  if (raw === "google" || raw === "openai") return raw;
  return null;
}

export function resolveImportAiProvider(): ImportAiProvider {
  const forced = forcedProvider();
  if (forced === "google") {
    if (!getGoogleGenerativeAiKey()) {
      throw new Error(
        "IMPORT_AI_PROVIDER=google 이지만 GOOGLE_GENERATIVE_AI_API_KEY(또는 GEMINI_API_KEY)가 없습니다.",
      );
    }
    return "google";
  }
  if (forced === "openai") {
    if (!getOpenAiApiKey()) {
      throw new Error("IMPORT_AI_PROVIDER=openai 이지만 OPENAI_API_KEY가 없습니다.");
    }
    return "openai";
  }
  if (getGoogleGenerativeAiKey()) return "google";
  if (getOpenAiApiKey()) return "openai";
  throw new Error(MISSING_IMPORT_AI_KEY_MESSAGE);
}

function envModelOverride(): string | null {
  return process.env.BAND_IMPORT_MODEL?.trim() || process.env.IMPORT_AI_MODEL?.trim() || null;
}

function isOpenAiModelId(modelId: string): boolean {
  return modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4");
}

function isGoogleModelId(modelId: string): boolean {
  return modelId.startsWith("gemini-") || modelId.startsWith("gemma-");
}

export function resolveImportModelId(): { provider: ImportAiProvider; modelId: string } {
  const provider = resolveImportAiProvider();
  const override = envModelOverride();
  if (provider === "google") {
    const modelId = override && isGoogleModelId(override) ? override : DEFAULT_GOOGLE_IMPORT_MODEL;
    return { provider, modelId };
  }
  const modelId = override && isOpenAiModelId(override) ? override : DEFAULT_OPENAI_IMPORT_MODEL;
  return { provider, modelId };
}

export function resolveImportLanguageModel() {
  requireImportAiKey();
  const { provider, modelId } = resolveImportModelId();
  if (provider === "google") {
    const apiKey = getGoogleGenerativeAiKey();
    if (!apiKey) throw new Error(MISSING_IMPORT_AI_KEY_MESSAGE);
    return createGoogleGenerativeAI({ apiKey })(modelId);
  }
  return openai(modelId);
}
