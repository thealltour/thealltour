import type { ShortformVideoRenderJob } from "@/lib/marketing/assets/shortform/renderJob/contracts";
import type { ShortformJobWorkspace } from "@/lib/marketing/assets/shortform/worker/workspace";

export type ShortformRenderExecutionResult =
  | {
      ok: true;
      outputArtifactPath: string;
    }
  | {
      ok: false;
      errorCode: string;
      error: unknown;
    };

export type ShortformVideoRenderExecutor = {
  readonly kind: "disabled" | "fake" | "production";
  /** When false, worker must NOT claim live jobs. */
  isReady(): boolean;
  readinessReason(): string;
  execute(input: {
    job: ShortformVideoRenderJob;
    workspace: ShortformJobWorkspace;
    signal: AbortSignal;
  }): Promise<ShortformRenderExecutionResult>;
};

export class DisabledShortformVideoRenderExecutor implements ShortformVideoRenderExecutor {
  readonly kind = "disabled" as const;

  isReady(): boolean {
    return false;
  }

  readinessReason(): string {
    return "executor_disabled";
  }

  async execute(): Promise<ShortformRenderExecutionResult> {
    return {
      ok: false,
      errorCode: "EXECUTOR_DISABLED",
      error: new Error("executor_disabled"),
    };
  }
}

/**
 * SV-7/8 sync default for CLI without catalog wiring.
 * Prefer ProductionShortformVideoRenderExecutor from production/ when claiming.
 * Unready keeps fail-closed if ffmpeg/env incomplete and caller uses this default.
 */
export class UnreadyProductionShortformVideoRenderExecutor
  implements ShortformVideoRenderExecutor
{
  readonly kind = "production" as const;

  isReady(): boolean {
    return false;
  }

  readinessReason(): string {
    return "production_executor_not_wired_or_not_ready";
  }

  async execute(): Promise<ShortformRenderExecutionResult> {
    return {
      ok: false,
      errorCode: "EXECUTOR_NOT_READY",
      error: new Error("production_executor_not_wired_or_not_ready"),
    };
  }
}

export function createDefaultShortformVideoRenderExecutor(input: {
  executionMode: "disabled" | "dry_run" | "production";
}): ShortformVideoRenderExecutor {
  if (input.executionMode === "production") {
    return new UnreadyProductionShortformVideoRenderExecutor();
  }
  return new DisabledShortformVideoRenderExecutor();
}
