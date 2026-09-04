import { isAbsolute } from "node:path";

import { MarketingAssetExportError } from "@/lib/marketing/assets/errors";
import { createFfprobeDurationProbe } from "@/lib/marketing/tts/duration/ffprobe";
import { resolveTtsProfile } from "@/lib/marketing/tts/profiles";
import { createVoiceStudioTtsProvider } from "@/lib/marketing/tts/voiceStudio/adapter";
import {
  generateNarrationMasterTimeline,
  type NarrationSegmentInput,
} from "@/lib/marketing/tts/timeline/orchestrate";

export const TTS_A6_VERIFICATION_CANDIDATE_ID = "dev-tts-a6-verification" as const;

export type GenerateNarrationTimelineCliOptions = {
  packageRoot?: string;
  profileId: string;
  candidateId: string;
  dryRun: boolean;
  fixture: boolean;
  confirmDev: boolean;
};

export function createA6VerificationSegments(): NarrationSegmentInput[] {
  return [
    { segmentId: "hook", narrationText: "다낭 효도여행은 일정이 여유롭습니다." },
    { segmentId: "close", narrationText: "출발 전에 공식 안내를 다시 확인하세요." },
  ];
}

export function parseGenerateNarrationTimelineArgs(argv: string[]): GenerateNarrationTimelineCliOptions {
  let packageRoot: string | undefined;
  let profileId = "standard-ko-development";
  let candidateId: string = TTS_A6_VERIFICATION_CANDIDATE_ID;
  let dryRun = false;
  let fixture = false;
  let confirmDev = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--fixture") {
      fixture = true;
      continue;
    }
    if (arg === "--confirm-dev") {
      confirmDev = true;
      continue;
    }
    if (arg === "--package-root" || arg.startsWith("--package-root=")) {
      packageRoot = arg === "--package-root" ? argv[index + 1] : arg.slice("--package-root=".length);
      if (arg === "--package-root") index += 1;
      continue;
    }
    if (arg === "--profile" || arg.startsWith("--profile=")) {
      profileId = arg === "--profile" ? argv[index + 1] : arg.slice("--profile=".length);
      if (arg === "--profile") index += 1;
      continue;
    }
    if (arg === "--candidateId" || arg.startsWith("--candidateId=")) {
      candidateId = arg === "--candidateId" ? argv[index + 1] : arg.slice("--candidateId=".length);
      if (arg === "--candidateId") index += 1;
      continue;
    }
    throw new MarketingAssetExportError(`Unknown argument: ${arg}`);
  }

  return {
    packageRoot: packageRoot?.trim() || undefined,
    profileId: profileId.trim(),
    candidateId: candidateId.trim(),
    dryRun,
    fixture,
    confirmDev,
  };
}

export async function runGenerateNarrationTimelineCommand(input: {
  options: GenerateNarrationTimelineCliOptions;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetch?: typeof fetch;
  segments?: NarrationSegmentInput[];
}): Promise<Record<string, unknown>> {
  const profile = resolveTtsProfile(input.options.profileId);
  const segments = input.segments ?? (input.options.fixture ? createA6VerificationSegments() : null);
  if (!segments) {
    throw new MarketingAssetExportError("Missing required --fixture (MediaBrief package load is not in A-6)");
  }

  const plan = {
    dryRun: input.options.dryRun,
    network: false,
    filesystem: false,
    profile: {
      profileId: profile.profileId,
      provider: profile.provider,
      kind: profile.kind,
      language: profile.language,
      locale: profile.locale,
      voiceRef: profile.voiceRef,
      modelRef: profile.modelRef,
    },
    candidateId: input.options.candidateId,
    segments: segments.map((segment, index) => ({
      ordinal: index + 1,
      segmentId: segment.segmentId,
      text: segment.narrationText,
    })),
    authoritativeClock: "persisted_wav_ffprobe",
    pauseMs: 250,
    trailingPauseMs: 0,
  };

  if (input.options.dryRun) {
    return plan;
  }
  if (!input.options.confirmDev) {
    throw new MarketingAssetExportError("Refusing live narration generation without --confirm-dev");
  }
  if (!input.options.packageRoot || !isAbsolute(input.options.packageRoot)) {
    throw new MarketingAssetExportError("--package-root must be an absolute development path");
  }

  const provider = createVoiceStudioTtsProvider(input.env ?? process.env, {
    fetch: input.fetch,
    retryDelayMs: 0,
  });
  const result = await generateNarrationMasterTimeline({
    packageRoot: input.options.packageRoot,
    candidateId: input.options.candidateId,
    segments,
    profile,
    provider,
    durationProbe: createFfprobeDurationProbe(),
  });

  return {
    ...plan,
    network: true,
    filesystem: true,
    status: result.status,
    timelineWritten: result.status === "completed",
    timelineRelativePath: result.timelineRelativePath,
    segments: result.segments,
    failed: result.status === "partial_failure" ? result.failed : null,
    remaining: result.status === "partial_failure" ? result.remaining : [],
    totalDurationMs: result.status === "completed" ? result.timeline.totalDurationMs : null,
    authoritativeClock: result.status === "completed" ? result.timeline.authoritativeClock : plan.authoritativeClock,
  };
}
