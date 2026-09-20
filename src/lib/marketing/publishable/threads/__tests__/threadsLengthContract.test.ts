import { describe, expect, it } from "vitest";

import { compressThreadsBodyToLimit } from "@/lib/marketing/publishable/threads/compressThreadsBody";
import { composeThreadsPublishableContent } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import { THREADS_WRITING_CONTRACT } from "@/lib/marketing/publishable/threads/writingContract";
import type { PublishableComposerInput } from "@/lib/marketing/publishable/inputs";
import {
  THREADS_BODY_MAX_CHARS,
  THREADS_BODY_PREFERRED_MAX_CHARS,
  THREADS_BODY_PREFERRED_MIN_CHARS,
  validatePublishableText,
} from "@/lib/marketing/publishable/validate";
import { CHANNEL_COPY_LIMITS, channelBodyCharCount } from "@/lib/marketing/review/channelCopyLimits";

function baseComposer(overrides: Partial<PublishableComposerInput> = {}): PublishableComposerInput {
  return {
    candidateId: "cand_threads_len",
    businessDateKst: "2026-09-18",
    topic: "다낭 해변과 푸꾸옥 리조트의 익숙한 대비",
    audience: "베트남 여행 관심층",
    commercialIntent: "informational",
    hookHint: "익숙한 해변 이미지 너머",
    keyMessage: "덜 익숙한 층이 남아 있다",
    destinations: ["다낭", "푸꾸옥"],
    entities: ["다오족"],
    usableFacts: [
      {
        statement: "한국 여행자에게 익숙한 베트남 풍경은 해변과 리조트 쪽으로 기운다",
        epistemicType: "observed",
        confidence: "medium",
        evidenceRefIds: ["ev-1"],
        usable: true,
      },
    ],
    avoidedStatements: [],
    unsupportedClaims: [],
    governanceDecision: "allow",
    sourceRevision: "rev_a1",
    evidenceRefIds: ["ev-1"],
    research: null,
    targetChannels: ["threads"],
    contentProposition: {
      contract: "content-proposition-v1",
      primaryAudience: "베트남 여행 관심층",
      audienceProblem: "해변·리조트로만 안다",
      audienceTension: "익숙한 이미지와 덜 익숙한 층",
      contentPromise: "해변·리조트 너머의 덜 익숙한 층을 짚는다",
      readerGain: "같은 나라를 다르게 본다",
      specificTakeaways: ["덜 익숙한 층", "다오족 마을"],
      desiredAudienceAction: "none",
      engagementMechanism: "discovery",
      propositionStrength: "strong",
      ctaIntent: null,
      limitations: ["공식 일정 단정 불가"],
      forbiddenClaims: [],
    } as never,
    ...overrides,
  };
}

