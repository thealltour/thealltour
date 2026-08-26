export { AI_PROVIDER_IDS, DEFAULT_AI_PROVIDERS } from "@/ai-runtime/registry/providers";
export type { AiProviderRegistryId } from "@/ai-runtime/registry/providers";

export {
  AI_MODEL_IDS,
  DEFAULT_AI_MODELS,
  withAdditionalModels,
} from "@/ai-runtime/registry/models";
export type { AiModelRegistryId } from "@/ai-runtime/registry/models";

export {
  validateAiRuntimeRegistryConfig,
  type AiRuntimeRegistryConfig,
} from "@/ai-runtime/registry/validation";

export {
  createAiRuntimeRegistry,
  createDefaultAiRuntimeRegistry,
  getDefaultAiRuntimeRegistry,
  resetDefaultAiRuntimeRegistryForTests,
  type AiRuntimeRegistry,
  type ModelEligibilityCriteria,
} from "@/ai-runtime/registry/registry";
