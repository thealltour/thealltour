import { describe, expect, it } from "vitest";

import type { ModelDefinition } from "@/ai-runtime/domain/model";
import type { ProviderDefinition } from "@/ai-runtime/domain/provider";
import { RuntimeError } from "@/ai-runtime/domain/error";
import {
  AI_MODEL_IDS,
  AI_PROVIDER_IDS,
  DEFAULT_AI_MODELS,
  DEFAULT_AI_PROVIDERS,
  createAiRuntimeRegistry,
  createDefaultAiRuntimeRegistry,
  validateAiRuntimeRegistryConfig,
  withAdditionalModels,
} from "@/ai-runtime/registry";

function cloneProviders(overrides?: Partial<ProviderDefinition> & { id?: string }): ProviderDefinition[] {
  return DEFAULT_AI_PROVIDERS.map((provider) => {
    if (overrides?.id && provider.id === overrides.id) {
      return { ...provider, ...overrides };
    }
    return { ...provider };
  });
}

function cloneModels(mutator?: (model: ModelDefinition) => ModelDefinition): ModelDefinition[] {
  return DEFAULT_AI_MODELS.map((model) => (mutator ? mutator({ ...model, routing: { ...model.routing, workloadClasses: [...model.routing.workloadClasses] }, capabilities: { ...model.capabilities }, limits: { ...model.limits }, economics: { ...model.economics }, metadata: model.metadata ? { ...model.metadata } : undefined }) : { ...model }));
}

