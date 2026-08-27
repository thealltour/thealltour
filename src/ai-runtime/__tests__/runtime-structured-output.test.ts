import { describe, expect, it } from "vitest";

import { RuntimeError } from "@/ai-runtime/domain/error";
import { runtimeResponseFormatSchema, runtimeRequestSchema } from "@/ai-runtime/domain/schemas";
import {
  extractCompatibilityFlags,
  mapOpenAiCompatToRuntimeRequest,
  mapOpenAiResponseFormatToRuntime,
} from "@/ai-runtime/gateway";
import {
  findUnsupportedGeminiSchemaKeywords,
  mapRuntimeResponseFormatToGemini,
} from "@/ai-runtime/adapters/gemini/mapper";
import { mapRuntimeResponseFormatToOpenAi } from "@/ai-runtime/adapters/openrouter/mapper";
import { createDefaultAiRuntimeRegistry, AI_MODEL_IDS } from "@/ai-runtime/registry";
import { createRuntimeRequest } from "@/ai-runtime/integration/runtime-request-factory";
import {
  estimateInputTokensFromRequest,
  estimateResponseFormatTokens,
} from "@/ai-runtime/tokens/heuristic-estimator";
import { HERMES_INFERENCE_ALIAS_AUTO } from "@/ai-runtime/integration/constants";

const SAMPLE_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string" },
    count: { type: "integer" },
  },
  required: ["status", "count"],
};

const SAMPLE_SCHEMA_WITH_ADDITIONAL = {
  ...SAMPLE_SCHEMA,
  additionalProperties: false,
};

describe("STEP 2-5.4C3 structured output", () => {
  it("validates json_object and json_schema domain shapes", () => {
    expect(runtimeResponseFormatSchema.parse({ type: "json_object" })).toEqual({
      type: "json_object",
    });
    const schemaFormat = runtimeResponseFormatSchema.parse({
      type: "json_schema",
      name: "spike",
      schema: SAMPLE_SCHEMA,
      strict: true,
    });
    expect(schemaFormat.type).toBe("json_schema");
    if (schemaFormat.type === "json_schema") {
      expect(schemaFormat.name).toBe("spike");
      expect(schemaFormat.strict).toBe(true);
    }
  });

  it("maps OpenAI response_format through gateway and sets requiresStructuredOutput", () => {
    const flags = extractCompatibilityFlags({
      model: HERMES_INFERENCE_ALIAS_AUTO,
      messages: [{ role: "user", content: "x" }],
      response_format: { type: "json_object" },
    });
    expect(flags.responseFormatPresent).toBe(true);
    expect(flags.unsupportedFields).not.toContain("response_format");

    const { request } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_AUTO,
      messages: [{ role: "user", content: "return json" }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "spike", schema: SAMPLE_SCHEMA, strict: true },
      },
    });
    expect(request.responseFormat?.type).toBe("json_schema");
    expect(request.routing?.requiresStructuredOutput).toBe(true);
  });

  it("rejects malformed response_format", () => {
    expect(() => mapOpenAiResponseFormatToRuntime({ type: "xml" })).toThrow(RuntimeError);
    expect(() =>
      mapOpenAiResponseFormatToRuntime({ type: "json_schema", json_schema: { name: "x" } }),
    ).toThrow(/schema/);
  });

  it("Router eligibility requires structuredOutput capability", () => {
    const registry = createDefaultAiRuntimeRegistry();
    const eligible = registry.findEligibleModels({
      workload: "content_draft",
      requiresStructuredOutput: true,
    });
    expect(eligible.every((m) => m.capabilities.structuredOutput)).toBe(true);
    expect(eligible.some((m) => m.id === AI_MODEL_IDS.OPENROUTER_FREE)).toBe(false);
    expect(eligible.some((m) => m.id === AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY)).toBe(true);
  });

  it("maps responseFormat to OpenAI and Gemini shapes", () => {
    expect(mapRuntimeResponseFormatToOpenAi({ type: "json_object" })).toEqual({
      type: "json_object",
    });
    const openai = mapRuntimeResponseFormatToOpenAi({
      type: "json_schema",
      name: "spike",
      schema: SAMPLE_SCHEMA,
      strict: true,
    });
    expect(openai?.type).toBe("json_schema");

    const geminiJson = mapRuntimeResponseFormatToGemini({ type: "json_object" });
    expect(geminiJson?.responseMimeType).toBe("application/json");
    expect(geminiJson?.responseSchema).toBeUndefined();

    const geminiSchema = mapRuntimeResponseFormatToGemini({
      type: "json_schema",
      name: "spike",
      schema: SAMPLE_SCHEMA,
    });
    expect(geminiSchema?.responseMimeType).toBe("application/json");
    expect((geminiSchema?.responseSchema as { type?: string })?.type).toBe("OBJECT");
  });

  it("rejects Gemini unsupported schema keywords without silent drop", () => {
    expect(findUnsupportedGeminiSchemaKeywords({ $ref: "#/defs/x" })).toContain("$ref");
    expect(findUnsupportedGeminiSchemaKeywords(SAMPLE_SCHEMA_WITH_ADDITIONAL)).toContain(
      "additionalProperties",
    );
    expect(() =>
      mapRuntimeResponseFormatToGemini({
        type: "json_schema",
        name: "bad",
        schema: { type: "object", $ref: "#/x" },
      }),
    ).toThrow(/unsupported keywords/);
    expect(() =>
      mapRuntimeResponseFormatToGemini({
        type: "json_schema",
        name: "bad",
        schema: SAMPLE_SCHEMA_WITH_ADDITIONAL,
      }),
    ).toThrow(/additionalProperties/);
  });

  it("token estimator accounts for response schema size", () => {
    const base = createRuntimeRequest({
      agentId: "runtime-spike",
      source: "system",
      workload: "manager_decision",
      priority: "high",
      messages: [{ role: "user", content: "hi" }],
    });
    const withSchema = createRuntimeRequest({
      agentId: "runtime-spike",
      source: "system",
      workload: "manager_decision",
      priority: "high",
      messages: [{ role: "user", content: "hi" }],
      responseFormat: {
        type: "json_schema",
        name: "spike",
        description: "demo schema",
        schema: SAMPLE_SCHEMA,
      },
    });
    expect(estimateResponseFormatTokens(withSchema.responseFormat)).toBeGreaterThan(10);
    expect(estimateInputTokensFromRequest(withSchema)).toBeGreaterThan(
      estimateInputTokensFromRequest(base),
    );
  });

  it("Cron-style requiresStructuredOutput without responseFormat remains valid", () => {
    const request = createRuntimeRequest({
      agentId: "content-strategist",
      source: "cron",
      workload: "content_draft",
      priority: "background",
      messages: [{ role: "user", content: '{"hint":"json only"}' }],
      routing: { requiresStructuredOutput: true },
    });
    expect(request.responseFormat).toBeUndefined();
    expect(request.routing?.requiresStructuredOutput).toBe(true);
    expect(() => runtimeRequestSchema.parse(request)).not.toThrow();
  });

  it("no-response-format regression still maps plain chat", () => {
    const { request, flags } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_AUTO,
      messages: [{ role: "user", content: "ping" }],
    });
    expect(request.responseFormat).toBeUndefined();
    expect(flags.responseFormatPresent).toBe(false);
    expect(request.routing?.requiresStructuredOutput).toBe(false);
  });
});
