import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const generateObjectMock = vi.fn();
vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI:
    ({ apiKey }: { apiKey: string }) =>
    (model: string) =>
      `google:${apiKey}:${model}`,
}));

import type { BlogPostViewModel } from "@/lib/blog/blogPost.types";
import {
  buildThreadCopySystemPrompt,
  composeThreadDraft,
  generateThreadCopy,
} from "@/lib/threads/generateThreadCopy";

const product: BlogPostViewModel = {
  productId: "p1",
  title: "발리 4박5일",
  oneLiner: "휴양과 스파가 있는 일정",
  concept: "휴양",
  priceText: "1,499,000원",
  durationText: "4박5일",
  regionText: "발리",
  seoRegionKeyword: "발리",
  includedLines: ["왕복항공", "호텔"],
  excludedLines: [],
  optionalLines: [],
  bookingConditionLines: [],
  bookingNotesLines: [],
  travelNotesLines: [],
  refundPolicyLines: [],
  timeline: { days: [] },
  recommendedTargetLines: [],
  productUrlPath: "/products/p1",
  heroImageUrl: "https://example.com/bali.jpg",
};

describe("generateThreadCopy", () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "g-key";
    delete process.env.THREADS_AI_MODEL;
  });

  it("uses TIMEDEAL instructions and gemini-3.6-flash", async () => {
    generateObjectMock.mockResolvedValue({
      object: {
        mainContent: "발리 4박5일 실속 일정입니다. 왕복항공과 호텔이 포함되어 있고 가격은 상세 기준입니다.",
        targetKeyword: "발리",
        hashtags: ["발리여행", "더올투어"],
        callToAction: "댓글로 발리 남겨주시면 상세 일정표 바로 남겨드릴게요!",
      },
    });

    const result = await generateThreadCopy(product, "TIMEDEAL");
    expect(result.targetKeyword).toBe("발리");
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    const call = generateObjectMock.mock.calls[0][0] as {
      model: string;
      system: string;
      prompt: string;
    };
    expect(call.model).toBe("google:g-key:gemini-3.6-flash");
    expect(call.system).toContain("TIMEDEAL");
    expect(call.system).toContain("긴급성");
    expect(call.system).toContain("올포함");
    expect(call.system).toContain("3초");
    expect(call.prompt).toContain("발리 4박5일");
  });

  it("uses curation prompt for CURATION", () => {
    const system = buildThreadCopySystemPrompt("CURATION");
    expect(system).toContain("타겟");
    expect(system).toContain("저장 욕구");
  });

  it("uses seasonal experience prompt for SEASONAL_EXPERIENCE", () => {
    const system = buildThreadCopySystemPrompt("SEASONAL_EXPERIENCE");
    expect(system).toContain("시의성");
    expect(system).toContain("현지");
    expect(system).toContain("3초");
  });
});

describe("composeThreadDraft", () => {
  it("joins body, hashtags, and CTA", () => {
    const text = composeThreadDraft({
      mainContent: "본문입니다.",
      targetKeyword: "발리",
      hashtags: ["발리여행", "#휴양"],
      callToAction: "댓글로 발리 남겨주세요.",
    });
    expect(text).toContain("본문입니다.");
    expect(text).toContain("#발리여행");
    expect(text).toContain("#휴양");
    expect(text).toContain("댓글로 발리 남겨주세요.");
  });
});
