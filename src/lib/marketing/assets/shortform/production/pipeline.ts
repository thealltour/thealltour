import "server-only";

import { mkdirSync } from "node:fs";

import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import type { ShortformVideoRenderJob } from "@/lib/marketing/assets/shortform/renderJob/contracts";
import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import {
  createShortformSourceMaterializerRouter,
  type MaterializedSceneSource,
  type ShortformSourceMaterializer,
} from "@/lib/marketing/assets/shortform/production/materialize";
import {
  prepareShortformNarration,
  type PreparedNarration,
} from "@/lib/marketing/assets/shortform/production/narration";
import {
  resolveShortformNarrationPlanViaTransport,
  type ResolvedShortformNarrationPlan,
} from "@/lib/marketing/assets/shortform/production/resolveNarration";
import {
  defaultRemotionOutputPath,
  type ShortformRemotionRenderer,
} from "@/lib/marketing/assets/shortform/production/remotion/render";
import {
  finalizeShortformVideo,
  validateFinalShortformMp4,
  workspaceFinalizedMp4Path,
} from "@/lib/marketing/assets/shortform/production/finalize";
import { SHORTFORM_OUTPUT_PROFILE_V1 } from "@/lib/marketing/assets/shortform/production/paths";
import { TRAVEL_SHORT_INFO_V1_ID } from "@/lib/marketing/assets/shortform/production/remotion/TravelShortInfoV1";
import type { ShortformJobWorkspace } from "@/lib/marketing/assets/shortform/worker/workspace";
import type { TtsProvider } from "@/lib/marketing/tts/provider";
import { runFfmpeg } from "@/lib/marketing/assets/ffmpeg/exec";
import { runFfprobeJson } from "@/lib/marketing/assets/ffprobe/exec";
import type { MarketingAssetTransport } from "@/lib/marketing/assets/transport/contracts";
import { MarketingAssetTransportError } from "@/lib/marketing/assets/transport/errors";

export type ShortformProductionPipelineDeps = {
  catalog: MarketingMediaSourceCatalogRepository;
  transport: MarketingAssetTransport;
  materializer?: ShortformSourceMaterializer;
  tts: TtsProvider;
  remotion: ShortformRemotionRenderer;
  /**
   * Optional override for tests. Production resolves MediaBrief narration via transport.
   * Returning a plan with placeholder/dummy text is forbidden in production path.
   */
  resolveNarrationPlan?: (input: {
    job: ShortformVideoRenderJob;
  }) => ResolvedShortformNarrationPlan | Promise<ResolvedShortformNarrationPlan>;
  runFfmpegImpl?: typeof runFfmpeg;
  runFfprobeImpl?: typeof runFfprobeJson;
  skipFfprobeValidation?: boolean;
};

export type ShortformProductionPipelineResult = {
  outputArtifactPath: string;
  materialized: MaterializedSceneSource[];
  narration: PreparedNarration | null;
};

function msToFrames(ms: number, fps = SHORTFORM_OUTPUT_PROFILE_V1.fps): number {
  return Math.max(1, Math.round((ms / 1000) * fps));
}

/**
 * Staged production pipeline (no OBS spans in SV-8A).
 * Candidate briefs, internal sources, and final persist go through MarketingAssetTransport.
 */
export async function runShortformProductionPipeline(input: {
  job: ShortformVideoRenderJob;
  workspace: ShortformJobWorkspace;
  signal: AbortSignal;
  deps: ShortformProductionPipelineDeps;
}): Promise<ShortformProductionPipelineResult> {
  const { job, workspace, signal, deps } = input;
  mkdirSync(workspace.sourceDir, { recursive: true });
  mkdirSync(workspace.audioDir, { recursive: true });
  mkdirSync(workspace.renderDir, { recursive: true });
  mkdirSync(workspace.outputDir, { recursive: true });

  const materializer =
    deps.materializer ??
    createShortformSourceMaterializerRouter({ transport: deps.transport });
  const materialized: MaterializedSceneSource[] = [];
  for (const pick of job.inputSnapshot.scenePicks) {
    if (signal.aborted) {
      throw new ShortformProductionError("aborted", "PIPELINE_ABORTED");
    }
    if (pick.origin === "generated_video_plan") {
      throw new ShortformProductionError(
        "generated_video_plan not renderable yet",
        "JOB_NOT_RENDERABLE_YET",
      );
    }
    const source = await deps.catalog.getById(pick.sourceId);
    if (!source) {
      throw new ShortformProductionError(`source not found: ${pick.sourceId}`, "SOURCE_NOT_FOUND");
    }
    if (source.rightsKind === "unknown") {
      throw new ShortformProductionError("unknown rights", "UNKNOWN_RIGHTS");
    }
    materialized.push(
      await materializer.materialize({
        sceneId: pick.sceneId,
        source,
        origin: pick.origin,
        workspace,
        signal,
      }),
    );
  }

  // Narration: transport-aware MediaBrief / ShortVideoBrief (no Mini-PC MARKETING_ASSET_ROOT).
  const narrationPlan =
    (await deps.resolveNarrationPlan?.({ job })) ??
    (await resolveShortformNarrationPlanViaTransport({
      transport: deps.transport,
      job,
      signal,
    }));

  const narration = await prepareShortformNarration({
    workspace,
    tts: deps.tts,
    segments: narrationPlan.segments,
    subtitlesBySceneId: narrationPlan.subtitlesBySceneId,
    cta: narrationPlan.cta,
    requestIdPrefix: job.jobId,
    signal,
  });

  const sceneDurationMs = Math.max(
    3000,
    Math.floor(18_000 / Math.max(1, materialized.length)),
  );
  const compositionProps = {
    scenes: materialized.map((m) => {
      const lines = narration.subtitlesBySceneId[m.sceneId] ?? [];
      return {
        sceneId: m.sceneId,
        durationFrames: msToFrames(sceneDurationMs),
        mediaKind: m.mediaKind,
        mediaSrc: m.absolutePath,
        subtitle: lines.length > 0 ? lines.join(" ") : null,
      };
    }),
    cta: narration.cta,
  };
  const remotionOut = defaultRemotionOutputPath(workspace.renderDir);
  await deps.remotion.render({
    compositionId: TRAVEL_SHORT_INFO_V1_ID,
    props: compositionProps,
    outputAbsolutePath: remotionOut,
    signal,
  });

  const workspaceFinal = workspaceFinalizedMp4Path(workspace.outputDir);
  await finalizeShortformVideo({
    remotionOutputAbsolutePath: remotionOut,
    narrationWavAbsolutePath: narration.absoluteWavPath,
    outputAbsolutePath: workspaceFinal,
    expectAudio: narration.segments.length > 0,
    runFfmpegImpl: deps.runFfmpegImpl,
    runFfprobeImpl: deps.runFfprobeImpl,
    signal,
  });

  if (!deps.skipFfprobeValidation) {
    await validateFinalShortformMp4({
      absolutePath: workspaceFinal,
      expectAudio: narration.segments.length > 0,
      runFfprobeImpl: deps.runFfprobeImpl,
    });
  }

  try {
    const persisted = await deps.transport.persistShortformFinal({
      candidateId: job.candidateId,
      businessDateKst: job.businessDateKst,
      workspaceFinalAbsolutePath: workspaceFinal,
      signal,
    });
    return {
      outputArtifactPath: persisted.relativePath,
      materialized,
      narration,
    };
  } catch (error) {
    if (error instanceof MarketingAssetTransportError) {
      throw new ShortformProductionError(error.message, error.code);
    }
    if (error instanceof ShortformProductionError) throw error;
    throw error;
  }
}
