/**
 * Parse + validate external-editorial-director-v1 JSON (provider-agnostic).
 */

import { isPublishableChannel, type PublishableChannel } from "@/lib/marketing/publishable/contracts";
import {
  EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT,
  type ExternalAgendaEvaluation,
  type ExternalChannelPotentialScores,
  type ExternalEditorialDirectorPayload,
  type ExternalSelectedAgenda,
  type ExternalStoryCandidate,
} from "@/lib/marketing/editorialDirector/contracts";

export type ExternalParseFailure = {
  ok: false;
  code: string;
  messageKo: string;
};

export type ExternalParseSuccess = {
  ok: true;
  payload: ExternalEditorialDirectorPayload;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function scoreOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, value));
}

function stringOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("empty");
  try {
    return JSON.parse(trimmed);
  } catch {
    /* try fenced / embedded */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return JSON.parse(fence[1].trim());
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("no_json");
}

function parseChannelPotential(raw: unknown): ExternalChannelPotentialScores {
  const o = asRecord(raw) ?? {};
  return {
    threads: scoreOrNull(o.threads),
    naverBlog: scoreOrNull(o.naverBlog ?? o.naver_blog),
    naverBand: scoreOrNull(o.naverBand ?? o.naver_band),
    kakaoChannel: scoreOrNull(o.kakaoChannel ?? o.kakao_channel),
    shortform: scoreOrNull(o.shortform),
  };
}

function parseChannels(raw: unknown): { channels: PublishableChannel[]; invalid: string[] } {
  if (!Array.isArray(raw)) return { channels: [], invalid: [] };
  const channels: PublishableChannel[] = [];
  const invalid: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") {
      invalid.push(String(item));
      continue;
    }
    const id = item.trim();
    if (isPublishableChannel(id)) channels.push(id);
    else invalid.push(id);
  }
  return { channels: [...new Set(channels)], invalid };
}

