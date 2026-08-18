import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type ExtractedBlock = {
  day: number;
  heading: string;
  description: string;
  kind?: string;
  displayRole?: string;
  imageUrls?: string[];
};

type ItineraryDomExtractApi = {
  parseBlocksFromPanel: (panel: Element, baseUrl: string, dayNumber: number) => ExtractedBlock[];
};

function loadItineraryDomExtract(): ItineraryDomExtractApi {
  const existing = (globalThis as { ItineraryDomExtract?: ItineraryDomExtractApi }).ItineraryDomExtract;
  if (existing?.parseBlocksFromPanel) return existing;
  runInThisContext(readFileSync(path.join(extDir, "itineraryDomExtract.js"), "utf8"), {
    filename: "itineraryDomExtract.js",
  });
  const api = (globalThis as { ItineraryDomExtract?: ItineraryDomExtractApi }).ItineraryDomExtract;
  if (!api?.parseBlocksFromPanel) {
    throw new Error("ItineraryDomExtract.parseBlocksFromPanel was not exported");
  }
  return api;
}

function buildHotelMealPanel(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <h3>2일차 08/28(금) 시드니</h3>
    <div class="py-4 px-4 border rounded rounded-[10px]">
      <div class="text-[15px] font-semibold">오페라하우스</div>
      <div class="text-[13px]">시드니 랜드마크 관광지입니다. 하버브리지와 함께 둘러봅니다.</div>
      <a href="#">상세보기</a>
      <img src="https://image.hanatour.com/opera.jpg" alt="오페라하우스" />
    </div>
    <div class="py-4 px-4 border rounded rounded-[10px]">
      <div class="text-[15px] font-semibold">호텔</div>
      <div class="text-[13px]">로열 퍼시픽 호텔 또는 동급</div>
    </div>
    <div class="py-4 px-4 border rounded rounded-[10px]">
      <div class="text-[15px] font-semibold">식사</div>
      <div class="text-[13px]">조식-호텔식, 중식-현지식, 석식-현지식</div>
    </div>
    <div class="flex items-stretch justify-start space-x-[6px]">
      <div class="w-[calc(100%_-_24px)]">
        <div class="text-[17px] font-semibold"><div>조식 (호텔식)</div></div>
      </div>
    </div>
    <div class="flex items-stretch justify-start space-x-[6px]">
      <div class="w-[calc(100%_-_24px)]">
        <div class="text-[17px] font-semibold"><div>항공</div></div>
      </div>
    </div>
    <div class="py-4 px-4 border rounded rounded-[10px]">
      <div class="text-[15px] font-semibold">항공</div>
      <div class="text-[13px]">OZ601 시드니 출발</div>
    </div>
  `;
  return root;
}

describe("itineraryDomExtract hotel/meal blocks", () => {
  it("collects hotel, meal, breakfast, and flight blocks instead of skipping them", () => {
    const { parseBlocksFromPanel } = loadItineraryDomExtract();
    const blocks = parseBlocksFromPanel(
      buildHotelMealPanel(),
      "https://www.hanatour.com/pkg/sydney",
      2,
    );

    const headings = blocks.map((b) => b.heading);
    expect(headings).toEqual(
      expect.arrayContaining(["오페라하우스", "호텔", "식사", "조식 (호텔식)", "항공"]),
    );

    const hotel = blocks.find((b) => b.heading === "호텔");
    const meal = blocks.find((b) => b.heading === "식사");
    const breakfast = blocks.find((b) => b.heading === "조식 (호텔식)");
    const flight = blocks.find((b) => b.heading === "항공");

    expect(hotel?.kind).toBe("other");
    expect(hotel?.displayRole).toBe("summary");
    expect(hotel?.description).toContain("로열 퍼시픽");
    expect(meal?.kind).toBe("meal");
    expect(meal?.displayRole).toBe("summary");
    expect(breakfast?.kind).toBe("meal");
    expect(breakfast?.displayRole).toBe("summary");
    expect(flight?.kind).toBe("move");
    expect(flight?.displayRole).toBe("activity");
  });
});
