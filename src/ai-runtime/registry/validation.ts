import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { ProviderDefinition } from "@/ai-runtime/domain/provider";
import { RuntimeError } from "@/ai-runtime/domain/error";
import {
  modelDefinitionSchema,
  parseOrThrow,
  providerDefinitionHasRawSecrets,
  providerDefinitionSchema,
} from "@/ai-runtime/domain/schemas";

export type AiRuntimeRegistryConfig = {
  providers: readonly ProviderDefinition[];
  models: readonly ModelDefinition[];
};

function assertNoTopLevelSecrets(label: string, value: unknown): void {
  if (providerDefinitionHasRawSecrets(value)) {
    throw new RuntimeError(
      "INVALID_REQUEST",
      `${label} must not contain raw secret fields`,
      false,
    );
  }
}

/**
 * Validates a registry snapshot using domain Zod schemas + relational checks.
 * Does not require credentials to be present or resolvable.
 */
export function validateAiRuntimeRegistryConfig(config: AiRuntimeRegistryConfig): {
  providers: ProviderDefinition[];
  models: ModelDefinition[];
} {
  if (!config || !Array.isArray(config.providers) || !Array.isArray(config.models)) {
    throw new RuntimeError("INVALID_REQUEST", "Registry config requires providers and models arrays", false);
  }

  const providers: ProviderDefinition[] = [];
  const providerIds = new Set<string>();

  for (const [index, raw] of config.providers.entries()) {
    assertNoTopLevelSecrets(`providers[${index}]`, raw);
    const provider = parseOrThrow(providerDefinitionSchema, raw, `providers[${index}]`);
    if (providerIds.has(provider.id)) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        `Duplicate provider id: ${provider.id}`,
        false,
      );
    }
    providerIds.add(provider.id);
    providers.push(provider);
  }

  const models: ModelDefinition[] = [];
  const modelIds = new Set<string>();

  for (const [index, raw] of config.models.entries()) {
    assertNoTopLevelSecrets(`models[${index}]`, raw);
    const model = parseOrThrow(modelDefinitionSchema, raw, `models[${index}]`);
    if (model.metadata && providerDefinitionHasRawSecrets({ metadata: model.metadata })) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        `models[${index}].metadata must not contain raw secret fields`,
        false,
      );
    }
    if (modelIds.has(model.id)) {
      throw new RuntimeError("INVALID_REQUEST", `Duplicate model id: ${model.id}`, false);
    }
    if (!providerIds.has(model.providerId)) {
      throw new RuntimeError(
        "INVALID_REQUEST",
        `Model "${model.id}" references unknown providerId "${model.providerId}"`,
        false,
      );
    }
    modelIds.add(model.id);
    models.push(model);
  }

  return { providers, models };
}
