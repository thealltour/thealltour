import { mkdirSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { MarketingAssetExportError } from "@/lib/marketing/assets/errors";
import { persistTtsGeneration } from "@/lib/marketing/tts/persist";
import { buildTtsGenerationRequest } from "@/lib/marketing/tts/provider";
import { resolveTtsProfile } from "@/lib/marketing/tts/profiles";
import { mapVoiceStudioSpeechBody } from "@/lib/marketing/tts/voiceStudio/mapRequest";
import { createVoiceStudioTtsProvider } from "@/lib/marketing/tts/voiceStudio/adapter";

export type TestMarketingTtsCliOptions = {
  profileId: string;
  text: string;
  output?: string;
  dryRun: boolean;
  segmentId: string | null;
};

export function parseTestMarketingTtsArgs(argv: string[]): TestMarketingTtsCliOptions {
  let profileId: string | undefined;
  let text: string | undefined;
  let output: string | undefined;
  let dryRun = false;
  let segmentId: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--profile" || arg.startsWith("--profile=")) {
      profileId = arg === "--profile" ? argv[index + 1] : arg.slice("--profile=".length);
      if (arg === "--profile") index += 1;
      continue;
    }
    if (arg === "--text" || arg.startsWith("--text=")) {
      text = arg === "--text" ? argv[index + 1] : arg.slice("--text=".length);
      if (arg === "--text") index += 1;
      continue;
    }
    if (arg === "--output" || arg.startsWith("--output=")) {
      output = arg === "--output" ? argv[index + 1] : arg.slice("--output=".length);
      if (arg === "--output") index += 1;
      continue;
    }
    if (arg === "--segment-id" || arg.startsWith("--segment-id=")) {
      segmentId = arg === "--segment-id" ? argv[index + 1] : arg.slice("--segment-id=".length);
      if (arg === "--segment-id") index += 1;
      continue;
    }
    throw new MarketingAssetExportError(`Unknown argument: ${arg}`);
  }

  if (!profileId?.trim()) {
    throw new MarketingAssetExportError("Missing required --profile");
  }
  if (text == null) {
    throw new MarketingAssetExportError("Missing required --text");
  }

  return {
    profileId: profileId.trim(),
    text,
    output: output?.trim() || undefined,
    dryRun,
    segmentId: segmentId?.trim() || null,
  };
}

export async function runTestMarketingTtsCommand(input: {
  options: TestMarketingTtsCliOptions;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  now?: Date;
  fetch?: typeof fetch;
}): Promise<Record<string, unknown>> {
  const profile = resolveTtsProfile(input.options.profileId);
  const request = buildTtsGenerationRequest({
    requestId: "tts_dev_probe",
    profile,
    text: input.options.text,
    segmentId: input.options.segmentId,
  });
  const providerBody = mapVoiceStudioSpeechBody({ profile, request });

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
      enabled: profile.enabled,
      voiceRef: profile.voiceRef,
      modelRef: profile.modelRef,
    },
    request,
    providerBody,
  };

  if (input.options.dryRun) {
    return plan;
  }

  if (!input.options.output) {
    throw new MarketingAssetExportError("Missing required --output for non-dry-run TTS probe");
  }
  if (!isAbsolute(input.options.output)) {
    throw new MarketingAssetExportError("--output must be an absolute development path");
  }

  const provider = createVoiceStudioTtsProvider(input.env ?? process.env, {
    fetch: input.fetch,
    retryDelayMs: 0,
  });
  const result = await provider.generate({
    requestId: request.requestId,
    profile,
    text: input.options.text,
    segmentId: input.options.segmentId,
  });

  const packageRoot = resolve(input.options.output);
  mkdirSync(packageRoot, { recursive: true });
  const persisted = persistTtsGeneration({
    packageRoot,
    result,
    createdAt: (input.now ?? new Date()).toISOString(),
  });

  return {
    ...plan,
    network: true,
    filesystem: true,
    result: {
      profileId: result.profileId,
      provider: result.provider,
      sha256: result.sha256,
      byteSize: result.byteSize,
      format: result.format,
      timelineAuthoritative: result.timelineAuthoritative,
      generatedAt: result.generatedAt,
    },
    audioRelativePath: persisted.audio.artifact.relativePath,
    metadataRelativePath: persisted.metadata.artifact.relativePath,
    audioStatus: persisted.audio.status,
    metadataStatus: persisted.metadata.status,
  };
}
