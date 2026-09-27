/**
 * Forced-CTA detector surgical fix — topic/analysis vs imperative distinction.
 * Covers Threads + Blog materializers (A–I).
 */

import { describe, expect, it } from "vitest";

import {
  hasImperativeNowActionCta,
  IMPERATIVE_NOW_ACTION_CTA_RE,
} from "@/lib/marketing/publishable/forcedCtaDetection";
import { hasForcedThreadsCta } from "@/lib/marketing/publishable/threadsCopy/materialize";
import { hasNaverBlogForcedCta } from "@/lib/marketing/publishable/naverBlogEditorial/materialize";

describe("forced CTA detector — topic vs imperative", () => {
  const detectors = [
    { name: "shared", fn: hasImperativeNowActionCta },
    { name: "threads", fn: hasForcedThreadsCta },
    { name: "blog", fn: hasNaverBlogForcedCta },
  ] as const;

  it("A. reservation topic question ALLOW", () => {
    for (const d of detectors) {
      expect(d.fn("지금 예약할까, 기다릴까"), d.name).toBe(false);
      expect(d.fn("지금 예약할까, 조금 더 기다릴까"), d.name).toBe(false);
    }
  });

  it("B. reservation analytical statement ALLOW", () => {
    for (const d of detectors) {
      expect(d.fn("지금 예약 여부는 취소 조건에 따라 달라집니다"), d.name).toBe(false);
      expect(
        d.fn("지금 예약해야 하는지는 가격만으로 결정하기 어렵습니다"),
        d.name,
      ).toBe(false);
      expect(
        d.fn("지금 예약하는 게 나을지 기다리는 게 나을지"),
        d.name,
      ).toBe(false);
    }
  });

  it("C. reservation noun/topic phrase ALLOW", () => {
    for (const d of detectors) {
      expect(d.fn("지금 예약과 대기 사이의 판단"), d.name).toBe(false);
      expect(
        d.fn("지금 예약과 대기 사이에서 판단하려면"),
        d.name,
      ).toBe(false);
      expect(
        d.fn('"지금 예약"과 "조금 더 기다리기"를 비교합니다'),
        d.name,
      ).toBe(false);
    }
  });

  it("D. real imperative REJECT", () => {
    for (const d of detectors) {
      expect(d.fn("지금 예약하세요"), d.name).toBe(true);
      expect(d.fn("지금 구매하세요"), d.name).toBe(true);
      expect(d.fn("지금 신청하세요"), d.name).toBe(true);
      expect(d.fn("지금 변경하세요"), d.name).toBe(true);
    }
  });

  it("E. soft imperative REJECT when unauthorized", () => {
    for (const d of detectors) {
      expect(d.fn("지금 예약해 보세요"), d.name).toBe(true);
      expect(d.fn("지금 예약해두세요"), d.name).toBe(true);
      expect(d.fn("지금 예약하시면 됩니다"), d.name).toBe(true);
      expect(d.fn("지금 예약을 진행하세요"), d.name).toBe(true);
    }
  });

  it("F. explicit immediate imperative REJECT", () => {
    for (const d of detectors) {
      expect(d.fn("지금 바로 예약하세요"), d.name).toBe(true);
      expect(d.fn("지금 바로 구매해 보세요"), d.name).toBe(true);
    }
  });

  it("G. non-reservation decision topic ALLOW analytical language", () => {
    for (const d of detectors) {
      expect(d.fn("지금 구매할지 기다릴지 비교해 봅니다"), d.name).toBe(false);
      expect(d.fn("지금 신청해야 하는지는 조건에 따라 다릅니다"), d.name).toBe(false);
      expect(d.fn("지금 변경할 필요가 있는지 확인합니다"), d.name).toBe(false);
    }
  });

  it("H. discovery engagement forced-CTA rejection remains intact", () => {
    expect(hasForcedThreadsCta("좋아요. 저장해두고 비교해보세요.")).toBe(true);
    expect(hasForcedThreadsCta("댓글로 남겨주세요")).toBe(true);
    expect(hasForcedThreadsCta("링크를 클릭해 보세요")).toBe(true);
    expect(hasForcedThreadsCta("팔로우해 주세요")).toBe(true);
    expect(hasNaverBlogForcedCta("저장해 두세요")).toBe(true);
    expect(hasNaverBlogForcedCta("문의하세요")).toBe(true);
    expect(hasNaverBlogForcedCta("비교 후 선택하세요")).toBe(true);
    expect(hasNaverBlogForcedCta("클릭해 보세요")).toBe(true);
    expect(hasNaverBlogForcedCta("팔로우해 주세요")).toBe(true);
  });

  it("I. bare topic phrase alone is not a CTA; regex does not ban 지금 예약 globally", () => {
    expect(IMPERATIVE_NOW_ACTION_CTA_RE.source).not.toMatch(/^\^?지금\\s\*예약\$?/);
    expect(hasImperativeNowActionCta("지금 예약")).toBe(false);
    expect(hasForcedThreadsCta("지금 예약")).toBe(false);
    expect(hasNaverBlogForcedCta("지금 예약")).toBe(false);
    // decision story body sample (F1-like)
    const decisionBody = [
      "호텔이 늘어나는 상황에서 지금 예약할지 더 기다릴지 고민해볼 수 있습니다.",
      "지금 예약할까, 조금 기다릴까. 핵심은 취소·변경 조건입니다.",
      "지금 예약 여부는 취소 조건에 따라 달라집니다.",
    ].join("\n");
    expect(hasForcedThreadsCta(decisionBody)).toBe(false);
    expect(hasNaverBlogForcedCta(decisionBody)).toBe(false);
  });
});
