import { describe, expect, it } from "vitest";

import {
  createEmptyThreadReplyDestination,
  isDestinationInList,
  isValidThreadReplyDestinationUrl,
  normalizeDestinationUrlForCompare,
  parseThreadReplyDestinations,
  serializeThreadReplyDestinations,
} from "@/lib/threads/threadReplyDestinations";
import { buildThreadReplyDestinationUrl } from "@/lib/threads/replyTemplates";

describe("threadReplyDestinations", () => {
  it("accepts absolute and path urls", () => {
    expect(isValidThreadReplyDestinationUrl("https://thealltour.com/blog")).toBe(true);
    expect(isValidThreadReplyDestinationUrl("/blog")).toBe(true);
    expect(isValidThreadReplyDestinationUrl("/")).toBe(true);
    expect(isValidThreadReplyDestinationUrl("blog")).toBe(false);
    expect(isValidThreadReplyDestinationUrl("")).toBe(false);
  });

  it("parses and serializes, dropping invalid rows", () => {
    const json = serializeThreadReplyDestinations([
      { id: "1", label: "블로그", url: "/blog" },
      { id: "2", label: "", url: "/golf/kakao-sync" },
      { id: "3", label: "카카오", url: "not-a-url" },
      { id: "4", label: "싱크", url: "https://thealltour.com/golf/kakao-sync" },
    ]);
    const parsed = parseThreadReplyDestinations(json);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.url).toBe("/blog");
    expect(parsed[1]?.url).toBe("https://thealltour.com/golf/kakao-sync");
  });

  it("creates empty destination with id", () => {
    const empty = createEmptyThreadReplyDestination();
    expect(empty.id).toBeTruthy();
    expect(empty.label).toBe("");
    expect(empty.url).toBe("");
  });

  it("matches destination list with path vs absolute", () => {
    const list = parseThreadReplyDestinations(
      JSON.stringify([{ id: "1", label: "블로그", url: "/blog" }]),
    );
    expect(isDestinationInList("/blog", list, "https://thealltour.com")).toBe(true);
    expect(isDestinationInList("https://thealltour.com/blog", list, "https://thealltour.com")).toBe(
      true,
    );
    expect(isDestinationInList("/golf/kakao-sync", list, "https://thealltour.com")).toBe(false);
    expect(normalizeDestinationUrlForCompare("/blog/", "https://thealltour.com")).toBe(
      "https://thealltour.com/blog",
    );
  });
});

describe("buildThreadReplyDestinationUrl", () => {
  it("resolves path and absolute with UTM", () => {
    const fromPath = buildThreadReplyDestinationUrl("/blog", "발리", "https://thealltour.com/");
    expect(fromPath).toContain("https://thealltour.com/blog?");
    expect(fromPath).toContain("utm_source=threads");
    expect(fromPath).toContain("utm_medium=auto_reply");
    expect(fromPath).toContain("utm_campaign=");

    const fromAbs = buildThreadReplyDestinationUrl(
      "https://thealltour.com/golf/kakao-sync",
      "카카오싱크",
      "https://thealltour.com",
    );
    expect(fromAbs.startsWith("https://thealltour.com/golf/kakao-sync?")).toBe(true);
    expect(fromAbs).toContain("utm_campaign=");
  });
});
