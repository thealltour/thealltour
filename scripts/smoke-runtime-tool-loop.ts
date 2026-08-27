/**
 * Runtime tool loop smoke (Hermes ownership simulated).
 * No raw secrets / prompts / tool args logged.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRuntimeExecutorStack } from "@/ai-runtime/integration/runtime-stack";
import { createRuntimeRequest } from "@/ai-runtime/integration/runtime-request-factory";
import { mapOpenAiCompatToRuntimeRequest, mapRuntimeResponseToOpenAiCompat } from "@/ai-runtime/gateway";
import { HERMES_INFERENCE_ALIAS_AUTO } from "@/ai-runtime/integration/constants";

function loadEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  for (const file of [
    resolve(process.cwd(), ".env.local"),
    resolve(process.env.HOME || "/home/ysh", ".hermes/.env"),
  ]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const idx = trimmed.indexOf("=");
        const key = trimmed.slice(0, idx).trim();
        let value = trimmed.slice(idx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!env[key]) env[key] = value;
      }
    } catch {
      // ignore
    }
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const executor = createRuntimeExecutorStack({ env });

  const first = mapOpenAiCompatToRuntimeRequest({
    model: HERMES_INFERENCE_ALIAS_AUTO,
    stream: false,
    tool_choice: "required",
    tools: [
      {
        type: "function",
        function: {
          name: "echo_codeword",
          description: "Echo codeword",
          parameters: {
            type: "object",
            properties: { codeword: { type: "string" } },
            required: ["codeword"],
          },
        },
      },
    ],
    messages: [
      {
        role: "user",
        content: "You must call echo_codeword with codeword SPIKE_TOOL_OK. After the tool returns, reply with exactly the codeword from the tool result and nothing else.",
      },
    ],
  });

  const r1 = await executor.executeAndWait(first.request, { timeoutMs: 120_000 });
  const toolCalls = r1.response?.toolCalls ?? [];
  console.log(
    JSON.stringify({
      step: "request1",
      status: r1.status,
      providerId: r1.response?.providerId,
      modelId: r1.response?.modelId,
      finishReason: r1.response?.finishReason,
      toolCallCount: toolCalls.length,
      toolsOnRequest: first.request.tools?.length ?? 0,
      toolChoice: first.request.toolChoice,
      requiresToolCalling: first.request.routing?.requiresToolCalling === true,
      partKeys: r1.response?.rawMetadata?.geminiPartKeys,
      finishRaw: r1.response?.rawMetadata?.geminiFinishReason,
      openAiFinish: r1.response
        ? mapRuntimeResponseToOpenAiCompat(r1.response, first.alias).choices[0]?.finish_reason
        : null,
    }),
  );

  if (!toolCalls.length || !r1.response) {
    console.log(JSON.stringify({ step: "loop", status: "FAIL", reason: "no_tool_calls" }));
    process.exitCode = 1;
    return;
  }

  // Hermes executes tool (simulated) — Runtime must NOT execute
  const toolResultContent = JSON.stringify({ codeword: "SPIKE_TOOL_OK", source: "hermes-simulated" });
  const second = createRuntimeRequest({
    agentId: "runtime-spike",
    source: "system",
    workload: "manager_decision",
    priority: "high",
    tools: first.request.tools,
    toolChoice: "auto",
    messages: [
      ...first.request.messages,
      {
        role: "assistant",
        content: "",
        // Hermes OpenAI wire drops providerData; Runtime Gemini bridge must recall by id.
        toolCalls: toolCalls.map((call) => ({
          id: call.id,
          type: call.type,
          function: { ...call.function },
        })),
      },
      {
        role: "tool",
        content: toolResultContent,
        toolCallId: toolCalls[0]!.id,
        name: toolCalls[0]!.function.name,
      },
    ],
    routing: { requiresToolCalling: true, allowFallback: true },
    correlationId: first.request.metadata?.correlationId,
  });

  const r2 = await executor.executeAndWait(second, { timeoutMs: 120_000 });
  const finalText = r2.response?.content ?? "";
  const loopOk =
    r1.status === "completed" &&
    toolCalls.length > 0 &&
    r2.status === "completed" &&
    !(r2.response?.toolCalls?.length) &&
    Boolean(finalText.trim()) &&
    /SPIKE_TOOL_OK/i.test(finalText);
  console.log(
    JSON.stringify({
      step: "request2",
      status: r2.status,
      errorCode: r2.error?.code,
      providerId: r2.response?.providerId,
      finishReason: r2.response?.finishReason,
      toolCallCount: r2.response?.toolCalls?.length ?? 0,
      finalMentionsCodeword: /SPIKE_TOOL_OK/i.test(finalText),
      hasContent: Boolean(finalText.trim()),
      contentLen: finalText.length,
      geminiPartKeys: r2.response?.rawMetadata?.geminiPartKeys,
      geminiFinishReason: r2.response?.rawMetadata?.geminiFinishReason,
      geminiPartCount: r2.response?.rawMetadata?.geminiPartCount,
      usageOut: r2.response?.usage?.outputTokens,
      runtimeExecutedTools: false,
      loopStatus: loopOk ? "PASS" : "FAIL",
    }),
  );
  if (!loopOk) process.exitCode = 1;
}

main().catch((error) => {
  console.log(JSON.stringify({ status: "FAIL", error: String(error).slice(0, 200) }));
  process.exit(1);
});
