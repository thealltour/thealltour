import { describe, expect, it } from "vitest";

import {
  parseInstagramJson,
  slideHeadlineIssues,
} from "@/lib/marketing/publishable/instagram/composeInstagramPublishableContent";
import { instagramCaptionIssues } from "@/lib/marketing/publishable/validate";

function codes(caption: string): string[] {
  return instagramCaptionIssues(caption).map((issue) => issue.code);
}

const HOOK = "첫 크루즈는 배 안보다 부산항 탑승 직전이 훨씬 헷갈립니다. 순서만 알아도 대기 시간이 줄어요.";

describe("Instagram caption validator", () => {
  it("accepts a caption with a real hook, tag range, and non-link CTA", () => {
    const caption = [
      HOOK,
      "",
      "1. 승선 수속은 항만 터미널 층에서 시작합니다.",
      "2. 기내 반입 규정과 다른 점을 미리 확인하세요.",
      "",
      "저장해 두고 출발 전에 다시 확인해 보세요.",
      "",
      "#부산크루즈 #부산항 #여행준비",
    ].join("\n");
    expect(codes(caption)).toEqual([]);
  });

  it("flags a caption that opens with hashtags instead of a hook", () => {
    const caption = ["#부산크루즈 #부산항 #여행준비 #여행스타그램", "", "본문은 아래에 있습니다."].join("\n");
    expect(codes(caption)).toContain("weak_hook");
  });

  it("flags too few and too many hashtags", () => {
    expect(codes(`${HOOK}\n\n#부산크루즈`)).toContain("hashtag_policy");
    const many = Array.from({ length: 14 }, (_, i) => `#태그${i}`).join(" ");
    expect(codes(`${HOOK}\n\n${many}`)).toContain("hashtag_policy");
  });

  it("flags duplicate hashtags", () => {
    expect(codes(`${HOOK}\n\n#부산크루즈 #부산크루즈 #부산항 #여행준비`)).toContain("hashtag_policy");
  });

  it("flags CTAs that assume a clickable link", () => {
    expect(codes(`${HOOK}\n\n아래 링크를 클릭해 확인하세요.\n\n#부산크루즈 #부산항 #여행준비`)).toContain(
      "unclickable_link_cta",
    );
    expect(codes(`${HOOK}\n\nhttps://thealltour.com/cruise\n\n#부산크루즈 #부산항 #여행준비`)).toContain(
      "unclickable_link_cta",
    );
  });

  it("flags a caption past the 2200 character limit", () => {
    expect(codes(`${HOOK}${"가".repeat(2300)}\n#부산크루즈 #부산항 #여행준비`)).toContain("too_long");
  });
});

describe("Instagram slide headlines", () => {
  it("accepts 4–7 distinct short overlays", () => {
    expect(slideHeadlineIssues(["탑승 동선", "수속 순서", "수하물 규정", "대기 시간"])).toEqual([]);
  });

  it("rejects too few, too many, overlong, and duplicated overlays", () => {
    expect(slideHeadlineIssues(["하나", "둘"])).toContain("slides_too_few");
    expect(slideHeadlineIssues(Array.from({ length: 11 }, (_, i) => `카드${i}`))).toContain(
      "slides_too_many",
    );
    expect(
      slideHeadlineIssues(["탑승 동선", "수속 순서", "수하물 규정", "가".repeat(30)]),
    ).toContain("slide_headline_too_long");
    expect(slideHeadlineIssues(["탑승 동선", "탑승 동선", "수속 순서", "수하물"])).toContain(
      "slide_headline_duplicate",
    );
  });

  it("allows up to 10 cards for complex evidence explainers", () => {
    expect(
      slideHeadlineIssues(Array.from({ length: 10 }, (_, i) => `카드${i}`)),
    ).toEqual([]);
  });
});

describe("parseInstagramJson", () => {
  it("falls back to caption hashtags when the model omits the field", () => {
    const parsed = parseInstagramJson(
      JSON.stringify({
        hook: HOOK,
        body: `${HOOK}\n\n#부산크루즈 #부산항 #여행준비`,
        slideHeadlines: ["탑승 동선", "수속 순서", "수하물 규정", "대기 시간"],
      }),
    );
    expect(parsed?.meta.hashtags).toEqual(["#부산크루즈", "#부산항", "#여행준비"]);
  });

  it("normalizes hashtags declared without the # prefix", () => {
    const parsed = parseInstagramJson(
      JSON.stringify({ body: HOOK, hashtags: ["부산크루즈", "#부산항"] }),
    );
    expect(parsed?.meta.hashtags).toEqual(["#부산크루즈", "#부산항"]);
  });

  it("merges declared hashtags into body when caption omits them (hashtag_policy gate)", () => {
    const parsed = parseInstagramJson(
      JSON.stringify({
        hook: HOOK,
        body: HOOK,
        hashtags: ["#부산크루즈", "#부산항", "#여행준비"],
        slideHeadlines: ["탑승 동선", "수속 순서", "수하물 규정", "대기 시간"],
      }),
    );
    expect(parsed?.meta.hashtags).toEqual(["#부산크루즈", "#부산항", "#여행준비"]);
    expect(parsed?.body).toContain("#부산크루즈");
    expect(parsed?.body).toContain("#부산항");
    expect(parsed?.body).toContain("#여행준비");
    expect(codes(parsed!.body)).not.toContain("hashtag_policy");
  });

  it("returns null without a body", () => {
    expect(parseInstagramJson(JSON.stringify({ hook: HOOK }))).toBeNull();
    expect(parseInstagramJson("no json here")).toBeNull();
  });
});
