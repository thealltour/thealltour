import type { ShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import {
  SHORTFORM_SOURCE_RESOLUTION_CONTRACT,
  type ShortformSourceResolutionPlan,
} from "@/lib/marketing/assets/shortform/resolver/contracts";
import type { ShortformSourceProvider } from "@/lib/marketing/assets/shortform/resolver/provider";
import { resolveSceneSources } from "@/lib/marketing/assets/shortform/resolver/resolveScene";

export type ResolveShortVideoSourcesInput = {
  brief: ShortVideoBrief;
  providers: {
    internal: ShortformSourceProvider;
    pexels?: ShortformSourceProvider | null;
    pixabay?: ShortformSourceProvider | null;
  };
  shortCircuitOnInternalAutoPick?: boolean;
  now?: Date;
};

/**
 * Resolve all scenes in a ShortVideoBrief.
 * Pure orchestration over injected providers — no catalog insert, no PICK, no download.
 */
export async function resolveShortVideoSources(
  input: ResolveShortVideoSourcesInput,
): Promise<ShortformSourceResolutionPlan> {
  const scenes = [];
  for (const scene of input.brief.scenes) {
    scenes.push(
      await resolveSceneSources({
        scene,
        providers: input.providers,
        shortCircuitOnInternalAutoPick: input.shortCircuitOnInternalAutoPick,
      }),
    );
  }

  return {
    contract: SHORTFORM_SOURCE_RESOLUTION_CONTRACT,
    candidateId: input.brief.candidateId,
    businessDateKst: input.brief.businessDateKst,
    scenes,
    createdAt: (input.now ?? new Date()).toISOString(),
  };
}
