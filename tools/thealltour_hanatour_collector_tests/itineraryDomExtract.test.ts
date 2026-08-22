import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "thealltour_hanatour_collector");

type ExtractedBlock = {
  day: number;
  heading: string;
  description: string;
  kind?: string;
  imageUrls?: string[];
};

type ItineraryDomExtractApi = {
  parseBlocksFromPanel: (panel: Element, baseUrl: string, dayNumber: number) => ExtractedBlock[];
};

function loadItineraryDomExtract(): ItineraryDomExtractApi {
  delete (globalThis as { ItineraryDomExtract?: ItineraryDomExtractApi }).ItineraryDomExtract;
  runInThisContext(readFileSync(path.join(extDir, "itineraryDomExtract.js"), "utf8"), {
    filename: "itineraryDomExtract.js",
  });
  const api = (globalThis as { ItineraryDomExtract?: ItineraryDomExtractApi }).ItineraryDomExtract;
  if (!api?.parseBlocksFromPanel) {
    throw new Error("ItineraryDomExtract.parseBlocksFromPanel was not exported");
  }
  return api;
}

function buildScheduleDetailPanel(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <h3>2일차 09/02(수) 마드리드-세고비아</h3>
    <div class="schedule_detail">
      <div class="detail_group">
        <div class="detail_unit">
          <div class="unit_tit">세고비아</div>
          <div class="unit_cont">
            <div class="unit_info">
              <div class="info_section">중세의 모습을 간직한 스페인의 뿌리라 불리는 도시, 세고비아</div>
              <div class="info_section cont_box">
                <div class="thumb_thumb">
                  <ul class="img_list">
                    <li><img src="https://image.hanatour.com/segovia-1.jpg" alt="성" /></li>
                    <li><img src="https://image.hanatour.com/segovia-2.jpg" alt="광장" /></li>
                    <li><img src="https://image.hanatour.com/segovia-3.jpg" alt="대성당" /></li>
                  </ul>
                </div>
                <div class="unit_txt_area">
                  <p class="info_txt">세고비아의 역사지구는 1985년 유네스코 세계문화유산으로 등록되었습니다. 로마 수로교와 알카사르가 유명합니다.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  return root;
}

function buildCardUnitPanel(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <h3>2일차</h3>
    <div class="schedule_detail">
      <div class="card_unit_type5">
        <div class="card_inner">
          <strong>톨레도</strong>
          <div class="info_section cont_box">
            <div class="photo_area">
              <ul class="img_list">
                <li><img src="https://image.hanatour.com/toledo-1.jpg" alt="톨레도" /></li>
              </ul>
            </div>
            <div class="txt_cont txt_conts">
              <a href="#none">톨레도는 세 종교가 공존했던 역사 도시로, 구시가지 전체가 세계문화유산입니다.</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  return root;
}

