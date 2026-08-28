import {
  AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV,
} from "@/ai-runtime/integration/constants";
import {
  expectedProductionAliasForProfile,
  lookupGatewayAlias,
} from "@/ai-runtime/gateway/alias-registry";
import {
  type HermesExecutionEnvScope,
  isEnvKeyAvailableInHermesScope,
  loadHermesExecutionEnvScope,
} from "@/ai-runtime/gateway/hermes-env-scope";

export type HermesProviderBlock = {
  key_env?: string;
  api_key?: string;
  base_url?: string;
  api_mode?: string;
  default_model?: string;
  models?: Record<string, unknown>;
};

export type HermesRuntimeCutoverConfigInput = {
  profileId: string;
  model?: {
    provider?: string;
    default?: string;
    base_url?: string;
    api_mode?: string;
  };
  fallback_providers?: unknown;
  providers?: Record<string, HermesProviderBlock>;
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
  namedProviderKey?: string;
  issues: HermesRuntimeCutoverValidationIssue[];
  hermesExecutionScope?: {
    gatewayTokenSource: "profile_env" | "global_env" | "process_env" | "missing";
  };
};

export type HermesRuntimeCutoverValidationOptions = {
  /** Node/process env (legacy check — insufficient alone for Hermes CLI). */
  env?: Record<string, string | undefined>;
  /** Process env visible to Hermes CLI when resolving key_env (defaults to env). */
  hermesProcessEnv?: Record<string, string | undefined>;
  /** When true, also verify gateway token key exists in Hermes execution scope. */
  checkHermesExecutionScope?: boolean;
  hermesHome?: string;
};

