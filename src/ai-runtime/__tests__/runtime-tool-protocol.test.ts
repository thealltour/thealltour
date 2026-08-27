import { describe, expect, it } from "vitest";

import { createDefaultAiRuntimeRegistry } from "@/ai-runtime/registry/registry";
import { AI_MODEL_IDS } from "@/ai-runtime/registry/models";
import {
  mapRuntimeMessagesToOpenAiChat,
  mapRuntimeToolsToOpenAi,
  extractOpenAiToolCalls,
  mapRuntimeToolChoiceToOpenAi,
} from "@/ai-runtime/adapters/openrouter/mapper";
import {
  mapRuntimeMessagesToGemini,
  mapRuntimeToolsToGemini,
  extractGeminiToolCalls,
  mapRuntimeToolChoiceToGemini,
} from "@/ai-runtime/adapters/gemini/mapper";
import {
  clearGeminiToolCallStateForTests,
  rememberGeminiToolCallState,
} from "@/ai-runtime/adapters/gemini/tool-call-state";
import {
  mapOpenAiCompatToRuntimeRequest,
  mapOpenAiToolsToRuntime,
  mapRuntimeResponseToOpenAiCompat,
} from "@/ai-runtime/gateway";
import { runtimeRequestSchema, runtimeToolDefinitionSchema } from "@/ai-runtime/domain/schemas";
import { createHeuristicTokenEstimator } from "@/ai-runtime/tokens";
import { createRuntimeRequest } from "@/ai-runtime/integration";
import { HERMES_INFERENCE_ALIAS_AUTO } from "@/ai-runtime/integration/constants";

const echoTool = {
  type: "function" as const,
  function: {
    name: "echo_codeword",
    description: "Echo a codeword for spike tests",
    parameters: {
      type: "object",
      properties: { codeword: { type: "string" } },
      required: ["codeword"],
    },
  },
};

