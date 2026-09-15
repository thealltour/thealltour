/**
 * ED-2 post-research lock — reject destination/product/topic drift vs StoryPoint.
 */

import type { AgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import { identityIsCruise } from "@/lib/marketing/audienceResearch/topicIdentity/contracts";
import {
  textLooksCruiseSpecific,
  validateAngleAgainstAgendaIdentity,
} from "@/lib/marketing/audienceResearch/topicIdentity/validateAgainstIdentity";
import type {
  EvidenceBackedStoryBrief,
  StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";

const GENERIC_TRAVEL_REPLACEMENT =
  /여행\s*준비\s*팁|기본\s*여행\s*정보|관광지\s*추천|종합\s*가이드|체크리스트\s*나열|알아둘\s*점/i;

export type StoryResearchLockResult = {
  ok: boolean;
  issues: string[];
};

export function validateStoryResearchLock(input: {
  storyPoint: StoryContentPoint;
  brief: EvidenceBackedStoryBrief;
  topicIdentity: AgendaTopicIdentity;
}): StoryResearchLockResult {
  const issues: string[] = [];
  const framingBlob = [
    ...input.brief.researchSupportedFraming,
    input.brief.supportedClaimBoundary ?? "",
    ...input.brief.researchQuestionFindings.map((f) => f.finding),
  ].join("\n");

  if (GENERIC_TRAVEL_REPLACEMENT.test(framingBlob)) {
    issues.push("generic_travel_advice_replacement");
  }

  for (const framing of input.brief.researchSupportedFraming) {
    const idCheck = validateAngleAgainstAgendaIdentity(framing, input.topicIdentity);
    if (!idCheck.ok) {
      issues.push(...idCheck.issues.map((i) => `identity:${i.dimension}`));
    }
    if (textLooksCruiseSpecific(framing) && !identityIsCruise(input.topicIdentity)) {
      issues.push("cruise_contamination");
    }
  }

  const storyScope = [
    input.storyPoint.storyQuestion ?? "",
    input.storyPoint.storyClaim ?? "",
    ...input.storyPoint.researchQuestions,
  ].join(" ");
  const significant = storyScope
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => /방콕|나트랑|호텔|패키지|부모|위치|BTS|MRT|크루즈|부산|항공/i.test(t));

  if (significant.length >= 2 && input.brief.researchSupportedFraming.length > 0) {
    const framingLower = framingBlob.toLowerCase();
    const hit = significant.filter((t) => framingLower.includes(t.toLowerCase())).length;
    if (hit === 0) issues.push("story_point_scope_abandoned");
  }

  return { ok: issues.length === 0, issues };
}