function isEmptyFallbackProviders(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

/** Subset of Hermes custom_provider_aliases (providers.py). */
function providerIdentityAliases(providerKey: string, displayName?: string): Set<string> {
  const aliases = new Set<string>();
  for (const raw of [displayName, providerKey]) {
    const value = String(raw ?? "").trim().toLowerCase();
    if (!value) continue;
    const normalized = value.replace(/\s+/g, "-");
    aliases.add(normalized);
    aliases.add(normalized.startsWith("custom:") ? normalized : `custom:${normalized}`);
    if (normalized.startsWith("custom:")) {
      const suffix = normalized.split(":", 2)[1];
      if (suffix) aliases.add(suffix);
    }
  }
  return aliases;
}

function resolveNamedProviderKey(
  modelProvider: string,
  providers: Record<string, HermesProviderBlock>,
): string | undefined {
  const requested = normalizeIdentity(modelProvider);
  if (!requested || requested === "custom" || requested === "auto") {
    return undefined;
  }
  for (const [providerKey, block] of Object.entries(providers)) {
    const aliases = providerIdentityAliases(providerKey, providerKey);
    if (aliases.has(requested)) return providerKey;
    void block;
  }
  return undefined;
}

function entryServesModel(block: HermesProviderBlock, alias: string): boolean {
  const target = alias.trim().toLowerCase();
  if (!target) return false;
  if (block.default_model?.trim().toLowerCase() === target) return true;
  const models = block.models;
  if (models && typeof models === "object") {
    return Object.keys(models).some((key) => key.trim().toLowerCase() === target);
  }
  return false;
}

/** C7 Attempt #1 shape — must fail preflight. */
export function isBareCustomProvider(provider: string | undefined): boolean {
  return normalizeIdentity(provider ?? "") === "custom";
}

/**
 * READ-ONLY validator aligned with Hermes v0.20.5 runtime_provider resolution.
 * Does not read secret values — only env var names and structural fields.
 */
export function validateHermesRuntimeCutoverConfig(
  input: HermesRuntimeCutoverConfigInput,
  options: HermesRuntimeCutoverValidationOptions = {},
): HermesRuntimeCutoverValidationResult {
  const env = options.env ?? process.env;
  const hermesProcessEnv = options.hermesProcessEnv ?? env;
  const profileId = input.profileId.trim();
  const expectedAlias = expectedProductionAliasForProfile(profileId);
  const issues: HermesRuntimeCutoverValidationIssue[] = [];
  const providers = input.providers ?? {};

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

  const modelProvider = input.model?.provider?.trim() ?? "";

  if (isBareCustomProvider(modelProvider)) {
    issues.push({
      code: "hermes_bare_custom_provider_forbidden",
      message:
        'model.provider must be a named custom provider (e.g. custom:thealltour-runtime), not bare "custom" — Hermes bare-custom loopback resolution ignores providers.*.key_env',
      severity: "error",
    });
  }

  const namedProviderKey = resolveNamedProviderKey(modelProvider, providers);
  if (!isBareCustomProvider(modelProvider) && Object.keys(providers).length > 0 && !namedProviderKey) {
    issues.push({
      code: "hermes_named_provider_unresolved",
      message: `model.provider ${modelProvider} does not match any providers: block key`,
      severity: "error",
    });
  }

  if (Object.keys(providers).length === 0) {
    issues.push({
      code: "hermes_providers_block_missing",
      message: "providers: block with named gateway endpoint is required",
      severity: "error",
    });
  }

  const gatewayBlocks = Object.entries(providers).filter(([, block]) =>
    (block.base_url ?? "").includes("/api/ai-runtime/v1"),
  );

  if (gatewayBlocks.length === 0) {
    issues.push({
      code: "base_url_not_gateway",
      message: "providers.*.base_url must point at /api/ai-runtime/v1",
      severity: "error",
    });
  }

  if (gatewayBlocks.length > 1) {
    issues.push({
      code: "hermes_multiple_gateway_providers",
      message: "exactly one providers.* entry should target the Runtime Gateway",
      severity: "warning",
    });
  }

  const [gatewayProviderKey, gatewayBlock] = gatewayBlocks[0] ?? [];
  const activeBlock = namedProviderKey ? providers[namedProviderKey] : gatewayBlock;

  if (namedProviderKey && gatewayProviderKey && namedProviderKey !== gatewayProviderKey) {
    issues.push({
      code: "hermes_provider_key_mismatch",
      message: `model.provider resolves to ${namedProviderKey} but gateway block is ${gatewayProviderKey}`,
      severity: "warning",
    });
  }

  const baseUrl = input.model?.base_url?.trim() ?? activeBlock?.base_url?.trim() ?? "";
  if (!baseUrl.includes("/api/ai-runtime/v1")) {
    issues.push({
      code: "model_base_url_not_gateway",
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

  if (activeBlock?.api_mode?.trim() && activeBlock.api_mode.trim() !== "chat_completions") {
    issues.push({
      code: "provider_api_mode_not_chat_completions",
      message: "providers.*.api_mode must be chat_completions",
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

  for (const [providerKey, block] of Object.entries(providers)) {
    if (block.api_key?.trim()) {
      issues.push({
        code: "hermes_inline_api_key_forbidden",
        message: `providers.${providerKey}.api_key must not be set — use key_env for ${AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV}`,
        severity: "error",
      });
    }
  }

  const keyEnv = activeBlock?.key_env?.trim() ?? "";
  if (!keyEnv) {
    issues.push({
      code: "gateway_token_key_env_missing",
      message: `providers.*.key_env must reference ${AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV}`,
      severity: "error",
    });
  } else if (keyEnv !== AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV) {
    issues.push({
      code: "gateway_token_key_env_unexpected",
      message: `providers.*.key_env must be ${AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV}`,
      severity: "error",
    });
  }

  if (alias && activeBlock && !entryServesModel(activeBlock, alias)) {
    issues.push({
      code: "hermes_alias_not_in_provider_models",
      message:
        "model.default alias must appear under providers.*.models or providers.*.default_model for Hermes -m / session model reverse-lookup",
      severity: "error",
    });
  }

  let hermesExecutionScope: HermesRuntimeCutoverValidationResult["hermesExecutionScope"];
  const checkScope = options.checkHermesExecutionScope ?? true;
  if (checkScope && keyEnv) {
    const scope = loadHermesExecutionEnvScope(profileId, hermesProcessEnv, options.hermesHome);
    const availability = isEnvKeyAvailableInHermesScope(keyEnv, scope);
    hermesExecutionScope = { gatewayTokenSource: availability.source };
    if (!availability.available) {
      issues.push({
        code: "gateway_token_not_in_hermes_execution_scope",
        message: `${keyEnv} is not present in profile .env, ~/.hermes/.env, or process environment — Hermes _getenv(key_env) will resolve empty`,
        severity: "error",
      });
    }
  }

  const nodeTokenConfigured = Boolean(env[AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV]?.trim());
  if (nodeTokenConfigured && hermesExecutionScope?.gatewayTokenSource === "missing") {
    issues.push({
      code: "gateway_token_node_only_mismatch",
      message:
        `${AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV} is visible to Node/process env but not to Hermes execution scope — C7-style false positive`,
      severity: "warning",
    });
  }

  return {
    ok: issues.every((issue) => issue.severity !== "error"),
    profileId,
    expectedAlias,
    namedProviderKey,
    issues,
    hermesExecutionScope,
  };
}

export { loadHermesExecutionEnvScope, type HermesExecutionEnvScope };
