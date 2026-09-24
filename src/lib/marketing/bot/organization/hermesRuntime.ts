/**
 * Soft-result bot adapter over the unified Marketing Hermes launcher.
 * Preserves HermesAgentRuntimeResult semantics (never throws to orchestrate callers).
 */

import { createHash, randomUUID } from "node:crypto";

import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import type { HermesMarketingProfileId } from "@/lib/marketing/bot/organization/envelope";
import { assertAllowlistedHermesProfile } from "@/lib/marketing/bot/organization/registry";
import { stripForbiddenBotData } from "@/lib/marketing/bot/sanitize";
import { resolveHermesExecutable } from "@/lib/marketing/cron/resolveHermesExecutable";
import {
  buildHermesProfileArgv,
  invokeMarketingHermesAgent,
} from "@/lib/marketing/hermesRuntime/launcher";
import { getMarketingHermesRuntimeContract } from "@/lib/marketing/hermesRuntime/registry";
import { spawnMarketingHermesProfileOnce } from "@/lib/marketing/hermesRuntime/launcher";

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

function classifyLauncherFailure(message: string): {
  timedOut: boolean;
  exitCode: number | null;
  error: string;
} {
  if (/timed out after \d+ms/i.test(message)) {
    return { timedOut: true, exitCode: null, error: "timeout" };
  }
  const exitMatch = /exited (\d+)/i.exec(message);
  if (exitMatch) {
    return { timedOut: false, exitCode: Number(exitMatch[1]), error: `exit_${exitMatch[1]}` };
  }
  if (/spawn failed/i.test(message)) {
    return { timedOut: false, exitCode: null, error: "spawn_failed" };
  }
  return { timedOut: false, exitCode: null, error: message.slice(0, 200) || "invoke_failed" };
}

/**
 * Soft-result oneshot: registry profiles use unified launcher; unregistered
 * allowlisted profiles fall back to token-aware oneshot spawn.
 *
 * Allowlist failures throw synchronously (orchestration contract).
 * Hermes transport/model failures become soft Result fields (never throw).
 */
export function invokeHermesOneshot(
  input: HermesAgentRuntimeInvokeInput,
): Promise<HermesAgentRuntimeResult> {
  const profile = assertAllowlistedHermesProfile(input.profile);
  const timeoutMs = input.timeoutMs ?? DEFAULT_HERMES_INVOKE_TIMEOUT_MS;
  return invokeHermesOneshotSoft(profile, input.prompt, timeoutMs);
}

async function invokeHermesOneshotSoft(
  profile: HermesMarketingProfileId,
  prompt: string,
  timeoutMs: number,
): Promise<HermesAgentRuntimeResult> {
  const command = resolveHermesExecutable(process.env);
  const argvDisplay = [command, ...buildHermesProfileArgv(profile, prompt).slice(0, 4)];
  const startedAt = new Date().toISOString();
  const executionId = randomUUID();

  try {
    const stdout = getMarketingHermesRuntimeContract(profile)
      ? await invokeMarketingHermesAgent({
          profileId: profile,
          prompt,
          timeoutMs,
          withTransportRetry: false,
        })
      : await spawnMarketingHermesProfileOnce({
          hermesBin: command,
          profileId: profile,
          prompt,
          timeoutMs,
        });

    return stripForbiddenBotData({
      executionId,
      profile,
      actuallyInvoked: true,
      exitCode: 0,
      timedOut: false,
      stdout: stdout.slice(0, 8000),
      stderr: "",
      promptSha256: promptSha(prompt),
      argv: argvDisplay,
      startedAt,
      endedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const classified = classifyLauncherFailure(message);
    return stripForbiddenBotData({
      executionId,
      profile,
      actuallyInvoked: true,
      exitCode: classified.exitCode,
      timedOut: classified.timedOut,
      stdout: "",
      stderr: message.slice(0, 2000),
      promptSha256: promptSha(prompt),
      argv: argvDisplay,
      startedAt,
      endedAt: new Date().toISOString(),
      error: classified.error,
    });
  }
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
