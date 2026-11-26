import { describe, expect, it } from "vitest";
import { buildProductHeroFacts } from "@/lib/products/buildProductHeroFacts";
import type { Product } from "@/types/product";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    title: "테스트",
    description: "",
    image_url: "",
    category: "package",
    price: 1000000,
    ...overrides,
  } as Product;
}

describe("buildProductHeroFacts", () => {
  it("여행기간·출발·항공을 우선 표시한다", () => {
    const facts = buildProductHeroFacts(
      baseProduct({
        duration: "3박 5일",
        departure: "인천",
        airline: "대한항공",
        min_departure_people: "2인 이상",
      }),
    );
    expect(facts.map((f) => f.label)).toEqual(
      expect.arrayContaining(["여행기간", "출발", "항공", "출발 조건"]),
    );
  });

  it("골프 상품은 홀·그린피 라인을 우선한다", () => {
    const facts = buildProductHeroFacts(
      baseProduct({
        category: "golf-park",
        duration: "3박 5일",
        golf_course_info: "18홀 라운드\n그린피·카트·캐디 포함",
      }),
    );
    expect(facts.some((f) => f.label === "라운드" && /18홀/.test(f.value))).toBe(true);
    expect(facts.some((f) => f.label === "그린피·카트·캐디")).toBe(true);
  });

  it("패키지는 자유시간·쇼핑·선택관광이 있으면 포함한다", () => {
    const facts = buildProductHeroFacts(
      baseProduct({
        description: "오후 자유시간 제공\n시내 쇼핑 일정\n선택관광 가능",
      }),
    );
    expect(facts.some((f) => f.label === "자유시간")).toBe(true);
    expect(facts.some((f) => f.label === "쇼핑")).toBe(true);
    expect(facts.some((f) => f.label === "선택관광")).toBe(true);
  });
});