describe("ai-runtime registry", () => {
  const registry = createDefaultAiRuntimeRegistry();

  it("looks up Gemini / OpenRouter / Groq / NVIDIA providers by id", () => {
    expect(registry.getProviderById(AI_PROVIDER_IDS.GEMINI_MAIN)?.kind).toBe("gemini");
    expect(registry.getProviderById(AI_PROVIDER_IDS.OPENROUTER_MAIN)?.kind).toBe("openrouter");
    expect(registry.getProviderById(AI_PROVIDER_IDS.GROQ_MAIN)?.kind).toBe("groq");
    expect(registry.getProviderById(AI_PROVIDER_IDS.NVIDIA_MAIN)?.kind).toBe("nvidia");
    expect(registry.getProviderById(AI_PROVIDER_IDS.GEMINI_MAIN)?.enabled).toBe(true);
    expect(registry.getProviderById(AI_PROVIDER_IDS.OPENROUTER_MAIN)?.enabled).toBe(true);
    expect(registry.getProviderById(AI_PROVIDER_IDS.GROQ_MAIN)?.enabled).toBe(false);
    expect(registry.getProviderById(AI_PROVIDER_IDS.NVIDIA_MAIN)?.enabled).toBe(true);
    expect(registry.getProviderById(AI_PROVIDER_IDS.GEMINI_MAIN)?.credentialRef).toBe(
      "ai-provider/gemini/main",
    );
    expect(registry.getProviderById(AI_PROVIDER_IDS.NVIDIA_MAIN)?.credentialRef).toBe(
      "ai-provider/nvidia/main",
    );
  });

  it("registers NVIDIA Llama 3.3 70B without raw secrets", () => {
    const nvidia = registry.getProviderById(AI_PROVIDER_IDS.NVIDIA_MAIN);
    expect(nvidia?.displayName).toBe("NVIDIA NIM");
    expect(nvidia).not.toHaveProperty("apiKey");
    expect(JSON.stringify(nvidia)).not.toMatch(/NVIDIA_API_KEY|nvapi-/i);

    const model = registry.getModelById(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B);
    expect(model?.providerId).toBe(AI_PROVIDER_IDS.NVIDIA_MAIN);
    expect(model?.modelId).toBe("meta/llama-3.3-70b-instruct");
    expect(model?.limits.contextTokens).toBe(131072);
    expect(model?.limits.rpm).toBeUndefined();
    expect(model?.economics.freeTierEligible).toBe(true);
  });

  it("includes NVIDIA for analysis/summarization but not manager_decision", () => {
    const analysis = registry.listModelsForWorkload("analysis").map((model) => model.id);
    const summarization = registry.listModelsForWorkload("summarization").map((model) => model.id);
    const manager = registry.listModelsForWorkload("manager_decision").map((model) => model.id);

    expect(analysis).toContain(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B);
    expect(summarization).toContain(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B);
    expect(manager).not.toContain(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B);
  });

  it("keeps Groq registered but disabled and ineligible", () => {
    const groq = registry.getProviderById(AI_PROVIDER_IDS.GROQ_MAIN);
    expect(groq).toBeTruthy();
    expect(groq?.enabled).toBe(false);
    expect(groq?.metadata?.statusReason).toBe("Hermes provider invocation unavailable");
    expect(registry.listEnabledProviders().map((provider) => provider.id)).not.toContain(
      AI_PROVIDER_IDS.GROQ_MAIN,
    );

    const withGroqModel = createAiRuntimeRegistry({
      providers: [...DEFAULT_AI_PROVIDERS],
      models: withAdditionalModels(DEFAULT_AI_MODELS, [
        {
          id: "groq-hypothetical",
          providerId: AI_PROVIDER_IDS.GROQ_MAIN,
          modelId: "openai/gpt-oss-120b",
          displayName: "Groq hypothetical",
          capabilities: {
            reasoning: 3,
            writing: 3,
            extraction: 3,
            summarization: 3,
            structuredOutput: true,
            toolCalling: true,
          },
          limits: {},
          economics: {},
          routing: {
            workloadClasses: ["summarization"],
            basePriority: 50,
            enabled: true,
          },
        },
      ]),
    });
    expect(
      withGroqModel.findEligibleModels({ workload: "summarization" }).map((model) => model.id),
    ).not.toContain("groq-hypothetical");
  });

  it("looks up Gemini primary/secondary and OpenRouter free models", () => {
    const primary = registry.getModelById(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY);
    const secondary = registry.getModelById(AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY);
    const free = registry.getModelById(AI_MODEL_IDS.OPENROUTER_FREE);

    expect(primary?.providerId).toBe(AI_PROVIDER_IDS.GEMINI_MAIN);
    expect(primary?.modelId).toBe("gemini-3.5-flash-lite");
    expect(secondary?.modelId).toBe("gemini-3.1-flash-lite");
    expect(free?.modelId).toBe("openrouter/free");
    expect(free?.metadata?.routingMode).toBe("provider-managed");
    expect(free?.metadata?.modelPool).toBe("free");
    expect(free?.economics.freeTierEligible).toBe(true);
  });

  it("keeps provider/model relationships valid and leaves Groq models empty by default", () => {
    for (const model of registry.listModels()) {
      expect(registry.getProviderById(model.providerId)).toBeTruthy();
    }
    expect(registry.listModelsByProvider(AI_PROVIDER_IDS.GROQ_MAIN)).toEqual([]);
  });

  it("filters by workload (content_draft)", () => {
    const eligible = registry.listModelsForWorkload("content_draft").map((model) => model.id);
    expect(eligible).toContain(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY);
    expect(eligible).toContain(AI_MODEL_IDS.OPENROUTER_FREE);
    expect(eligible).toContain(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B);

    const managerOnly = registry.listModelsForWorkload("manager_decision").map((model) => model.id);
    expect(managerOnly).toContain(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY);
    expect(managerOnly).not.toContain(AI_MODEL_IDS.OPENROUTER_FREE);
    expect(managerOnly).not.toContain(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B);
  });

  it("filters by structured output and tool calling requirements", () => {
    const withTools = registry
      .findEligibleModels({ workload: "content_draft", requiresToolCalling: true })
      .map((model) => model.id);
    expect(withTools).toContain(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY);
    expect(withTools).not.toContain(AI_MODEL_IDS.OPENROUTER_FREE);

    const structured = registry.findEligibleModels({
      workload: "extraction",
      requiresStructuredOutput: true,
    });
    expect(structured.every((model) => model.capabilities.structuredOutput)).toBe(true);
  });

  it("supports freeOnly filter", () => {
    const freeOnly = registry
      .findEligibleModels({ workload: "summarization", freeOnly: true })
      .map((model) => model.id);
    expect(freeOnly).toContain(AI_MODEL_IDS.OPENROUTER_FREE);
    expect(freeOnly).toContain(AI_MODEL_IDS.NVIDIA_LLAMA_3_3_70B);
    expect(freeOnly).not.toContain(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY);
  });

  it("excludes models when provider is disabled", () => {
    const disabled = createAiRuntimeRegistry({
      providers: cloneProviders({ id: AI_PROVIDER_IDS.GEMINI_MAIN, enabled: false }),
      models: cloneModels(),
    });
    const ids = disabled.findEligibleModels({ workload: "content_draft" }).map((model) => model.id);
    expect(ids).not.toContain(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY);
    expect(ids).toContain(AI_MODEL_IDS.OPENROUTER_FREE);
  });

  it("excludes models when routing.enabled is false", () => {
    const disabledModel = createAiRuntimeRegistry({
      providers: cloneProviders(),
      models: cloneModels((model) =>
        model.id === AI_MODEL_IDS.OPENROUTER_FREE
          ? { ...model, routing: { ...model.routing, enabled: false } }
          : model,
      ),
    });
    const ids = disabledModel
      .findEligibleModels({ workload: "content_draft" })
      .map((model) => model.id);
    expect(ids).not.toContain(AI_MODEL_IDS.OPENROUTER_FREE);
  });

  it("honors excluded provider and model lists", () => {
    const ids = registry
      .findEligibleModels({
        workload: "content_draft",
        excludeProviderIds: [AI_PROVIDER_IDS.OPENROUTER_MAIN],
        excludeModelIds: [AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY],
      })
      .map((model) => model.id);
    expect(ids).toContain(AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY);
    expect(ids).not.toContain(AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY);
    expect(ids).not.toContain(AI_MODEL_IDS.OPENROUTER_FREE);
  });

  it("rejects duplicate provider ids", () => {
    expect(() =>
      validateAiRuntimeRegistryConfig({
        providers: [...DEFAULT_AI_PROVIDERS, { ...DEFAULT_AI_PROVIDERS[0]! }],
        models: [...DEFAULT_AI_MODELS],
      }),
    ).toThrow(RuntimeError);
  });

  it("rejects duplicate model ids", () => {
    expect(() =>
      validateAiRuntimeRegistryConfig({
        providers: [...DEFAULT_AI_PROVIDERS],
        models: [...DEFAULT_AI_MODELS, { ...DEFAULT_AI_MODELS[0]! }],
      }),
    ).toThrow(/Duplicate model id/i);
  });

  it("rejects models that reference unknown providers", () => {
    expect(() =>
      validateAiRuntimeRegistryConfig({
        providers: [...DEFAULT_AI_PROVIDERS],
        models: [
          {
            ...DEFAULT_AI_MODELS[0]!,
            id: "orphan-model",
            providerId: "does-not-exist",
          },
        ],
      }),
    ).toThrow(/unknown providerId/i);
  });

  it("blocks raw secret fields in registry config", () => {
    expect(() =>
      validateAiRuntimeRegistryConfig({
        providers: [
          {
            ...DEFAULT_AI_PROVIDERS[0]!,
            // @ts-expect-error intentional forbidden field for validation coverage
            apiKey: "sk-should-never-appear",
          },
        ],
        models: [...DEFAULT_AI_MODELS],
      }),
    ).toThrow(/raw secret/i);

    expect(() =>
      validateAiRuntimeRegistryConfig({
        providers: [...DEFAULT_AI_PROVIDERS],
        models: [
          {
            ...DEFAULT_AI_MODELS[0]!,
            id: "bad-meta",
            metadata: { apiKey: "nope" },
          },
        ],
      }),
    ).toThrow(/secret/i);
  });

  it("allows adding an arbitrary OpenRouter :free model via config only", () => {
    const extra: ModelDefinition = {
      id: "openrouter-llama-free-example",
      providerId: AI_PROVIDER_IDS.OPENROUTER_MAIN,
      modelId: "meta-llama/llama-3.3-70b-instruct:free",
      displayName: "Llama 3.3 70B Instruct (free)",
      capabilities: {
        reasoning: 3,
        writing: 3,
        extraction: 3,
        summarization: 3,
        structuredOutput: true,
        toolCalling: false,
      },
      limits: {},
      economics: { freeTierEligible: true },
      routing: {
        workloadClasses: ["classification", "summarization"],
        basePriority: 30,
        enabled: true,
      },
      metadata: { routingMode: "fixed" },
    };

    const extended = createAiRuntimeRegistry({
      providers: [...DEFAULT_AI_PROVIDERS],
      models: withAdditionalModels(DEFAULT_AI_MODELS, [extra]),
    });

    expect(extended.getModelById("openrouter-llama-free-example")?.modelId).toBe(
      "meta-llama/llama-3.3-70b-instruct:free",
    );
    expect(
      extended.findEligibleModels({ workload: "classification", freeOnly: true }).map((m) => m.id),
    ).toContain("openrouter-llama-free-example");
  });

  it("does not hardcode guessed Groq model slugs in the default catalog", () => {
    expect(DEFAULT_AI_MODELS.every((model) => model.providerId !== AI_PROVIDER_IDS.GROQ_MAIN)).toBe(
      true,
    );
  });

  it("leaves quota rate fields unknown (undefined) on default models", () => {
    for (const model of registry.listModels()) {
      expect(model.limits.rpm).toBeUndefined();
      expect(model.limits.tpm).toBeUndefined();
      expect(model.limits.rpd).toBeUndefined();
    }
  });
});
