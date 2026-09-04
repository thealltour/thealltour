import { MEDIA_BRIEF_CONTRACT, type MediaBrief } from "@/lib/marketing/assets/contracts";

export const AI_VIDEO_VERIFICATION_CANDIDATE_ID = "dev-tts-a6-verification" as const;
export const AI_VIDEO_VERIFICATION_BUSINESS_DATE = "2026-09-03" as const;

export function createA8VerificationBrief(): MediaBrief {
  return {
    contract: MEDIA_BRIEF_CONTRACT,
    candidateId: AI_VIDEO_VERIFICATION_CANDIDATE_ID,
    businessDateKst: AI_VIDEO_VERIFICATION_BUSINESS_DATE,
    sourceChannel: "instagram",
    targetChannels: ["instagram"],
    contentIntent: "informational",
    audience: "효도여행을 준비하는 한국 여행객",
    coreMessage: "다낭 효도여행은 일정이 여유롭습니다.",
    factualClaims: [],
    evidenceRefs: [],
    cta: "출발 전에 공식 안내를 다시 확인하세요.",
    formats: {
      text: {
        enabled: true,
        title: "다낭 효도여행",
        body: "다낭 효도여행은 일정이 여유롭습니다.\n\n출발 전에 공식 안내를 다시 확인하세요.",
      },
      cardnews: {
        enabled: false,
        aspectRatio: null,
        cards: [],
        brandingIntent: null,
      },
      shortform: {
        enabled: true,
        orientation: "vertical",
        targetDurationRange: null,
        narrationSegments: [
          {
            segmentId: "hook",
            narrationText: "다낭 효도여행은 일정이 여유롭습니다.",
            subtitleText: "다낭 효도여행은 일정이 여유롭습니다.",
            purpose: "hook",
            visualIntent: "",
            evidenceRefs: [],
          },
          {
            segmentId: "close",
            narrationText: "출발 전에 공식 안내를 다시 확인하세요.",
            subtitleText: "출발 전에 공식 안내를 다시 확인하세요.",
            purpose: "close",
            visualIntent: "",
            evidenceRefs: [],
          },
        ],
        cta: "출발 전에 공식 안내를 다시 확인하세요.",
        voiceProfileId: "standard-ko-development",
      },
    },
    provenance: {
      builtFrom: "completed-marketing-candidate",
      candidateContract: "completed-marketing-candidate-v1",
      assignmentId: "ca_dev_tts_a6",
      selectedAgendaId: "sa_dev_tts_a6",
      governanceReviewId: null,
      evidenceRefIds: [],
    },
  };
}
