import { SemanticNotConfiguredError, SemanticUnsupportedError } from "@/lib/marketing/semantic/errors";
import type { EmbeddingProvider, EmbeddingVector } from "@/lib/marketing/semantic/types";

export const EMBEDDING_PROVIDER_ENV = "EMBEDDING_PROVIDER";
export const EMBEDDING_HTTP_URL_ENV = "EMBEDDING_HTTP_URL";
export const EMBEDDING_MODEL_ENV = "EMBEDDING_MODEL";

export type EmbeddingProviderKind = "none" | "mini_pc" | "http" | "unsupported";

export function readEmbeddingProviderKind(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): EmbeddingProviderKind {
  const raw = env[EMBEDDING_PROVIDER_ENV]?.trim().toLowerCase();
  if (!raw || raw === "none") return "none";
  if (raw === "mini_pc") return "mini_pc";
  if (raw === "http") return "http";
  return "unsupported";
}

export class NoneEmbeddingProvider implements EmbeddingProvider {
  readonly model = "none";

  async embed(text: string): Promise<EmbeddingVector> {
    void text;
    throw new SemanticNotConfiguredError("EMBEDDING_PROVIDER is none");
  }

  async embedMany(texts: string[]): Promise<EmbeddingVector[]> {
    void texts;
    throw new SemanticNotConfiguredError("EMBEDDING_PROVIDER is none");
  }
}

export class HttpEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly endpoint: string | null;

  constructor(input: { model?: string; endpoint?: string | null } = {}) {
    this.model = input.model?.trim() || "unspecified";
    this.endpoint = input.endpoint?.trim() || null;
  }

  async embed(text: string): Promise<EmbeddingVector> {
    void text;
    throw new SemanticUnsupportedError(
      "HTTP embedding is reserved for a later step and does not call a remote server yet.",
    );
  }

  async embedMany(texts: string[]): Promise<EmbeddingVector[]> {
    void texts;
    throw new SemanticUnsupportedError(
      "HTTP embedding is reserved for a later step and does not call a remote server yet.",
    );
  }
}

export function createEmbeddingProvider(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): EmbeddingProvider | null {
  const kind = readEmbeddingProviderKind(env);
  if (kind === "none") return null;
  if (kind === "mini_pc" || kind === "http") {
    return new HttpEmbeddingProvider({
      model: env[EMBEDDING_MODEL_ENV],
      endpoint: env[EMBEDDING_HTTP_URL_ENV],
    });
  }
  return null;
}
