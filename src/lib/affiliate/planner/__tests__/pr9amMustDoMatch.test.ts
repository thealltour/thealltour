import { describe, expect, it } from "vitest";
import { matchMustDoToPlanItems } from "@/lib/affiliate/planner/discovery/matchMustDoToPlanItems";
import {
  compactActivityName,
  normalizeActivityName,
} from "@/lib/affiliate/planner/discovery/normalizeActivityName";
import { lookupTiqetsVerifiedProduct } from "@/lib/affiliate/planner/providers/tiqets/tiqetsVerifiedProducts";

type Item = { order: number; type: string; name: string };

function day(dayNumber: number, items: Item[]) {
  return { day: dayNumber, items };
}

const OSAKA = { countryCode: "JP", cityEnglish: "Osaka" };

describe("PR-9AM normalizeActivityName", () => {
  it("NFKC + lowercase + punctuation to spaces, keeps bracket content", () => {
    expect(normalizeActivityName("ＵＳＪ（Universal Studios）!")).toBe("usj universal studios");
    expect(normalizeActivityName("  Osaka   Castle  ")).toBe("osaka castle");
    expect(compactActivityName("오사카성 천수각")).toBe("오사카성천수각");
  });
});

describe("PR-9AM mustDo → plan item matching", () => {
  it("exact plan name → linked intent", () => {
    const [intent] = matchMustDoToPlanItems(["오사카성"], [
      day(1, [
        { order: 1, type: "meal", name: "점심" },
        { order: 2, type: "attraction", name: "오사카성" },
      ]),
    ]);
    expect(intent).toEqual({
      requestIndex: 0,
      rawLabel: "오사카성",
      normalizedLabel: "오사카성",
      dayNumber: 1,
      itemOrder: 2,
      planItemName: "오사카성",
    });
  });

  it("whole-token containment with enough coverage → deterministic link", () => {
    const [intent] = matchMustDoToPlanItems(["오사카성"], [
      day(2, [{ order: 3, type: "attraction", name: "오사카성 천수각" }]),
    ]);
    expect(intent).toMatchObject({ dayNumber: 2, itemOrder: 3, planItemName: "오사카성 천수각" });
  });

  it("unrelated or low-coverage items → unlinked", () => {
    const intents = matchMustDoToPlanItems(["유니버설 스튜디오 재팬", "오사카"], [
      day(1, [
        { order: 1, type: "attraction", name: "도톤보리" },
        { order: 2, type: "activity", name: "오사카 야경 크루즈 투어" },
      ]),
    ]);
    for (const intent of intents) {
      expect(intent).toMatchObject({ dayNumber: null, itemOrder: null, planItemName: null });
    }
  });

  it("non activity/attraction items are never targets", () => {
    const [intent] = matchMustDoToPlanItems(["이치란 라멘"], [
      day(1, [
        { order: 1, type: "meal", name: "이치란 라멘" },
        { order: 2, type: "hotel", name: "이치란 라멘" },
      ]),
    ]);
    expect(intent?.planItemName).toBeNull();
  });

  it("several distinct containment candidates → ambiguous → unlinked", () => {
    const [intent] = matchMustDoToPlanItems(["오사카성"], [
      day(1, [
        { order: 1, type: "attraction", name: "오사카성 공원" },
        { order: 2, type: "attraction", name: "오사카성 천수각" },
      ]),
    ]);
    expect(intent?.planItemName).toBeNull();
  });

  it("keeps mustDo input order and requestIndex", () => {
    const intents = matchMustDoToPlanItems(["도톤보리", "오사카성", "없는 곳"], [
      day(1, [{ order: 1, type: "attraction", name: "오사카성" }]),
      day(2, [{ order: 1, type: "attraction", name: "도톤보리" }]),
    ]);
    expect(intents.map((i) => [i.requestIndex, i.rawLabel, i.dayNumber])).toEqual([
      [0, "도톤보리", 2],
      [1, "오사카성", 1],
      [2, "없는 곳", null],
    ]);
  });
});

describe("PR-9AM Tiqets verified catalog", () => {
  const lookup = (label: string, destination = OSAKA) =>
    lookupTiqetsVerifiedProduct({ labels: [label], destination })?.productId ?? null;

  it("USJ aliases → 1102887", () => {
    for (const alias of ["USJ", "usj", "유니버설 스튜디오 재팬", "유니버설 스튜디오 재팬 (USJ)"]) {
      expect(lookup(alias)).toBe("1102887");
    }
  });

  it("Universal Studios Japan → 1102887", () => {
    expect(lookup("Universal Studios Japan")).toBe("1102887");
  });

  it("오사카성 / 오사카성 천수각 → 1108257", () => {
    expect(lookup("오사카성")).toBe("1108257");
    expect(lookup("오사카성 천수각")).toBe("1108257");
  });

  it("Osaka Castle → 1108257", () => {
    expect(lookup("Osaka Castle")).toBe("1108257");
  });

  it("country or city conflict → null; unknown country → null", () => {
    expect(lookup("USJ", { countryCode: "SG", cityEnglish: "Singapore" })).toBeNull();
    expect(lookup("USJ", { countryCode: "JP", cityEnglish: "Tokyo" })).toBeNull();
    expect(
      lookupTiqetsVerifiedProduct({
        labels: ["USJ"],
        destination: { countryCode: null, cityEnglish: null },
      }),
    ).toBeNull();
  });

  it("unknown label → null; later labels are tried in order", () => {
    expect(lookup("Kaiyukan Aquarium")).toBeNull();
    expect(
      lookupTiqetsVerifiedProduct({ labels: [null, "모르는 곳", "Osaka Castle"], destination: OSAKA })
        ?.productId,
    ).toBe("1108257");
  });
});
