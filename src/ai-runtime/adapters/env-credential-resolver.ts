import { RuntimeError } from "@/ai-runtime/domain/error";
import type { CredentialResolver } from "@/ai-runtime/adapters/types";
import {
  CREDENTIAL_REF_ENV_CANDIDATES,
  type CredentialEnvSource,
} from "@/ai-runtime/adapters/credential-resolver";

export type CreateEnvCredentialResolverOptions = {
  env?: CredentialEnvSource;
};

/**
 * Resolves Registry credentialRef values from process env.
 * Missing secrets → AUTH_ERROR without embedding any secret material.
 */
export function createEnvCredentialResolver(
  options: CreateEnvCredentialResolverOptions = {},
): CredentialResolver {
  // Prefer an explicit env bag (tests). Otherwise read process.env at resolve
  // time so ensureRuntimeEnv() fills are visible — never capture a stale snapshot.
  const explicitEnv = options.env;

  return {
    async resolve(credentialRef: string): Promise<string> {
      const env = explicitEnv ?? process.env;
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
        const value = env[name]?.trim();
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
