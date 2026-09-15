import type { AgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { validateAngleAgainstAgendaIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/validateAgainstIdentity";
import type { StoryContentPoint } from "@/lib/marketing/storyPoint/contracts";

function candidateIdentityBlob(point: StoryContentPoint): string {
  return [
    point.storyQuestion,
    point.storyClaim,
    point.whyInteresting,
    point.audienceTension,
    point.curiosityGap,
    point.readerPayoff,
    ...point.researchNeeded,
    ...point.researchQuestions,
    point.agendaFitNotes ?? "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Topic identity lock — Story Miner may reframe, but must not drift destination /
 * product / travel mode / commercial subject.
 */
export function storyPointRespectsTopicIdentity(
  point: StoryContentPoint,
  identity: AgendaTopicIdentity,
): { ok: boolean; reasons: string[] } {
  const blob = candidateIdentityBlob(point);
  const result = validateAngleAgainstAgendaIdentity(blob, identity, {
    stage: "story_miner",
  });
  if (result.ok) return { ok: true, reasons: [] };
  return {
    ok: false,
    reasons: result.issues.map((iss) => `${iss.dimension}:${iss.reason}`),
  };
}

export function filterCandidatesByTopicIdentity(input: {
  candidates: StoryContentPoint[];
  identity: AgendaTopicIdentity;
}): { kept: StoryContentPoint[]; rejected: Array<{ pointId: string; reasons: string[] }> } {
  const kept: StoryContentPoint[] = [];
  const rejected: Array<{ pointId: string; reasons: string[] }> = [];
  for (const candidate of input.candidates) {
    const check = storyPointRespectsTopicIdentity(candidate, input.identity);
    if (check.ok) kept.push(candidate);
    else rejected.push({ pointId: candidate.pointId, reasons: check.reasons });
  }
  return { kept, rejected };
}
