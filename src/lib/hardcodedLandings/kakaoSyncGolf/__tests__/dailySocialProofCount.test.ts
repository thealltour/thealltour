import { describe, expect, it } from "vitest";
import {
  getKakaoSyncDailySocialProofCount,
  getKstDateKey,
} from "@/lib/hardcodedLandings/kakaoSyncGolf/dailySocialProofCount";

describe("getKstDateKey", () => {
  it("KST 00:00 직전과 직후를 서로 다른 날짜로 계산한다", () => {
    // KST(UTC+9) 00:00 = UTC 15:00(전날)
    const justBeforeKstMidnight = new Date("2026-07-24T14:59:59.999Z");
    const atKstMidnight = new Date("2026-07-24T15:00:00.000Z");

    expect(getKstDateKey(justBeforeKstMidnight)).toBe("2026-07-24");
    expect(getKstDateKey(atKstMidnight)).toBe("2026-07-25");
  });
});

describe("getKakaoSyncDailySocialProofCount", () => {
  it("항상 75~150 범위 안의 정수를 반환한다", () => {
    for (let dayOffset = 0; dayOffset < 400; dayOffset += 1) {
      const now = new Date(Date.UTC(2026, 0, 1) + dayOffset * 24 * 60 * 60 * 1000);
      const count = getKakaoSyncDailySocialProofCount(now);
      expect(Number.isInteger(count)).toBe(true);
      expect(count).toBeGreaterThanOrEqual(75);
      expect(count).toBeLessThanOrEqual(150);
    }
  });

  it("같은 KST 날짜 안에서는 항상 동일한 값을 반환한다", () => {
    const morning = new Date("2026-07-24T00:00:00.000Z"); // KST 09:00
    const night = new Date("2026-07-24T14:59:59.999Z"); // KST 23:59:59.999 (같은 KST 날짜)

    const morningCount = getKakaoSyncDailySocialProofCount(morning);
    const nightCount = getKakaoSyncDailySocialProofCount(night);

    expect(morningCount).toBe(nightCount);
  });

  it("KST 00:00를 지나면 값이 바뀔 수 있고, 여러 날에 걸쳐 값이 고정되지 않는다", () => {
    const beforeMidnight = new Date("2026-07-24T14:59:59.999Z");
    const afterMidnight = new Date("2026-07-24T15:00:00.000Z");

    // 날짜가 바뀌면 재계산되는지(동일한 함수 호출로 매번 새로 파생되는지) 확인.
    expect(getKakaoSyncDailySocialProofCount(beforeMidnight)).toBe(
      getKakaoSyncDailySocialProofCount(new Date("2026-07-24T00:00:00.000Z")),
    );
    expect(getKakaoSyncDailySocialProofCount(afterMidnight)).toBe(
      getKakaoSyncDailySocialProofCount(new Date("2026-07-25T00:00:00.000Z")),
    );

    // 30일 연속 값 중 값이 다양하게 분포하는지(항상 같은 상수가 아닌지) 확인.
    const uniqueValues = new Set<number>();
    for (let dayOffset = 0; dayOffset < 30; dayOffset += 1) {
      const now = new Date(Date.UTC(2026, 0, 1) + dayOffset * 24 * 60 * 60 * 1000);
      uniqueValues.add(getKakaoSyncDailySocialProofCount(now));
    }
    expect(uniqueValues.size).toBeGreaterThan(1);
  });

  it("동일한 입력에 대해 결정론적이다(같은 Date를 두 번 계산해도 같은 값)", () => {
    const now = new Date("2026-08-15T05:00:00.000Z");
    expect(getKakaoSyncDailySocialProofCount(now)).toBe(getKakaoSyncDailySocialProofCount(now));
  });
});
