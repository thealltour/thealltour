import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { ProviderDefinition } from "@/ai-runtime/domain/provider";
import type { WorkloadClass } from "@/ai-runtime/domain/workload";
import { DEFAULT_AI_MODELS } from "@/ai-runtime/registry/models";
import { DEFAULT_AI_PROVIDERS } from "@/ai-runtime/registry/providers";
import {
  validateAiRuntimeRegistryConfig,
  type AiRuntimeRegistryConfig,
} from "@/ai-runtime/registry/validation";

/**
 * Pure eligibility filters for a future Router.
 * Quota health / latency / scoring are intentionally out of scope.
 */
export type ModelEligibilityCriteria = {
  workload: WorkloadClass;
  requiresStructuredOutput?: boolean;
  requiresToolCalling?: boolean;
  /** Allow-list of provider ids (empty/undefined = all enabled providers). */
  providerIds?: string[];
  excludeProviderIds?: string[];
  excludeModelIds?: string[];
  freeOnly?: boolean;
};

export type AiRuntimeRegistry = {
  getProviderById: (id: string) => ProviderDefinition | undefined;
  getModelById: (id: string) => ModelDefinition | undefined;
  listProviders: () => ProviderDefinition[];
  listModels: () => ModelDefinition[];
  listEnabledProviders: () => ProviderDefinition[];
  listEnabledModels: () => ModelDefinition[];
  listModelsByProvider: (providerId: string) => ModelDefinition[];
  listModelsForWorkload: (workload: WorkloadClass) => ModelDefinition[];
  findEligibleModels: (criteria: ModelEligibilityCriteria) => ModelDefinition[];
};

function isModelFree(model: ModelDefinition): boolean {
  if (model.economics.freeTierEligible === true) return true;
  if (model.metadata?.modelPool === "free") return true;
  if (model.modelId.endsWith(":free")) return true;
  if (model.modelId === "openrouter/free") return true;
  return false;
}

export function createAiRuntimeRegistry(config: AiRuntimeRegistryConfig): AiRuntimeRegistry {
  const { providers, models } = validateAiRuntimeRegistryConfig(config);

  const providersById = new Map(providers.map((provider) => [provider.id, provider]));
  const modelsById = new Map(models.map((model) => [model.id, model]));

  const listProviders = () => [...providers];
  const listModels = () => [...models];

  const listEnabledProviders = () => providers.filter((provider) => provider.enabled);

  const listEnabledModels = () =>
    models.filter((model) => {
      if (!model.routing.enabled) return false;
      const provider = providersById.get(model.providerId);
      return Boolean(provider?.enabled);
    });

  const listModelsByProvider = (providerId: string) =>
    models.filter((model) => model.providerId === providerId);

  const findEligibleModels = (criteria: ModelEligibilityCriteria): ModelDefinition[] => {
    const allowProviders =
      criteria.providerIds && criteria.providerIds.length > 0
        ? new Set(criteria.providerIds)
        : null;
    const excludeProviders = new Set(criteria.excludeProviderIds ?? []);
    const excludeModels = new Set(criteria.excludeModelIds ?? []);

    return models.filter((model) => {
      if (excludeModels.has(model.id)) return false;
      if (!model.routing.enabled) return false;
      if (!model.routing.workloadClasses.includes(criteria.workload)) return false;

      const provider = providersById.get(model.providerId);
      if (!provider || !provider.enabled) return false;
      if (excludeProviders.has(provider.id)) return false;
      if (allowProviders && !allowProviders.has(provider.id)) return false;

      if (criteria.requiresStructuredOutput && !model.capabilities.structuredOutput) {
        return false;
      }
      if (criteria.requiresToolCalling && !model.capabilities.toolCalling) {
        return false;
      }
      if (criteria.freeOnly && !isModelFree(model)) return false;

      return true;
    });
  };

  const listModelsForWorkload = (workload: WorkloadClass) => findEligibleModels({ workload });

  return {
    getProviderById: (id) => providersById.get(id),
    getModelById: (id) => modelsById.get(id),
    listProviders,
    listModels,
    listEnabledProviders,
    listEnabledModels,
    listModelsByProvider,
    listModelsForWorkload,
    findEligibleModels,
  };
}

/** Validated default registry used by future Router wiring (not connected yet). */
export function createDefaultAiRuntimeRegistry(): AiRuntimeRegistry {
  return createAiRuntimeRegistry({
    providers: DEFAULT_AI_PROVIDERS,
    models: DEFAULT_AI_MODELS,
  });
}

let defaultRegistry: AiRuntimeRegistry | null = null;

/** Lazy singleton over the default catalog. */
export function getDefaultAiRuntimeRegistry(): AiRuntimeRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createDefaultAiRuntimeRegistry();
  }
  return defaultRegistry;
}

/** Test helper — clears the lazy default singleton. */
export function resetDefaultAiRuntimeRegistryForTests(): void {
  defaultRegistry = null;
}
