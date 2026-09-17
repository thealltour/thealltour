import { describe, expect, it } from "vitest";

import {
  CHANNEL_COPY_LIMITS,
  KAKAO_CHANNEL_BODY_MAX_CHARS,
  THREADS_BODY_MAX_CHARS,
  bodyWithoutTrailingHashtags,
  buildChannelCopyPayload,
  channelBodyCharCount,
  channelFoldPreview,
  describeCharCount,
  extractHashtagsFromText,
} from "@/lib/marketing/review/channelCopyLimits";
import { REVIEWABLE_PUBLISHABLE_CHANNELS } from "@/lib/marketing/review/channelReviews";

describe("channel copy limits", () => {
  it("covers every reviewable channel", () => {
    for (const channel of REVIEWABLE_PUBLISHABLE_CHANNELS) {
      expect(CHANNEL_COPY_LIMITS[channel]).toBeDefined();
    }
  });

  it("reports ok, near limit, and over limit", () => {
    expect(describeCharCount("가".repeat(100), 500).status).toBe("ok");
    expect(describeCharCount("가".repeat(460), 500).status).toBe("near_limit");
    const over = describeCharCount("가".repeat(520), 500);
    expect(over.status).toBe("over_limit");
    expect(over.remaining).toBe(-20);
    expect(over.label).toContain("20자 초과");
  });

  it("has no limit for channels without one", () => {
    const count = describeCharCount("가".repeat(9000), null);
    expect(count.status).toBe("ok");
    expect(count.label).toBe("9000자");
  });

  it("applies the channel's own body limit", () => {
    expect(channelBodyCharCount("threads", "가".repeat(THREADS_BODY_MAX_CHARS + 1)).status).toBe(
      "over_limit",
    );
    expect(
      channelBodyCharCount("kakao_channel", "가".repeat(KAKAO_CHANNEL_BODY_MAX_CHARS - 400)).status,
    ).toBe("ok");
    expect(channelBodyCharCount("naver_blog", "가".repeat(9000)).status).toBe("ok");
  });
});

describe("clipboard payloads", () => {
  const body = [
    "부산항 탑승 동선은 터미널 2층에서 시작합니다.",
    "수하물 규정은 공항과 다릅니다.",
    "",
    "#부산크루즈 #부산항 #부산크루즈",
  ].join("\n");

  it("extracts unique hashtags in order", () => {
    expect(extractHashtagsFromText(body)).toEqual(["#부산크루즈", "#부산항"]);
  });

  it("strips only trailing hashtag lines from the body", () => {
    const stripped = bodyWithoutTrailingHashtags(body);
    expect(stripped).toContain("터미널 2층");
    expect(stripped).not.toContain("#부산크루즈");
    expect(bodyWithoutTrailingHashtags("본문 #중간태그 계속\n\n마지막 문장")).toContain(
      "#중간태그",
    );
  });

  it("builds body, hashtag, and title payloads", () => {
    const payload = buildChannelCopyPayload({ title: "  부산 크루즈 가이드  ", body });
    expect(payload.body).toBe(body);
    expect(payload.hashtagLine).toBe("#부산크루즈 #부산항");
    expect(payload.title).toBe("  부산 크루즈 가이드  ");
    expect(payload.bodyWithoutHashtags).not.toContain("#");
  });

  it("returns no hashtag line when the body has none", () => {
    const payload = buildChannelCopyPayload({ body: "해시태그 없는 본문" });
    expect(payload.hashtags).toEqual([]);
    expect(payload.hashtagLine).toBeNull();
    expect(payload.title).toBeNull();
  });
});

describe("fold preview", () => {
  it("only Instagram has a fold", () => {
    expect(channelFoldPreview("threads", "본문")).toBeNull();
    expect(channelFoldPreview("naver_blog", "본문")).toBeNull();
    const preview = channelFoldPreview("instagram", "가".repeat(200));
    expect(preview?.text.length).toBe(125);
    expect(preview?.truncated).toBe(true);
  });

  it("marks a short caption as not truncated", () => {
    expect(channelFoldPreview("instagram", "짧은 캡션")?.truncated).toBe(false);
  });
});
