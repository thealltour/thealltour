import { describe, expect, it } from "vitest";
import { parseEventsFromHanatourPanel } from "../itineraryDomHanatour";
import {
  collectProductGalleryUrls,
  PRODUCT_GALLERY_MAX,
} from "../images";
import {
  countRealEvents,
  shouldSkipTextMerge,
  PLACEHOLDER_EVENT_TITLE,
} from "../mergeItineraryEvents";

const BASE = "https://www.hanatour.com/trp/pkg/test";

function buildDay2Fixture(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <h3>2일차 11/27(금) 양삭</h3>
    <div class="flex items-stretch justify-start space-x-[6px]">
      <div class="w-[calc(100%_-_24px)]">
        <div class="text-[17px] font-semibold"><div>조식 (호텔식)</div></div>
      </div>
    </div>
    <div class="py-4 px-4 border rounded rounded-[10px]">
      <div class="text-[15px] font-semibold">상비산</div>
      <div class="text-[13px]">코끼리 코 모양의 유명한 산입니다.</div>
      <a href="#">상세보기</a>
      <img src="https://image8.hanatour.com/pkg/test1.jpg" alt="상비산" />
    </div>
    <div class="py-4 px-4 border rounded rounded-[10px]">
      <div class="text-[15px] font-semibold">첩채산</div>
      <div class="text-[13px]">계림 시내를 한눈에 내려다 볼 수 있는 곳</div>
      <a href="#">상세보기</a>
    </div>
  `;
  return root;
}

function buildDay1WithHotelAndLocationsFixture(): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `
    <h3>1일차 11/26(목)</h3>
    <div class="py-4 px-4 border rounded rounded-[10px]">
      <div class="text-[15px] font-semibold">호텔</div>
      <div class="text-[13px]">계림/양강/만다린 호텔 또는 동급</div>
    </div>
    <div class="py-4 px-4 border rounded rounded-[10px]">
      <div class="text-[15px] font-semibold">식사</div>
      <div class="text-[13px]">조식-호텔식, 중식-현지식, 석식-현지식</div>
    </div>
    <div class="flex items-stretch justify-start space-x-[6px]">
      <div class="w-[calc(100%_-_24px)]">
        <div class="text-[17px] font-semibold"><div>대구</div></div>
      </div>
    </div>
    <div class="flex items-stretch justify-start space-x-[6px]">
      <div class="w-[calc(100%_-_24px)]">
        <div class="text-[13px]">석식 (기내-불포함(유료제공))</div>
      </div>
    </div>
    <div class="flex items-stretch justify-start space-x-[6px]">
      <div class="w-[calc(100%_-_24px)]">
        <div class="text-[17px] font-semibold"><div>계림</div></div>
      </div>
    </div>
    <div class="flex items-stretch justify-start space-x-[6px]">
      <div class="w-[calc(100%_-_24px)]">
        <div class="text-[13px]">계림공항 입국장 통과 후 가이드 미팅</div>
      </div>
    </div>
    <div class="py-4 px-4 border rounded rounded-[10px]">
      <div class="text-[15px] font-semibold">상비산</div>
      <div class="text-[13px]">관광지 설명</div>
      <a href="#">상세보기</a>
    </div>
  `;
  return root;
}

function buildGalleryFixture(slideCount: number): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = `<span>1/${slideCount}</span>`;
  const wrapper = document.createElement("div");
  wrapper.className = "swiper-wrapper";
  for (let i = 0; i < slideCount; i++) {
    const slide = document.createElement("div");
    slide.className = "swiper-slide";
    const img = document.createElement("img");
    img.src = `https://image8.hanatour.com/pkg/gallery-${i}.jpg`;
    slide.appendChild(img);
    wrapper.appendChild(slide);
  }
  root.appendChild(wrapper);
  return root;
}

describe("parseEventsFromHanatourPanel", () => {
  it("extracts meal + attraction cards without line explosion", () => {
    const panel = buildDay2Fixture();
    const { events, parserStrategy } = parseEventsFromHanatourPanel(panel, BASE);

    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events.length).toBeLessThanOrEqual(15);
    expect(parserStrategy).not.toBe("lineFallback");

    const titles = events.map((e) => e.title);
    expect(titles.some((t) => /조식/.test(t ?? ""))).toBe(true);
    expect(titles).toContain("상비산");
    expect(titles).toContain("첩채산");
  });

  it("keeps hotel/meal AND location/sightseeing when section blocks exist", () => {
    const panel = buildDay1WithHotelAndLocationsFixture();
    const { events, eventSourceCounts } = parseEventsFromHanatourPanel(panel, BASE);
    const titles = events.map((e) => e.title);

    expect(titles).toContain("호텔");
    expect(titles).toContain("식사");
    expect(titles).toContain("대구");
    expect(titles).toContain("계림");
    expect(titles).toContain("상비산");
    expect(events.length).toBeGreaterThanOrEqual(6);
    expect(events.length).toBeLessThanOrEqual(20);
    expect((eventSourceCounts?.location ?? 0) + (eventSourceCounts?.sightseeing ?? 0)).toBeGreaterThanOrEqual(2);
  });
});

describe("collectProductGalleryUrls", () => {
  it("collects one URL per swiper slide", () => {
    const root = buildGalleryFixture(9);
    const doc = document;
    const urls = collectProductGalleryUrls(root, doc, BASE);
    expect(urls.length).toBe(9);
  });

  it("caps gallery at PRODUCT_GALLERY_MAX even with many slides", () => {
    const root = buildGalleryFixture(15);
    const urls = collectProductGalleryUrls(root, document, BASE);
    expect(urls.length).toBeLessThanOrEqual(PRODUCT_GALLERY_MAX);
    expect(urls.length).toBe(10);
  });
});

describe("shouldSkipTextMerge", () => {
  it("skips merge when DOM has enough real events", () => {
    const domDays = [
      {
        dayNumber: 1,
        events: [
          { order: 1, title: "조식" },
          { order: 2, title: "상비산" },
          { order: 3, title: "첩채산" },
        ],
      },
      {
        dayNumber: 2,
        events: [
          { order: 1, title: "조식" },
          { order: 2, title: "양강" },
        ],
      },
    ];
    const textDays = [
      {
        dayNumber: 1,
        events: Array.from({ length: 300 }, (_, i) => ({ order: i + 1, title: `line-${i}` })),
      },
    ];

    expect(countRealEvents(domDays)).toBe(5);
    expect(shouldSkipTextMerge({ domDays, textDays })).toBe(true);
  });

  it("skips merge when text parser would explode vs weak DOM", () => {
    const domDays = [
      {
        dayNumber: 1,
        events: [{ order: 1, title: PLACEHOLDER_EVENT_TITLE }],
      },
    ];
    const textDays = [
      {
        dayNumber: 1,
        events: Array.from({ length: 288 }, (_, i) => ({ order: i + 1, title: `evt-${i}` })),
      },
    ];

    expect(shouldSkipTextMerge({ domDays, textDays })).toBe(true);
  });
});