describe("itineraryDomExtract schedule_detail photo+description (0.4.29)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("binds img_list URLs and unit_txt_area description to the schedule unit heading", () => {
    const { parseBlocksFromPanel } = loadItineraryDomExtract();
    const blocks = parseBlocksFromPanel(
      buildScheduleDetailPanel(),
      "https://www.hanatour.com/pkg/mes1004",
      2,
    );

    const segovia = blocks.find((b) => b.heading === "세고비아");
    expect(segovia).toBeTruthy();
    expect(segovia!.day).toBe(2);
    expect(segovia!.description).toContain("유네스코");
    expect(segovia!.imageUrls).toEqual([
      "https://image.hanatour.com/segovia-1.jpg",
      "https://image.hanatour.com/segovia-2.jpg",
      "https://image.hanatour.com/segovia-3.jpg",
    ]);
  });

  it("binds card_unit txt_cont description and photo_area images", () => {
    const { parseBlocksFromPanel } = loadItineraryDomExtract();
    const blocks = parseBlocksFromPanel(
      buildCardUnitPanel(),
      "https://www.hanatour.com/pkg/mes1004",
      2,
    );

    const toledo = blocks.find((b) => b.heading === "톨레도");
    expect(toledo).toBeTruthy();
    expect(toledo!.description).toContain("세계문화유산");
    expect(toledo!.imageUrls).toEqual(["https://image.hanatour.com/toledo-1.jpg"]);
  });

  it("keeps subject when body uses 조사 after stripped title (card_unit_type3)", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <h3>2일차</h3>
      <div class="card_unit_type3">
        <div class="div_title"><strong class="tit">로마 수도교</strong></div>
        <div class="_tit_comt_sub">
          <strong class="tit">Roman Aqueduct</strong>
          <p class="spa">유네스코 지정 세계문화유산</p>
        </div>
        <div class="info_section cont_box">
          <div class="unit_txt_area">
            <p class="info_txt">는 2000년 전에 만들어졌다는 것이 믿기지 않을 만큼 정교하고 튼튼하게 만들어진 문화재입니다.</p>
          </div>
        </div>
      </div>
    `;
    const { parseBlocksFromPanel } = loadItineraryDomExtract();
    const blocks = parseBlocksFromPanel(root, "https://www.hanatour.com/", 2);
    const aqueduct = blocks.find((b) => b.heading === "로마 수도교");
    expect(aqueduct?.description.startsWith("로마 수도교")).toBe(true);
    expect(aqueduct?.description).toContain("2000년 전");
  });

  it("collects full hotel list from link_list.img blocks", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <h3>1일차</h3>
      <div data-title="호텔" class="is_acc">
        <div id="add_hotel_0_view" class="view">
          <p>총 4개의 예정 호텔이 있습니다. 출발 3일전까지 확정되어 일정표에서 확인하실 수 있습니다.</p>
          <div class="additional_list">
            <div class="link_list img" style="background-image:url('https://image.hanatour.com/hotel-a.jpg')">
              <strong class="tit_bg">유로스타 마드리드 콩그레스</strong>
            </div>
            <div class="link_list img" style="background-image:url('https://image.hanatour.com/hotel-b.jpg')">
              <strong class="tit_bg">호텔 리젠시 마드리드</strong>
            </div>
          </div>
        </div>
      </div>
    `;
    const { parseBlocksFromPanel } = loadItineraryDomExtract();
    const blocks = parseBlocksFromPanel(root, "https://www.hanatour.com/", 1);
    const hotel = blocks.find((b) => b.heading === "호텔");
    expect(hotel?.description).toContain("총 4개의");
    expect(hotel?.description).toContain("출발 3일전");
    expect(hotel?.description).toContain("유로스타 마드리드 콩그레스");
    expect(hotel?.description).toContain("호텔 리젠시 마드리드");
    expect(hotel?.imageUrls).toEqual(
      expect.arrayContaining([
        "https://image.hanatour.com/hotel-a.jpg",
        "https://image.hanatour.com/hotel-b.jpg",
      ]),
    );
    expect(blocks.filter((b) => b.heading === "유로스타 마드리드 콩그레스")).toHaveLength(0);
  });

  it("collects hotel advisory from tit_hotel and ing cards with star ratings", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <h3>1일차</h3>
      <div class="additional_area">
        <div class="tit_hotel">
          <strong>총 <em class="point">4개</em>의 예정 호텔이 있습니다. 출발 3일전까지 확정된 일정표에서 확인하실 수 있습니다.</strong>
        </div>
        <div id="add_hotel_0_view" class="view">
          <div class="additional_list">
            <div class="link_list ing">
              <strong class="tit">유로스타 마드리드 콩그레스</strong>
              <p class="wrap_star"><span class="star_value" style="width: 80%"></span></p>
              <p class="stxt2">Eurostars Madrid Congress<a href="#">상세보기</a></p>
            </div>
            <div class="link_list ing">
              <strong class="tit">호텔 젠트랄 카스테야나 노르테</strong>
              <p class="wrap_star"><span class="star_value" style="width: 80%"></span></p>
              <p class="stxt2">Hotel Zentral Castellana Norte</p>
            </div>
          </div>
        </div>
      </div>
    `;
    const { parseBlocksFromPanel } = loadItineraryDomExtract();
    const blocks = parseBlocksFromPanel(root, "https://www.hanatour.com/", 1);
    const hotel = blocks.find((b) => b.heading === "호텔");
    expect(hotel?.description).toContain("총 4개의");
    expect(hotel?.description).toContain("출발 3일전");
    expect(hotel?.description).toContain("유로스타 마드리드 콩그레스 — 4성 — Eurostars Madrid Congress");
    expect(hotel?.description).not.toContain("상세보기");
    expect(hotel?.description).toContain("호텔 젠트랄 카스테야나 노르테 — 4성 — Hotel Zentral Castellana Norte");
    expect(blocks.filter((b) => b.heading === "유로스타 마드리드 콩그레스")).toHaveLength(0);
    expect(blocks.filter((b) => b.heading === "호텔 젠트랄 카스테야나 노르테")).toHaveLength(0);
    expect(blocks.some((b) => /총\s*\d+\s*개의/.test(b.heading) && b.heading !== "호텔")).toBe(false);
  });

  it("skips hotel marketing blurbs from product highlight tab", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <h3>1일차</h3>
      <div class="border rounded p-4">
        <strong>🏡 전 일정 4성 호텔 숙박</strong>
        <p>모든 지역 엄선된 4성 호텔 사용으로 차별화 된 호텔 투숙! 타사 예정 호텔 비교 필수!</p>
        <a href="#">상세보기</a>
      </div>
      <div class="additional_area">
        <div class="tit_hotel">
          <strong>총 <em class="point">2개</em>의 예정 호텔이 있습니다.</strong>
        </div>
        <div id="add_hotel_0_view" class="view">
          <div class="additional_list">
            <div class="link_list ing">
              <strong class="tit">테스트 호텔</strong>
              <p class="stxt2">Test Hotel</p>
            </div>
          </div>
        </div>
      </div>
    `;
    const { parseBlocksFromPanel } = loadItineraryDomExtract();
    const blocks = parseBlocksFromPanel(root, "https://www.hanatour.com/", 1);
    expect(blocks.some((b) => b.heading.includes("🏡"))).toBe(false);
    expect(blocks.some((b) => /총\s*\d+\s*개의/.test(b.heading) && b.heading !== "호텔")).toBe(false);
    expect(blocks.find((b) => b.heading === "호텔")?.description).toContain("테스트 호텔");
  });
});
