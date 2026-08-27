import { describe, expect, it, vi } from "vitest";

import { createRuntimeExecutorStack } from "@/ai-runtime/integration/runtime-stack";
import { mapOpenAiCompatToRuntimeRequest } from "@/ai-runtime/gateway";
import { HERMES_INFERENCE_ALIAS_AUTO } from "@/ai-runtime/integration/constants";
import { createRuntimeRequest } from "@/ai-runtime/integration";

describe("tool loop through RuntimeExecutor stack (mocked provider)", () => {
  it("preserves tools on outbound Gemini body and returns tool_calls without executing tools", async () => {
    const bodies: unknown[] = [];
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body ?? "{}")));
      if (bodies.length === 1) {
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: "STOP",
                content: {
                  parts: [{ functionCall: { name: "echo_codeword", args: { codeword: "SPIKE_TOOL_OK" } } }],
                },
              },
            ],
            usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          candidates: [
            {
              finishReason: "STOP",
              content: { parts: [{ text: "Codeword is SPIKE_TOOL_OK" }] },
            },
          ],
          usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 8, totalTokenCount: 28 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const executor = createRuntimeExecutorStack({
      env: { GOOGLE_API_KEY: "test-key-not-real" },
    });

    // Patch fetch used by adapters via context — stack creates its own context.
    // Instead route through getAdapter by monkeypatching global fetch.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl as unknown as typeof fetch;

    try {
      const first = mapOpenAiCompatToRuntimeRequest({
        model: HERMES_INFERENCE_ALIAS_AUTO,
        tool_choice: "required",
        tools: [
          {
            type: "function",
            function: {
              name: "echo_codeword",
              description: "Echo",
              parameters: {
                type: "object",
                properties: { codeword: { type: "string" } },
                required: ["codeword"],
              },
            },
          },
        ],
        messages: [{ role: "user", content: "call echo_codeword" }],
      });

      const r1 = await executor.executeAndWait(first.request, { timeoutMs: 10_000 });
      expect(r1.status).toBe("completed");
      expect(r1.response?.toolCalls?.[0]?.function.name).toBe("echo_codeword");
      expect((bodies[0] as { tools?: unknown }).tools).toBeTruthy();
      expect((bodies[0] as { toolConfig?: unknown }).toolConfig).toBeTruthy();

      const toolCalls = r1.response!.toolCalls!;
      const second = createRuntimeRequest({
        agentId: "runtime-spike",
        source: "system",
        workload: "manager_decision",
        priority: "high",
        tools: first.request.tools,
        messages: [
          ...first.request.messages,
          { role: "assistant", content: "", toolCalls },
          {
            role: "tool",
            content: JSON.stringify({ codeword: "SPIKE_TOOL_OK" }),
            toolCallId: toolCalls[0]!.id,
            name: "echo_codeword",
          },
        ],
        routing: { requiresToolCalling: true },
      });
      const r2 = await executor.executeAndWait(second, { timeoutMs: 10_000 });
      expect(r2.response?.content).toContain("SPIKE_TOOL_OK");
      expect(r2.response?.toolCalls ?? []).toHaveLength(0);
      // second request should include functionResponse part
      const secondBody = bodies[1] as { contents: Array<{ parts: Array<Record<string, unknown>> }> };
      const hasFunctionResponse = secondBody.contents.some((c) =>
        c.parts.some((p) => "functionResponse" in p),
      );
      expect(hasFunctionResponse).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
