import "server-only";

import { SemanticNotConfiguredError, SemanticUnsupportedError } from "@/lib/marketing/semantic/errors";

export const EMBEDDING_PROVIDER_ENV = "EMBEDDING_PROVIDER";
export const EMBEDDING_BASE_URL_ENV = "EMBEDDING_BASE_URL";
/** @deprecated Use EMBEDDING_BASE_URL. Kept as a fallback for earlier placeholders. */
export const EMBEDDING_HTTP_URL_ENV = "EMBEDDING_HTTP_URL";
export const EMBEDDING_API_TOKEN_ENV = "EMBEDDING_API_TOKEN";
export const EMBEDDING_MODEL_ENV = "EMBEDDING_MODEL";
export const EMBEDDING_DIMENSION_ENV = "EMBEDDING_DIMENSION";
export const EMBEDDING_TIMEOUT_MS_ENV = "EMBEDDING_TIMEOUT_MS";

export const DEFAULT_EMBEDDING_MODEL = "BAAI/bge-m3";
export const DEFAULT_EMBEDDING_DIMENSION = 1024;
export const DEFAULT_EMBEDDING_TIMEOUT_MS = 30_000;

export type EmbeddingProviderKind = "none" | "mini_pc" | "http" | "unsupported";

export type EmbeddingHttpConfig = {
  kind: "mini_pc" | "http";
  baseUrl: string;
  model: string;
  dimension: number;
  timeoutMs: number;
  apiToken: string | null;
};

export type ParsedEmbeddingConfig =
  | { kind: "none" }
  | { kind: "unsupported" }
  | EmbeddingHttpConfig;

function readEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  key: string,
): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function readEmbeddingProviderKind(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): EmbeddingProviderKind {
  const raw = env[EMBEDDING_PROVIDER_ENV]?.trim().toLowerCase();
  if (!raw || raw === "none") return "none";
  if (raw === "mini_pc") return "mini_pc";
  if (raw === "http") return "http";
  return "unsupported";
}

function parsePositiveInt(raw: string | undefined, fallback: number, envName: string): number {
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
    throw new SemanticNotConfiguredError(`${envName} must be a positive integer`);
  }
  return value;
}

function parseBaseUrl(raw: string | undefined): string {
  if (!raw) {
    throw new SemanticNotConfiguredError("EMBEDDING_BASE_URL is required when EMBEDDING_PROVIDER is mini_pc");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SemanticNotConfiguredError("EMBEDDING_BASE_URL is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SemanticNotConfiguredError("EMBEDDING_BASE_URL must be http or https");
  }
  return raw.replace(/\/+$/, "");
}

export function parseEmbeddingConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): ParsedEmbeddingConfig {
  const kind = readEmbeddingProviderKind(env);
  if (kind === "none") return { kind: "none" };
  if (kind === "unsupported") return { kind: "unsupported" };

  const baseUrl = parseBaseUrl(readEnv(env, EMBEDDING_BASE_URL_ENV) ?? readEnv(env, EMBEDDING_HTTP_URL_ENV));
  return {
    kind,
    baseUrl,
    model: readEnv(env, EMBEDDING_MODEL_ENV) ?? DEFAULT_EMBEDDING_MODEL,
    dimension: parsePositiveInt(readEnv(env, EMBEDDING_DIMENSION_ENV), DEFAULT_EMBEDDING_DIMENSION, EMBEDDING_DIMENSION_ENV),
    timeoutMs: parsePositiveInt(
      readEnv(env, EMBEDDING_TIMEOUT_MS_ENV),
      DEFAULT_EMBEDDING_TIMEOUT_MS,
      EMBEDDING_TIMEOUT_MS_ENV,
    ),
    apiToken: readEnv(env, EMBEDDING_API_TOKEN_ENV) ?? null,
  };
}

export function parseEmbeddingHttpConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): EmbeddingHttpConfig {
  const parsed = parseEmbeddingConfig(env);
  if (parsed.kind === "none") {
    throw new SemanticNotConfiguredError("EMBEDDING_PROVIDER is none");
  }
  if (parsed.kind === "unsupported") {
    throw new SemanticUnsupportedError("EMBEDDING_PROVIDER is not supported");
  }
  return parsed;
}
