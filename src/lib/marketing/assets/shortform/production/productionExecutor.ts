import "server-only";

import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import type { ShortformVideoRenderJob } from "@/lib/marketing/assets/shortform/renderJob/contracts";
import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import {
  probeShortformProductionReadiness,
  type ShortformProductionReadiness,
} from "@/lib/marketing/assets/shortform/production/readiness";
import {
  runShortformProductionPipeline,
  type ShortformProductionPipelineDeps,
} from "@/lib/marketing/assets/shortform/production/pipeline";
import type {
  ShortformRenderExecutionResult,
  ShortformVideoRenderExecutor,
} from "@/lib/marketing/assets/shortform/worker/executor";
import type { ShortformJobWorkspace } from "@/lib/marketing/assets/shortform/worker/workspace";
import type { TtsProvider } from "@/lib/marketing/tts/provider";
import type { ShortformRemotionRenderer } from "@/lib/marketing/assets/shortform/production/remotion/render";
import {
  FakeShortformRemotionRenderer,
  ProductionShortformRemotionRenderer,
} from "@/lib/marketing/assets/shortform/production/remotion/render";
import { createFakeShortformTtsProvider } from "@/lib/marketing/assets/shortform/production/narration";
import { createVoiceStudioTtsProvider } from "@/lib/marketing/tts/voiceStudio/adapter";
import { resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";

export type ProductionShortformVideoRenderExecutorOptions = {
  catalog: MarketingMediaSourceCatalogRepository;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  tts?: TtsProvider;
  remotion?: ShortformRemotionRenderer;
  pipelineOverrides?: Partial<ShortformProductionPipelineDeps>;
  /**
   * When true, readiness ignores missing ffmpeg (tests only).
   * Production CLI must leave this false.
   */
  relaxReadinessForTests?: boolean;
  readinessOverride?: ShortformProductionReadiness | null;
};

/**
 * SV-8A production executor. Fail-closed via isReady().
 * Does not auto-claim; worker still owns claim/markReady.
 */
export class ProductionShortformVideoRenderExecutor implements ShortformVideoRenderExecutor {
  readonly kind = "production" as const;
  readonly #catalog: MarketingMediaSourceCatalogRepository;
  readonly #env: NodeJS.ProcessEnv | Record<string, string | undefined>;
  readonly #tts: TtsProvider;
  readonly #remotion: ShortformRemotionRenderer;
  readonly #pipelineOverrides: Partial<ShortformProductionPipelineDeps>;
  readonly #relaxReadinessForTests: boolean;
  readonly #readinessOverride: ShortformProductionReadiness | null;

  constructor(options: ProductionShortformVideoRenderExecutorOptions) {
    this.#catalog = options.catalog;
    this.#env = options.env ?? process.env;
    this.#tts = options.tts ?? createVoiceStudioTtsProvider(this.#env);
    this.#remotion = options.remotion ?? new ProductionShortformRemotionRenderer();
    this.#pipelineOverrides = options.pipelineOverrides ?? {};
    this.#relaxReadinessForTests = Boolean(options.relaxReadinessForTests);
    this.#readinessOverride = options.readinessOverride ?? null;
  }

  probeReadiness(): ShortformProductionReadiness {
    if (this.#readinessOverride) return this.#readinessOverride;
    const probed = probeShortformProductionReadiness({
      env: this.#env,
      requireVoiceStudio: !this.#relaxReadinessForTests,
    });
    if (this.#relaxReadinessForTests) {
      return {
        ...probed,
        ready: true,
        reason: "test_relaxed_ready",
        checks: { ...probed.checks, ffmpeg: true, ffprobe: true, voiceStudioConfig: true },
      };
    }
    return probed;
  }

  isReady(): boolean {
    return this.probeReadiness().ready;
  }

  readinessReason(): string {
    return this.probeReadiness().reason;
  }

  async execute(input: {
    job: ShortformVideoRenderJob;
    workspace: ShortformJobWorkspace;
    signal: AbortSignal;
  }): Promise<ShortformRenderExecutionResult> {
    if (!this.isReady()) {
      return {
        ok: false,
        errorCode: "EXECUTOR_NOT_READY",
        error: new Error(this.readinessReason()),
      };
    }

    try {
      const result = await runShortformProductionPipeline({
        job: input.job,
        workspace: input.workspace,
        signal: input.signal,
        deps: {
          catalog: this.#catalog,
          tts: this.#tts,
          remotion: this.#remotion,
          resolvePackageRoot: (job) => {
            const assetRoot = resolveMarketingAssetRoot({ env: this.#env });
            return resolvePackageDirectory({
              assetRoot,
              businessDateKst: job.businessDateKst,
              candidateId: job.candidateId,
            });
          },
          skipFfprobeValidation: this.#relaxReadinessForTests,
          ...this.#pipelineOverrides,
        },
      });
      return {
        ok: true,
        outputArtifactPath: result.outputArtifactPath,
      };
    } catch (error) {
      if (error instanceof ShortformProductionError) {
        return { ok: false, errorCode: error.code, error };
      }
      return {
        ok: false,
        errorCode: "PRODUCTION_EXECUTOR_FAILED",
        error,
      };
    }
  }
}

/** Test helper wiring fake TTS/Remotion with relaxed readiness. */
export function createTestProductionShortformVideoRenderExecutor(input: {
  catalog: MarketingMediaSourceCatalogRepository;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  pipelineOverrides?: Partial<ShortformProductionPipelineDeps>;
}): ProductionShortformVideoRenderExecutor {
  return new ProductionShortformVideoRenderExecutor({
    catalog: input.catalog,
    env: input.env,
    tts: createFakeShortformTtsProvider(),
    remotion: new FakeShortformRemotionRenderer(),
    relaxReadinessForTests: true,
    pipelineOverrides: input.pipelineOverrides,
  });
}
