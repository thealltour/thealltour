import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";

import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import type { HermesMarketingProfileId } from "@/lib/marketing/bot/organization/envelope";
import { buildHermesOneshotArgv } from "@/lib/marketing/bot/organization/hermesHandoff";
import { assertAllowlistedHermesProfile } from "@/lib/marketing/bot/organization/registry";
import { stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";

export const DEFAULT_HERMES_INVOKE_TIMEOUT_MS = 90_000;
export const MAX_SPECIALIST_DISPATCHES_PER_REQUEST = 4;
export const MAX_ORCHESTRATION_DEPTH = 1;

export type HermesAgentRuntimeInvokeInput = {
  profile: string;
  prompt: string;
  timeoutMs?: number;
};

export type HermesAgentRuntimeResult = {
  executionId: string;
  profile: HermesMarketingProfileId;
  actuallyInvoked: boolean;
  exitCode: number | null;
  timedOut: boolean;
  stdout: string;
  stderr: string;
  promptSha256: string;
  argv: string[];
  startedAt: string;
  endedAt: string;
  error?: string;
};

export type HermesAgentRuntime = {
  invoke: (input: HermesAgentRuntimeInvokeInput) => Promise<HermesAgentRuntimeResult>;
};

function promptSha(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 16);
}

export function createFailedInvokeResult(
  profile: HermesMarketingProfileId,
  prompt: string,
  message: string,
): HermesAgentRuntimeResult {
  const now = new Date().toISOString();
  return {
    executionId: randomUUID(),
    profile,
    actuallyInvoked: false,
    exitCode: null,
    timedOut: false,
    stdout: "",
    stderr: "",
    promptSha256: promptSha(prompt),
    argv: [],
    startedAt: now,
    endedAt: now,
    error: message,
  };
}

export function invokeHermesOneshot(input: HermesAgentRuntimeInvokeInput): Promise<HermesAgentRuntimeResult> {
  const profile = assertAllowlistedHermesProfile(input.profile);
  const timeoutMs = input.timeoutMs ?? DEFAULT_HERMES_INVOKE_TIMEOUT_MS;
  const argv = buildHermesOneshotArgv(profile, input.prompt);
  const command = process.env.HERMES_BIN?.trim() || "hermes";
  const args = argv.slice(1);
  const startedAt = new Date().toISOString();
  const executionId = randomUUID();

  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const child = spawn(command, args, {
      shell: false,
      env: {
        ...process.env,
        HERMES_HOME: process.env.HERMES_HOME ?? "/home/ysh/.hermes",
      },
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve(
        stripForbiddenBotData({
          executionId,
          profile,
          actuallyInvoked: false,
          exitCode: null,
          timedOut,
          stdout: "",
          stderr: "",
          promptSha256: promptSha(input.prompt),
          argv: [command, "-p", profile, "--yolo", "--ignore-rules", "-z"],
          startedAt,
          endedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : "spawn_failed",
        }),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const exitCode = code ?? null;
      resolve(
        stripForbiddenBotData({
          executionId,
          profile,
          actuallyInvoked: true,
          exitCode,
          timedOut,
          stdout: stdout.slice(0, 8000),
          stderr: stderr.slice(0, 2000),
          promptSha256: promptSha(input.prompt),
          argv: [command, "-p", profile, "--yolo", "--ignore-rules", "-z"],
          startedAt,
          endedAt: new Date().toISOString(),
          error:
            timedOut || exitCode !== 0
              ? timedOut
                ? "timeout"
                : `exit_${exitCode}`
              : undefined,
        }),
      );
    });
  });
}

export const defaultHermesAgentRuntime: HermesAgentRuntime = {
  invoke: invokeHermesOneshot,
};

export function assertDispatchBudget(already: number, adding = 1): void {
  if (already + adding > MAX_SPECIALIST_DISPATCHES_PER_REQUEST) {
    throw new MarketingBotValidationError(
      `Specialist dispatch budget exceeded (max ${MAX_SPECIALIST_DISPATCHES_PER_REQUEST})`,
    );
  }
}
