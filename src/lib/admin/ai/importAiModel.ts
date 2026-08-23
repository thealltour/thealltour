import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import {
  isTransientAiError,
  shouldFallbackToAlternateGoogleModel,
} from "@/lib/admin/ai/importAiErrors";

/** 기본: RPD 여유 있는 Flash Lite. 실패 시 FALLBACK으로 전환 */
export const DEFAULT_GOOGLE_IMPORT_MODEL = "gemini-3.5-flash-lite";
export const FALLBACK_GOOGLE_IMPORT_MODEL = "gemini-3.1-flash-lite";
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

function envFallbackModelOverride(): string | null {
  return process.env.IMPORT_AI_FALLBACK_MODEL?.trim() || null;
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

/** Google primary + RPD 폴백 모델 ID (OpenAI면 fallback=null) */
export function resolveGooglePrimaryAndFallbackModelIds(primaryOverride?: string | null): {
  primary: string;
  fallback: string | null;
} {
  const override = primaryOverride?.trim() || envModelOverride();
  const primary =
    override && isGoogleModelId(override) ? override : DEFAULT_GOOGLE_IMPORT_MODEL;
  const fallbackOverride = envFallbackModelOverride();
  const fallbackCandidate =
    fallbackOverride && isGoogleModelId(fallbackOverride)
      ? fallbackOverride
      : FALLBACK_GOOGLE_IMPORT_MODEL;
  const fallback = fallbackCandidate !== primary ? fallbackCandidate : null;
  return { primary, fallback };
}

export function resolveImportLanguageModelForId(modelId: string) {
  requireImportAiKey();
  const provider = resolveImportAiProvider();
  if (provider === "google") {
    const apiKey = getGoogleGenerativeAiKey();
    if (!apiKey) throw new Error(MISSING_IMPORT_AI_KEY_MESSAGE);
    return createGoogleGenerativeAI({ apiKey })(modelId);
  }
  return openai(modelId);
}

export function resolveImportLanguageModel() {
  const { modelId } = resolveImportModelId();
  return resolveImportLanguageModelForId(modelId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Google: primary 호출 → (일시 오류 시 같은 모델 1회) → (RPD/쿼터/혼잡 시 fallback 모델 1회)
 * OpenAI: 일시 오류 시 같은 모델 1회만
 */
export async function withGoogleModelFallback<T>(
  label: string,
  run: (model: ReturnType<typeof resolveImportLanguageModelForId>) => Promise<T>,
  options?: { primaryModelId?: string | null },
): Promise<T> {
  requireImportAiKey();
  const provider = resolveImportAiProvider();

  if (provider === "openai") {
    const model = resolveImportLanguageModelForId(resolveImportModelId().modelId);
    try {
      return await run(model);
    } catch (error) {
      if (!isTransientAiError(error)) throw error;
      console.warn(`[ai] ${label} failed (openai), retrying once after 1s:`, error);
      await sleep(1000);
      return await run(model);
    }
  }

  const { primary, fallback } = resolveGooglePrimaryAndFallbackModelIds(options?.primaryModelId);
  const primaryModel = resolveImportLanguageModelForId(primary);

  try {
    return await run(primaryModel);
  } catch (error) {
    if (isTransientAiError(error)) {
      console.warn(`[ai] ${label} failed on ${primary}, retrying same model after 1s:`, error);
      await sleep(1000);
      try {
        return await run(primaryModel);
      } catch (retryError) {
        if (!shouldFallbackToAlternateGoogleModel(retryError) || !fallback) throw retryError;
        console.warn(
          `[ai] ${label}: ${primary} still failing with capacity/quota, trying ${fallback}`,
        );
        return await run(resolveImportLanguageModelForId(fallback));
      }
    }

    if (!shouldFallbackToAlternateGoogleModel(error) || !fallback) throw error;
    console.warn(`[ai] ${label}: ${primary} hit quota/RPD/demand, trying ${fallback}`);
    return await run(resolveImportLanguageModelForId(fallback));
  }
}