describe("Threads length contract ↔ publishability", () => {
  it("keeps preferred band and hard max aligned in the writing contract", () => {
    expect(THREADS_WRITING_CONTRACT).toContain(String(THREADS_BODY_PREFERRED_MIN_CHARS));
    expect(THREADS_WRITING_CONTRACT).toContain(String(THREADS_BODY_PREFERRED_MAX_CHARS));
    expect(THREADS_WRITING_CONTRACT).toContain(String(THREADS_BODY_MAX_CHARS));
    expect(THREADS_WRITING_CONTRACT).not.toMatch(/250\s*[–-]\s*700/);
    expect(THREADS_WRITING_CONTRACT).toMatch(/Never exceed/);
  });

  it("uses the same hard max in review UI and validatePublishableText", () => {
    expect(CHANNEL_COPY_LIMITS.threads.bodyMax).toBe(THREADS_BODY_MAX_CHARS);
    expect(THREADS_BODY_MAX_CHARS).toBe(500);
  });

  it("450 chars → pass", () => {
    const body = "가".repeat(450);
    expect(validatePublishableText(body, { channel: "threads" }).ok).toBe(true);
    expect(channelBodyCharCount("threads", body).status).not.toBe("over_limit");
  });

  it("500 chars → pass", () => {
    const body = "가".repeat(THREADS_BODY_MAX_CHARS);
    expect(validatePublishableText(body, { channel: "threads" }).ok).toBe(true);
    expect(channelBodyCharCount("threads", body).status).not.toBe("over_limit");
  });

  it("501 chars → publishability too_long (UI stays strict)", () => {
    const body = "가".repeat(THREADS_BODY_MAX_CHARS + 1);
    const validation = validatePublishableText(body, { channel: "threads" });
    expect(validation.ok).toBe(false);
    expect(validation.issues.some((i) => i.code === "too_long")).toBe(true);
    expect(channelBodyCharCount("threads", body).status).toBe("over_limit");
  });

  it("compresses an oversized body to ≤500 while keeping discovery semantics", () => {
    const discoveryCore = [
      "다낭의 해변, 푸꾸옥의 리조트, 호치민과 하노이의 도시 풍경. 한국 여행자에게 익숙한 베트남의 모습입니다.",
      "그런데 같은 나라 안에도 덜 익숙한 층이 남아 있습니다. 북부 산지의 다오족 마을은 그 한 조각입니다.",
      "공개된 기록만으로는 일정·요금·운영을 단정할 수 없습니다. 증거 경계는 그대로 둡니다.",
      "구체적인 디테일은 돌계단과 산비탈 집들이 만드는 풍경입니다. 리조트 체크리스트로 바꾸지 않습니다.",
    ].join("\n\n");
    const padded = [
      discoveryCore,
      discoveryCore,
      "여러분은 A와 B 중 어느 쪽이 더 끌리시나요? 댓글로 알려주세요!",
      "가".repeat(120),
    ].join("\n\n");
    expect(padded.length).toBeGreaterThan(THREADS_BODY_MAX_CHARS);

    const compressed = compressThreadsBodyToLimit(padded, THREADS_BODY_MAX_CHARS);
    expect(compressed.length).toBeLessThanOrEqual(THREADS_BODY_MAX_CHARS);
    expect(compressed).toMatch(/다오족|덜 익숙한/);
    expect(compressed).toMatch(/단정할 수 없|증거/);
    expect(compressed).toMatch(/돌계단|산비탈/);
    expect(compressed).not.toMatch(/여러분은 A와 B/);
    expect(compressed).not.toMatch(/댓글로 알려주세요/);
    expect(compressed).not.toMatch(/체크리스트로 정리하세요/);
  });

  it("composeThreads compresses 501+ LLM output before publishability failure", async () => {
    const longBody = [
      "다낭의 해변과 푸꾸옥 리조트는 한국 여행자에게 익숙한 베트남 이미지입니다.",
      "같은 나라 안에도 덜 익숙한 층이 남아 있고, 북부 산지 다오족 마을은 그 한 조각입니다.",
      "공개된 기록만으로는 공식 일정과 요금을 단정할 수 없습니다.",
      "돌계단과 산비탈 집들이 만드는 풍경이 구체적 디테일입니다.",
      "해변·리조트 너머에 덜 익숙한 층이 있다는 점을 짧게 남깁니다.",
      "가".repeat(400),
    ].join("\n\n");
    expect(longBody.length).toBeGreaterThan(THREADS_BODY_MAX_CHARS);

    const result = await composeThreadsPublishableContent({
      composerInput: baseComposer(),
      allowDeterministicFallback: false,
      invoke: async () =>
        JSON.stringify({
          title: null,
          body: longBody,
          mediaPlan: null,
        }),
    });

    expect(result.body.length).toBeLessThanOrEqual(THREADS_BODY_MAX_CHARS);
    expect(result.publishableSuccess).toBe(true);
    expect(result.status).toBe("generated");
    expect(result.body).toMatch(/다오족|덜 익숙한|해변/);
    expect(result.validation.ok).toBe(true);
  });
});
