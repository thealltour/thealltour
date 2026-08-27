import { RuntimeError } from "@/ai-runtime/domain/error";
import type { CredentialResolver } from "@/ai-runtime/adapters/types";
import {
  CREDENTIAL_REF_ENV_CANDIDATES,
  type CredentialEnvSource,
} from "@/ai-runtime/adapters/credential-resolver";
import { getRuntimeEnvBag, readRuntimeEnvValue } from "@/lib/runtimeEnvStore";

export type CreateEnvCredentialResolverOptions = {
  env?: CredentialEnvSource;
};

/**
 * Resolves Registry credentialRef values from process env / runtime overlay.
 * Missing secrets → AUTH_ERROR without embedding any secret material.
 */
export function createEnvCredentialResolver(
  options: CreateEnvCredentialResolverOptions = {},
): CredentialResolver {
  const explicitEnv = options.env;

  return {
    async resolve(credentialRef: string): Promise<string> {
      const ref = credentialRef.trim();
      if (!ref) {
        throw new RuntimeError("AUTH_ERROR", "credentialRef is empty", false);
      }

      const candidates = CREDENTIAL_REF_ENV_CANDIDATES[ref];
      if (!candidates || candidates.length === 0) {
        throw new RuntimeError(
          "AUTH_ERROR",
          `Unknown credentialRef "${ref}" — no env mapping configured`,
          false,
        );
      }

      for (const name of candidates) {
        const value = explicitEnv
          ? explicitEnv[name]?.trim()
          : readRuntimeEnvValue(name)?.trim();
        if (value) return value;
      }

      throw new RuntimeError(
        "AUTH_ERROR",
        `Missing API credential for ${ref} (checked: ${candidates.join(", ")})`,
        false,
      );
    },
  };
}

/** Call-time presence helpers (no import-time snapshot). */
export function getOpenRouterCredentialPresence(
  env: CredentialEnvSource = getRuntimeEnvBag(),
): boolean {
  return Boolean(env.OPENROUTER_API_KEY?.trim());
}

export function getNvidiaCredentialPresence(
  env: CredentialEnvSource = getRuntimeEnvBag(),
): boolean {
  return Boolean(env.NVIDIA_API_KEY?.trim());
}

export function getGeminiCredentialPresence(
  env: CredentialEnvSource = getRuntimeEnvBag(),
): boolean {
  return Boolean(
    env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
      env.GEMINI_API_KEY?.trim() ||
      env.GOOGLE_API_KEY?.trim(),
  );
}
