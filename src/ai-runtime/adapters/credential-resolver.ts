/**
 * credentialRef → environment variable mapping (single source of truth).
 * Values are never stored here — only env names.
 */

export const CREDENTIAL_REF_ENV_CANDIDATES: Record<string, readonly string[]> = {
  "ai-provider/gemini/main": [
    // Match existing thealltour / Hermes conventions (checked in order).
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
  ],
  "ai-provider/openrouter/main": ["OPENROUTER_API_KEY"],
  "ai-provider/nvidia/main": ["NVIDIA_API_KEY"],
  // Reserved for future re-enable; not used while Groq is disabled.
  "ai-provider/groq/main": ["HERMES_CUSTOM_GROQ_CUSTOM_API_KEY", "GROQ_API_KEY"],
};

export type CredentialEnvSource = NodeJS.ProcessEnv | Record<string, string | undefined>;
