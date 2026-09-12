import { describe, expect, it } from "vitest";

import {
  deriveVisualIntent,
  isOutlineHeaderLine,
  splitShortformNarrationSegments,
} from "@/lib/marketing/assets/shortform/narrationSegments";
import { buildShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/buildShortVideoBrief";
import { MEDIA_BRIEF_CONTRACT, type MediaBrief } from "@/lib/marketing/assets/contracts";

const SAMPLE_DRAFT = `Context
추석 연휴를 앞두고 크루즈 여행에 대한 관심이 높아지는 가운데, 관련 여행 정보 수요가 증가하고 있습니다.

Key verified facts from assignment evidence
공개 인스타그램에서 부산 출발 MSC 벨리시마 크루즈의 탑승 동선과 가족 동반 체험을 소개하는 콘텐츠가 관측되었습니다.

Travel relevance for audience
해외여행을 고려하는 한국 여행객들에게 부산항을 출발하는 크루즈의 실제 탑승 과정과 가족 단위 프로그램 정보를 파악하는 데 참고가 됩니다.

Useful takeaway without product
크루즈 여행 준비 시 탑승 동선과 선내 가족 동반 체험 요소를 미리 확인하면 일정을 보다 체계적으로 계획할 수 있습니다.`;

describe("splitShortformNarrationSegments", () => {
  it("drops strategist outline headers and never emits empty visualIntent", () => {
    const segments = splitShortformNarrationSegments(SAMPLE_DRAFT, {
      destinations: ["부산"],
      entities: ["MSC 벨리시마"],
      title: "부산 출발 크루즈",
    });

    expect(segments.length).toBe(4);
    expect(segments.every((s) => !isOutlineHeaderLine(s.narrationText))).toBe(true);
    expect(segments.map((s) => s.narrationText)).not.toContain("Context");
    expect(segments.every((s) => s.visualIntent.trim().length > 0)).toBe(true);
    expect(segments.every((s) => s.purpose !== "narration")).toBe(true);
    expect(segments[0]?.purpose).toBe("hook");
    expect(segments[segments.length - 1]?.purpose).toBe("close");
  });

  it("deriveVisualIntent prefers destination mentions", () => {
    const intent = deriveVisualIntent({
      narrationText: "부산항에서 크루즈에 탑승하는 동선을 확인하세요.",
      destinations: ["부산"],
      entities: [],
    });
    expect(intent.toLowerCase()).toContain("부산");
    expect(intent.toLowerCase()).not.toBe("narration");
  });
});

describe("buildShortVideoBrief search quality", () => {
  it("does not use purpose 'narration' as subject or search query", () => {
    const mediaBrief: MediaBrief = {
      contract: MEDIA_BRIEF_CONTRACT,
      candidateId: "cmc_test_shortform_query",
      businessDateKst: "2026-09-12",
      sourceChannel: "threads",
      targetChannels: ["threads"],
      contentIntent: "cruise travel",
      audience: null,
      coreMessage: "부산 크루즈",
      factualClaims: [],
      evidenceRefs: [],
      cta: null,
      formats: {
        text: { enabled: true, title: "부산 크루즈", body: SAMPLE_DRAFT },
        cardnews: { enabled: false, aspectRatio: null, cards: [], brandingIntent: null },
        shortform: {
          enabled: true,
          orientation: "vertical",
          targetDurationRange: null,
          narrationSegments: splitShortformNarrationSegments(SAMPLE_DRAFT, {
            destinations: ["부산"],
            title: "부산 크루즈",
          }),
          cta: null,
          voiceProfileId: null,
        },
      },
      provenance: {
        builtFrom: "completed-marketing-candidate",
        candidateContract: "completed-marketing-candidate-v1",
        assignmentId: null,
        selectedAgendaId: null,
        governanceReviewId: null,
        evidenceRefIds: [],
      },
    };

    const brief = buildShortVideoBrief({
      mediaBrief,
      destinations: ["부산"],
      durationPreset: "short",
    });

    for (const scene of brief.scenes) {
      expect(scene.visual.subject.toLowerCase()).not.toBe("narration");
      expect(scene.visual.searchQueries).not.toContain("narration");
      expect(scene.visual.searchQueries.some((q) => q.toLowerCase() === "narration")).toBe(false);
      expect(scene.visual.searchQueries.length).toBeGreaterThan(0);
    }
  });

  it("falls back to narration text when visualIntent empty — never purpose", () => {
    const mediaBrief: MediaBrief = {
      contract: MEDIA_BRIEF_CONTRACT,
      candidateId: "cmc_test_empty_visual",
      businessDateKst: "2026-09-12",
      sourceChannel: "threads",
      targetChannels: ["threads"],
      contentIntent: "travel",
      audience: null,
      coreMessage: null,
      factualClaims: [],
      evidenceRefs: [],
      cta: null,
      formats: {
        text: { enabled: true, title: null, body: "다낭 해변에서 일몰을 즐겨보세요." },
        cardnews: { enabled: false, aspectRatio: null, cards: [], brandingIntent: null },
        shortform: {
          enabled: true,
          orientation: "vertical",
          targetDurationRange: null,
          narrationSegments: [
            {
              segmentId: "narr-01",
              narrationText: "다낭 해변에서 일몰을 즐겨보세요.",
              subtitleText: "다낭 해변에서 일몰을 즐겨보세요.",
              purpose: "narration",
              visualIntent: "",
              evidenceRefs: [],
            },
          ],
          cta: null,
          voiceProfileId: null,
        },
      },
      provenance: {
        builtFrom: "completed-marketing-candidate",
        candidateContract: "completed-marketing-candidate-v1",
        assignmentId: null,
        selectedAgendaId: null,
        governanceReviewId: null,
        evidenceRefIds: [],
      },
    };

    const brief = buildShortVideoBrief({
      mediaBrief,
      destinations: ["다낭"],
      durationPreset: "short",
    });
    expect(brief.scenes[0]!.visual.subject.toLowerCase()).not.toBe("narration");
    expect(brief.scenes[0]!.visual.searchQueries).not.toContain("narration");
    expect(
      brief.scenes[0]!.visual.searchQueries.some(
        (q) => q.includes("다낭") || q.includes("일몰") || q.includes("해변"),
      ),
    ).toBe(true);
  });
});
