import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type HotelNameItem = { name: string };
type NamedCard = { name: string; description: string; imageUrls: string[] };
type OptionalTour = {
  name: string;
  description: string;
  priceText?: string;
  imageUrls: string[];
};

type PackageCatalogExtractApi = {
  extractHotelNames: (panel: Element) => HotelNameItem[];
  extractNamedCards: (panel: Element, baseUrl: string) => NamedCard[];
  extractOptionalTours: (panel: Element, baseUrl: string) => OptionalTour[];
  extractReferenceNotes: (panel: Element) => string | undefined;
};

function loadPackageCatalogExtract(): PackageCatalogExtractApi {
  const existing = (globalThis as { PackageCatalogExtract?: PackageCatalogExtractApi })
    .PackageCatalogExtract;
  if (existing?.extractHotelNames) return existing;
  runInThisContext(readFileSync(path.join(extDir, "packageCatalogExtract.js"), "utf8"), {
    filename: "packageCatalogExtract.js",
  });
  const api = (globalThis as { PackageCatalogExtract?: PackageCatalogExtractApi })
    .PackageCatalogExtract;
  if (!api?.extractHotelNames) {
    throw new Error("PackageCatalogExtract helpers were not exported");
  }
  return api;
}

/**
 * 수동 스크래핑 체크리스트 (시드니 PAP101260827OZ3, 스페인 ESP132260901KEM):
 * - 일정 탭에 조식·호텔 summary 카드
 * - 예정 호텔 이름 N개
 * - 관광지 사진·설명
 * - 선택관광 요금·사진
 * - 여행후기·외교부 해외안전정보 없음
 */
describe("packageCatalogExtract product-only catalog", () => {
  it("collects hotel names only and skips section labels", () => {
    const { extractHotelNames } = loadPackageCatalogExtract();
    const panel = document.createElement("div");
    panel.innerHTML = `
      <a>(시드니) 로열 퍼시픽 호텔</a>
      <a>(시드니) 홀리데이 인 달링하버</a>
      <a>호텔정보</a>
      <strong>예정 호텔</strong>
      <a>상세보기</a>
    `;
    expect(extractHotelNames(panel).map((h) => h.name)).toEqual([
      "(시드니) 로열 퍼시픽 호텔",
      "(시드니) 홀리데이 인 달링하버",
    ]);
  });

  it("collects attraction cards with photos", () => {
    const { extractNamedCards } = loadPackageCatalogExtract();
    const panel = document.createElement("div");
    panel.innerHTML = `
      <div class="py-4 px-4 border rounded rounded-[10px]">
        <div class="font-semibold">오페라하우스</div>
        <p>시드니 하버의 랜드마크입니다. 공연과 건축을 함께 감상합니다.</p>
        <a href="#">상세보기</a>
        <img src="https://image.hanatour.com/opera.jpg" alt="오페라하우스" />
      </div>
    `;
    const cards = extractNamedCards(panel, "https://www.hanatour.com/");
    expect(cards[0]).toMatchObject({
      name: "오페라하우스",
      imageUrls: ["https://image.hanatour.com/opera.jpg"],
    });
    expect(cards[0].description).toContain("랜드마크");
  });

  it("collects optional tour price text", () => {
    const { extractOptionalTours } = loadPackageCatalogExtract();
    const panel = document.createElement("div");
    panel.innerHTML = `
      <div class="py-4 px-4 border rounded rounded-[10px]">
        <div class="font-semibold">시드니 야경 투어</div>
        <p>하버브리지를 따라 걷는 워킹투어입니다. 이용요금 성인 AUD 70. 간단 일정 19:00 호텔 출발. 대체일정 우천 시 실내 전망대.</p>
        <a href="#">상세보기</a>
        <img src="https://image.hanatour.com/night.jpg" alt="야경" />
      </div>
    `;
    const tours = extractOptionalTours(panel, "https://www.hanatour.com/");
    expect(tours[0]?.name).toBe("시드니 야경 투어");
    expect(tours[0]?.priceText).toMatch(/AUD 70/);
    expect(tours[0]?.imageUrls).toContain("https://image.hanatour.com/night.jpg");
  });

  it("keeps product-only notes and drops reviews, MOFA, and generic terms", () => {
    const { extractReferenceNotes } = loadPackageCatalogExtract();
    const panel = document.createElement("div");
    panel.innerHTML = `
      <p>출국 전 준비물은 선크림과 편한 신발입니다. 쇼핑 횟수는 1회이며 ETA 비자는 개별 발급입니다.</p>
      <p>여권에 낙서가 있으면 입국이 거부될 수 있습니다. 하나투어 법인계좌로만 입금해 주세요. 결제 안내를 꼭 확인하세요.</p>
      <p>외교부 해외안전정보 www.0404.go.kr 를 확인하시고 여행 금지국은 방문하지 마세요.</p>
      <p>여행후기 게시판의 후기는 참고용이며 실제 일정과 다를 수 있습니다. 대사관 연락처를 숙지하세요.</p>
    `;
    const notes = extractReferenceNotes(panel) ?? "";
    expect(notes).toContain("출국 전 준비물");
    expect(notes).toContain("ETA");
    expect(notes).not.toContain("여권에 낙서");
    expect(notes).not.toContain("법인계좌");
    expect(notes).not.toContain("외교부");
    expect(notes).not.toContain("여행후기");
  });
});