export function parseExternalEditorialDirectorPayload(
  rawText: string,
): ExternalParseSuccess | ExternalParseFailure {
  let parsed: unknown;
  try {
    parsed = extractJsonObject(rawText);
  } catch {
    return {
      ok: false,
      code: "MALFORMED_JSON",
      messageKo: "JSON을 파싱할 수 없습니다. ChatGPT가 반환한 JSON 블록을 그대로 붙여넣으세요.",
    };
  }

  const root = asRecord(parsed);
  if (!root) {
    return { ok: false, code: "INVALID_ROOT", messageKo: "최상위 값이 객체가 아닙니다." };
  }
  if (root.contract !== EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT) {
    return {
      ok: false,
      code: "CONTRACT_MISMATCH",
      messageKo: `contract가 ${EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT} 이어야 합니다(받은 값: ${String(root.contract)}).`,
    };
  }

  if (!Array.isArray(root.agendaEvaluation)) {
    return {
      ok: false,
      code: "MISSING_AGENDA_EVALUATION",
      messageKo: "agendaEvaluation 배열이 필요합니다.",
    };
  }

  const agendaEvaluation: ExternalAgendaEvaluation[] = [];
  for (const row of root.agendaEvaluation) {
    const o = asRecord(row);
    if (!o) continue;
    const agendaId = stringOrNull(o.agendaId);
    if (!agendaId) continue;
    agendaEvaluation.push({
      agendaId,
      overallRank: typeof o.overallRank === "number" ? o.overallRank : null,
      marketingPotential: scoreOrNull(o.marketingPotential),
      koreanAudienceRelevance: scoreOrNull(o.koreanAudienceRelevance),
      decisionUtility: scoreOrNull(o.decisionUtility),
      storyExpandability: scoreOrNull(o.storyExpandability),
      researchability: scoreOrNull(o.researchability),
      businessRelevance: scoreOrNull(o.businessRelevance),
      channelPotential: parseChannelPotential(o.channelPotential),
      reasonKo: stringOrNull(o.reasonKo),
      weaknessKo: stringOrNull(o.weaknessKo),
    });
  }

  const selectedRaw = asRecord(root.selectedAgenda) ?? {};
  const selectedAgenda: ExternalSelectedAgenda = {
    agendaId: stringOrNull(selectedRaw.agendaId),
    rank: typeof selectedRaw.rank === "number" ? selectedRaw.rank : null,
    reasonKo: stringOrNull(selectedRaw.reasonKo),
    noneStrongEnough: selectedRaw.noneStrongEnough === true,
  };

  if (selectedAgenda.noneStrongEnough || !selectedAgenda.agendaId) {
    if (!Array.isArray(root.storyCandidates) || root.storyCandidates.length === 0) {
      return {
        ok: false,
        code: "NO_STRONG_AGENDA",
        messageKo:
          "강한 Agenda가 없다고 판단된 결과입니다. Story 후보가 없어 가져올 수 없습니다. 다른 날짜 Slate를 쓰거나 내부 Story Miner를 사용하세요.",
      };
    }
  }

  if (!selectedAgenda.agendaId) {
    return {
      ok: false,
      code: "MISSING_SELECTED_AGENDA",
      messageKo: "selectedAgenda.agendaId가 필요합니다.",
    };
  }

  if (!Array.isArray(root.storyCandidates)) {
    return {
      ok: false,
      code: "MISSING_STORY_CANDIDATES",
      messageKo: "storyCandidates 배열이 필요합니다.",
    };
  }
  if (root.storyCandidates.length < 1 || root.storyCandidates.length > 8) {
    return {
      ok: false,
      code: "STORY_COUNT_OUT_OF_RANGE",
      messageKo: `Story 후보는 1~8개여야 합니다(현재 ${root.storyCandidates.length}개).`,
    };
  }

  const storyCandidates: ExternalStoryCandidate[] = [];
  for (let i = 0; i < root.storyCandidates.length; i += 1) {
    const o = asRecord(root.storyCandidates[i]);
    if (!o) {
      return {
        ok: false,
        code: "INVALID_STORY_ROW",
        messageKo: `storyCandidates[${i}]가 객체가 아닙니다.`,
      };
    }
    const externalStoryId =
      stringOrNull(o.externalStoryId) ?? stringOrNull(o.storyId) ?? `ext_story_${i + 1}`;
    const whyInterestingKo = stringOrNull(o.whyInterestingKo);
    const audienceTensionKo = stringOrNull(o.audienceTensionKo);
    const curiosityGapKo = stringOrNull(o.curiosityGapKo);
    const readerPayoffKo = stringOrNull(o.readerPayoffKo);
    const riskKo = stringOrNull(o.riskKo) ?? stringOrNull(o.genericRiskKo);
    const researchQuestionsKo = stringArray(o.researchQuestionsKo ?? o.researchQuestions);
    if (!whyInterestingKo || !audienceTensionKo || !curiosityGapKo || !readerPayoffKo) {
      return {
        ok: false,
        code: "MISSING_STORY_FIELDS",
        messageKo: `Story(${externalStoryId}): whyInterestingKo / audienceTensionKo / curiosityGapKo / readerPayoffKo 가 필요합니다.`,
      };
    }
    if (researchQuestionsKo.length < 1) {
      return {
        ok: false,
        code: "MISSING_RESEARCH_QUESTIONS",
        messageKo: `Story(${externalStoryId}): researchQuestionsKo가 비어 있습니다.`,
      };
    }
    if (!stringOrNull(o.storyQuestionKo) && !stringOrNull(o.storyClaimKo)) {
      return {
        ok: false,
        code: "MISSING_STORY_QUESTION_OR_CLAIM",
        messageKo: `Story(${externalStoryId}): storyQuestionKo 또는 storyClaimKo가 필요합니다.`,
      };
    }
    if (!riskKo) {
      return {
        ok: false,
        code: "MISSING_RISK",
        messageKo: `Story(${externalStoryId}): riskKo가 필요합니다.`,
      };
    }
    const { channels, invalid } = parseChannels(o.recommendedChannels);
    if (invalid.length > 0) {
      return {
        ok: false,
        code: "INVALID_CHANNEL",
        messageKo: `Story(${externalStoryId}): 허용되지 않는 채널 id — ${invalid.join(", ")}`,
      };
    }

    storyCandidates.push({
      externalStoryId,
      storyTitleKo: stringOrNull(o.storyTitleKo),
      storyQuestionKo: stringOrNull(o.storyQuestionKo),
      storyClaimKo: stringOrNull(o.storyClaimKo),
      audienceProblemKo: stringOrNull(o.audienceProblemKo),
      decisionAtStakeKo: stringOrNull(o.decisionAtStakeKo),
      stakes: stringArray(o.stakes),
      whyKoreanTravelerCaresKo: stringOrNull(o.whyKoreanTravelerCaresKo),
      whyInterestingKo,
      audienceTensionKo,
      curiosityGapKo,
      readerPayoffKo,
      editorialArchetype: stringOrNull(o.editorialArchetype),
      researchNeededKo: stringArray(o.researchNeededKo ?? o.researchNeeded),
      researchQuestionsKo,
      recommendedChannels: channels,
      channelReasonKo: stringOrNull(o.channelReasonKo),
      riskKo,
      nonGoalsKo: stringArray(o.nonGoalsKo ?? o.nonGoals),
    });
  }

  return {
    ok: true,
    payload: {
      contract: EXTERNAL_EDITORIAL_DIRECTOR_CONTRACT,
      agendaEvaluation,
      selectedAgenda,
      storyCandidates,
    },
  };
}
