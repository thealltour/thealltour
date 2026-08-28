import {
  AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV,
} from "@/ai-runtime/integration/constants";
import {
  expectedProductionAliasForProfile,
  lookupGatewayAlias,
} from "@/ai-runtime/gateway/alias-registry";

export type HermesRuntimeCutoverConfigInput = {
  profileId: string;
  model?: {
    provider?: string;
    default?: string;
    base_url?: string;
    api_mode?: string;
  };
  fallback_providers?: unknown;
  providers?: Record<string, { key_env?: string; base_url?: string; api_mode?: string }>;
};

export type HermesRuntimeCutoverValidationIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type HermesRuntimeCutoverValidationResult = {
  ok: boolean;
  profileId: string;
  expectedAlias: string;
  issues: HermesRuntimeCutoverValidationIssue[];
};

function isEmptyFallbackProviders(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

/**
 * READ-ONLY validator for a single Hermes profile config before Production canary.
 * Does not read secret values — only env var names and structural fields.
 */
export function validateHermesRuntimeCutoverConfig(
  input: HermesRuntimeCutoverConfigInput,
  env: Record<string, string | undefined> = process.env,
): HermesRuntimeCutoverValidationResult {
  const profileId = input.profileId.trim();
  const expectedAlias = expectedProductionAliasForProfile(profileId);
  const issues: HermesRuntimeCutoverValidationIssue[] = [];

  const alias = input.model?.default?.trim().toLowerCase();
  const aliasEntry = alias ? lookupGatewayAlias(alias) : undefined;

  if (!alias) {
    issues.push({
      code: "missing_model_default",
      message: "model.default must be set to a production gateway alias",
      severity: "error",
    });
  } else if (alias !== expectedAlias) {
    issues.push({
      code: "alias_profile_mismatch",
      message: `model.default ${alias} does not match profile ${expectedAlias}`,
      severity: "error",
    });
  } else if (!aliasEntry || aliasEntry.kind !== "production") {
    issues.push({
      code: "alias_not_production",
      message: `model.default ${alias} is not a registered production alias`,
      severity: "error",
    });
  } else if (aliasEntry.agentId !== profileId) {
    issues.push({
      code: "alias_agent_mismatch",
      message: `alias maps to agentId ${aliasEntry.agentId}, expected ${profileId}`,
      severity: "error",
    });
  }

  if (input.model?.provider?.trim().toLowerCase() !== "custom") {
    issues.push({
      code: "provider_not_custom",
      message: "model.provider must be custom for Runtime Gateway cutover",
      severity: "error",
    });
  }

  const baseUrl = input.model?.base_url?.trim() ?? "";
  if (!baseUrl.includes("/api/ai-runtime/v1")) {
    issues.push({
      code: "base_url_not_gateway",
      message: "model.base_url must point at /api/ai-runtime/v1",
      severity: "error",
    });
  }

  if (input.model?.api_mode?.trim() !== "chat_completions") {
    issues.push({
      code: "api_mode_not_chat_completions",
      message: "model.api_mode must be chat_completions",
      severity: "error",
    });
  }

  if (!isEmptyFallbackProviders(input.fallback_providers)) {
    issues.push({
      code: "hermes_fallback_providers_nonempty",
      message:
        "fallback_providers must be [] — Runtime Router owns provider/model fallback during gateway cutover",
      severity: "error",
    });
  }

  const providerBlocks = Object.values(input.providers ?? {});
  const keyEnvNames = providerBlocks
    .map((block) => block.key_env?.trim())
    .filter((name): name is string => Boolean(name));

  if (!keyEnvNames.includes(AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV)) {
    issues.push({
      code: "gateway_token_key_env_missing",
      message: `providers.*.key_env should reference ${AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV}`,
      severity: "warning",
    });
  }

  const tokenConfigured = Boolean(env[AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV]?.trim());
  if (!tokenConfigured) {
    issues.push({
      code: "gateway_token_env_unset",
      message: `${AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV} is not set in the process environment`,
      severity: "warning",
    });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    profileId,
    expectedAlias,
    issues,
  };
}
