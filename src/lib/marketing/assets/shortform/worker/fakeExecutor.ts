/**
 * Test-only fake executor. Must not be selectable from production CLI config.
 */

import type {
  ShortformRenderExecutionResult,
  ShortformVideoRenderExecutor,
} from "@/lib/marketing/assets/shortform/worker/executor";

export type FakeShortformExecutorBehavior =
  | "success"
  | "failure"
  | "long_running"
  | "abort";

export class FakeShortformVideoRenderExecutor implements ShortformVideoRenderExecutor {
  readonly kind = "fake" as const;
  readonly behavior: FakeShortformExecutorBehavior;
  private readonly delayMs: number;

  constructor(input?: {
    behavior?: FakeShortformExecutorBehavior;
    delayMs?: number;
  }) {
    this.behavior = input?.behavior ?? "success";
    this.delayMs = input?.delayMs ?? 10;
  }

  isReady(): boolean {
    return true;
  }

  readinessReason(): string {
    return `fake:${this.behavior}`;
  }

  async execute(input: {
    signal: AbortSignal;
  }): Promise<ShortformRenderExecutionResult> {
    try {
      if (this.behavior === "abort" || this.behavior === "long_running") {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(
            () => resolve(),
            this.behavior === "abort" ? 60_000 : this.delayMs,
          );
          const onAbort = () => {
            clearTimeout(timer);
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          };
          if (input.signal.aborted) {
            onAbort();
            return;
          }
          input.signal.addEventListener("abort", onAbort, { once: true });
        });
      } else if (this.delayMs > 0) {
        await new Promise((r) => setTimeout(r, this.delayMs));
      }
    } catch (error) {
      return {
        ok: false,
        errorCode: "ABORTED",
        error,
      };
    }

    if (input.signal.aborted) {
      return { ok: false, errorCode: "ABORTED", error: new Error("aborted") };
    }
    if (this.behavior === "failure") {
      return {
        ok: false,
        errorCode: "FAKE_FAILURE",
        error: new Error("fake_executor_failure"),
      };
    }
    return {
      ok: true,
      outputArtifactPath: "final/shortform-fake.mp4",
    };
  }
}
