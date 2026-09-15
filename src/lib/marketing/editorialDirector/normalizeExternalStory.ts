/**
 * Normalize external Editorial Director stories → StoryContentPoint + gate.
 */

import { createHash } from "node:crypto";

import type { AgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import type { ExternalStoryCandidate } from "@/lib/marketing/editorialDirector/contracts";
import {
  STORY_CONTENT_POINT_CONTRACT,
  STORY_MECHANISMS,
  type ChannelPotentialLevel,
  type ChannelPotentialProfile,
  type StoryContentPoint,
  type StoryMechanism,
  type StoryPointGateResult,
} from "@/lib/marketing/storyPoint/contracts";
import { evaluateStoryPointQuality } from "@/lib/marketing/storyPoint/evaluateStoryPointQuality";
import { storyPointRespectsTopicIdentity } from "@/lib/marketing/storyPoint/identityGuard";

function mechanismsFromArchetype(archetype: string | null): StoryMechanism[] {
  const a = (archetype ?? "").toLowerCase();
  const out: StoryMechanism[] = [];
  if (/myth|expectation|counter|hidden/.test(a)) out.push("counter_intuition");
  if (/worth|decision|before_you|tradeoff|rule/.test(a)) out.push("decision_relief");
  if (/who_is|family|parent|couple|identity/.test(a)) out.push("identity_signal");
  if (/cost|avoid|mistake|overpriced/.test(a)) out.push("loss_avoidance");
  if (/curiosity|gap|alternative/.test(a)) out.push("curiosity_gap");
  if (out.length === 0) out.push("curiosity_gap", "decision_relief");
  return [...new Set(out)].filter((m) =>
    (STORY_MECHANISMS as readonly string[]).includes(m),
  ) as StoryMechanism[];
}

export function stableExternalStoryPointId(input: {
  agendaId: string;
  externalStoryId: string;
}): string {
  const seed = `${input.agendaId.trim()}|${input.externalStoryId.trim()}`;
  return `sp_ext_${createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 20)}`;
}

export function channelPotentialFromRecommended(
  candidate: ExternalStoryCandidate,
): ChannelPotentialProfile {
  const set = new Set(candidate.recommendedChannels);
  const level = (ch: string): ChannelPotentialLevel => (set.has(ch as never) ? "high" : "medium");
  return {
    conversation: level("threads"),
    visualExplainability: level("shortform"),
    searchDepth: level("naver_blog"),
    shortformHookability: level("shortform"),
  };
}

export function normalizeExternalStoryToPoint(
  candidate: ExternalStoryCandidate,
  agendaId: string,
): StoryContentPoint {
  const whyExtra = [
    candidate.audienceProblemKo ? `문제: ${candidate.audienceProblemKo}` : null,
    candidate.decisionAtStakeKo ? `선택: ${candidate.decisionAtStakeKo}` : null,
    candidate.whyKoreanTravelerCaresKo
      ? `한국 여행자: ${candidate.whyKoreanTravelerCaresKo}`
      : null,
    candidate.stakes.length ? `스테이크: ${candidate.stakes.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId: stableExternalStoryPointId({
      agendaId,
      externalStoryId: candidate.externalStoryId,
    }),
    storyQuestion: candidate.storyQuestionKo,
    storyClaim: candidate.storyClaimKo,
    whyInteresting: whyExtra
      ? `${candidate.whyInterestingKo} (${whyExtra})`
      : candidate.whyInterestingKo,
    audienceTension: candidate.audienceTensionKo,
    curiosityGap: candidate.curiosityGapKo,
    readerPayoff: candidate.readerPayoffKo,
    mechanisms: mechanismsFromArchetype(candidate.editorialArchetype),
    researchNeeded:
      candidate.researchNeededKo.length > 0
        ? candidate.researchNeededKo
        : candidate.researchQuestionsKo.slice(0, 3),
    researchQuestions: candidate.researchQuestionsKo,
    genericRisk: candidate.riskKo,
    genericRiskMitigation: candidate.channelReasonKo,
    channelPotential: channelPotentialFromRecommended(candidate),
    nonGoals: candidate.nonGoalsKo,
    agendaFitNotes: [
      candidate.storyTitleKo ? `title:${candidate.storyTitleKo}` : null,
      candidate.editorialArchetype ? `archetype:${candidate.editorialArchetype}` : null,
      "source:external_editorial_director",
    ]
      .filter(Boolean)
      .join(" | "),
  };
}

export type NormalizedExternalStory = {
  point: StoryContentPoint;
  gate: StoryPointGateResult;
  externalStoryId: string;
  identityOk: boolean;
  identityReasons: string[];
  accepted: boolean;
  rejectReasons: string[];
};

export function normalizeAndGateExternalStories(input: {
  stories: ExternalStoryCandidate[];
  agendaId: string;
  identity: AgendaTopicIdentity;
}): NormalizedExternalStory[] {
  return input.stories.map((story) => {
    const point = normalizeExternalStoryToPoint(story, input.agendaId);
    const identity = storyPointRespectsTopicIdentity(point, input.identity);
    const gate = evaluateStoryPointQuality(point);
    const rejectReasons: string[] = [];
    if (!identity.ok) rejectReasons.push(...identity.reasons.map((r) => `identity:${r}`));
    if (gate.verdict !== "pass") rejectReasons.push(...gate.hardFailReasons.map((r) => `gate:${r}`));
    return {
      point,
      gate,
      externalStoryId: story.externalStoryId,
      identityOk: identity.ok,
      identityReasons: identity.reasons,
      accepted: rejectReasons.length === 0,
      rejectReasons,
    };
  });
}
