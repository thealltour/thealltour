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
  const env = options.env ?? process.env;

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