describe("STEP 2-5.4C2 Runtime tool protocol", () => {
  it("validates RuntimeToolDefinition schema", () => {
    expect(runtimeToolDefinitionSchema.parse(echoTool).function.name).toBe("echo_codeword");
  });

  it("maps OpenAI tools/tool_choice/tool_calls/tool results through gateway", () => {
    const { request } = mapOpenAiCompatToRuntimeRequest({
      model: HERMES_INFERENCE_ALIAS_AUTO,
      messages: [
        { role: "user", content: "call echo" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "call_1",
              type: "function",
              function: { name: "echo_codeword", arguments: '{"codeword":"ALPHA"}' },
            },
          ],
        },
        { role: "tool", tool_call_id: "call_1", name: "echo_codeword", content: '{"ok":true}' },
      ],
      tools: [echoTool],
      tool_choice: "auto",
    });

    expect(request.tools?.[0]?.function.name).toBe("echo_codeword");
    expect(request.toolChoice).toBe("auto");
    expect(request.routing?.requiresToolCalling).toBe(true);
    expect(request.messages[1]?.toolCalls?.[0]?.id).toBe("call_1");
    expect(request.messages[2]?.toolCallId).toBe("call_1");
    expect(runtimeRequestSchema.parse(request).id).toBe(request.id);
  });

  it("OpenRouter mapper preserves tools and tool results", () => {
    const tools = mapRuntimeToolsToOpenAi([echoTool]);
    expect(tools?.[0]?.function.name).toBe("echo_codeword");
    expect(mapRuntimeToolChoiceToOpenAi("required")).toBe("required");

    const messages = mapRuntimeMessagesToOpenAiChat([
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "echo_codeword", arguments: '{"codeword":"Z"}' },
          },
        ],
      },
      { role: "tool", content: "Z", toolCallId: "call_1", name: "echo_codeword" },
    ]);
    expect(messages[1]?.tool_calls?.[0]?.id).toBe("call_1");
    expect(messages[2]?.role).toBe("tool");
    expect(messages[2]?.tool_call_id).toBe("call_1");

    const extracted = extractOpenAiToolCalls({
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: "call_x",
                type: "function",
                function: { name: "echo_codeword", arguments: "{}" },
              },
            ],
          },
        },
      ],
    });
    expect(extracted?.[0]?.id).toBe("call_x");
  });

  it("Gemini mapper translates functionDeclarations / functionCall / functionResponse", () => {
    const tools = mapRuntimeToolsToGemini([echoTool]);
    expect(tools?.[0]?.functionDeclarations?.[0]?.name).toBe("echo_codeword");
    expect(mapRuntimeToolChoiceToGemini("auto")?.functionCallingConfig.mode).toBe("AUTO");

    const body = mapRuntimeMessagesToGemini([
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "echo_codeword", arguments: '{"codeword":"G"}' },
          },
        ],
      },
      { role: "tool", content: '{"echo":"G"}', toolCallId: "call_1", name: "echo_codeword" },
    ]);
    const modelParts = body.contents[1]?.parts ?? [];
    expect(modelParts.some((part) => "functionCall" in part)).toBe(true);
    const userParts = body.contents[2]?.parts ?? [];
    expect(userParts.some((part) => "functionResponse" in part)).toBe(true);

    const calls = extractGeminiToolCalls({
      candidates: [
        {
          content: {
            parts: [{ functionCall: { name: "echo_codeword", args: { codeword: "G" } } }],
          },
          finishReason: "STOP",
        },
      ],
    });
    expect(calls?.[0]?.function.name).toBe("echo_codeword");
    expect(calls?.[0]?.id).toContain("gemini_call_");
  });

  it("Router eligibility excludes OpenRouter free when requiresToolCalling", () => {
    const registry = createDefaultAiRuntimeRegistry();
    const eligible = registry.findEligibleModels({
      workload: "manager_decision",
      requiresToolCalling: true,
    });
    expect(eligible.every((model) => model.capabilities.toolCalling)).toBe(true);
    expect(eligible.some((model) => model.id === AI_MODEL_IDS.OPENROUTER_FREE)).toBe(false);
    expect(eligible.some((model) => model.id === AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA)).toBe(false);
    expect(eligible.some((model) => model.id === AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY)).toBe(true);
  });

  it("token estimator accounts for tool schemas", () => {
    const estimator = createHeuristicTokenEstimator({ safetyMultiplier: 1 });
    const base = createRuntimeRequest({
      agentId: "runtime-spike",
      source: "system",
      workload: "manager_decision",
      priority: "interactive",
      messages: [{ role: "user", content: "hi" }],
    });
    const withTools = createRuntimeRequest({
      agentId: "runtime-spike",
      source: "system",
      workload: "manager_decision",
      priority: "interactive",
      messages: [{ role: "user", content: "hi" }],
      tools: [echoTool],
    });
    const baseEst = estimator.estimate(base);
    const toolEst = estimator.estimate(withTools);
    expect(toolEst.rawEstimatedInputTokens).toBeGreaterThan(baseEst.rawEstimatedInputTokens);
  });

  it("gateway response includes tool_calls for Hermes", () => {
    const json = mapRuntimeResponseToOpenAiCompat(
      {
        requestId: "r1",
        providerId: "gemini-main",
        modelId: "gemini-flash-lite-primary",
        content: "",
        toolCalls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "echo_codeword", arguments: '{"codeword":"A"}' },
          },
        ],
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        latencyMs: 1,
        finishReason: "tool_call",
        routing: { attempts: [], fallbackUsed: false },
      },
      HERMES_INFERENCE_ALIAS_AUTO,
    );
    expect(json.choices[0]?.finish_reason).toBe("tool_calls");
    expect(json.choices[0]?.message.tool_calls?.[0]?.id).toBe("call_1");
  });

  it("mapOpenAiToolsToRuntime ignores non-function tool types without inventing tools", () => {
    expect(mapOpenAiToolsToRuntime([{ type: "unsupported" }])).toBeUndefined();
  });

  it("hydrates Gemini thoughtSignature from short-lived bridge when providerData missing", () => {
    clearGeminiToolCallStateForTests();
    rememberGeminiToolCallState("gemini_call_0_echo_codeword", {
      thoughtSignature: "sig-bridge-test",
      functionCall: { name: "echo_codeword", args: { codeword: "SPIKE_TOOL_OK" } },
    });
    const body = mapRuntimeMessagesToGemini([
      { role: "user", content: "call tool" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "gemini_call_0_echo_codeword",
            type: "function",
            function: { name: "echo_codeword", arguments: "{\"codeword\":\"SPIKE_TOOL_OK\"}" },
          },
        ],
      },
      {
        role: "tool",
        content: "{\"codeword\":\"SPIKE_TOOL_OK\"}",
        toolCallId: "gemini_call_0_echo_codeword",
        name: "echo_codeword",
      },
    ]);
    const modelPart = body.contents.find((c) => c.role === "model")?.parts[0] as {
      thoughtSignature?: string;
      functionCall?: { name?: string };
    };
    expect(modelPart?.thoughtSignature).toBe("sig-bridge-test");
    expect(modelPart?.functionCall?.name).toBe("echo_codeword");
  });

});
