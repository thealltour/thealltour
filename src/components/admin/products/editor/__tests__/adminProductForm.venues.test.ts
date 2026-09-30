import { describe, expect, it } from "vitest";
import { deserializeAdminProductToForm } from "@/components/admin/products/editor/adminProductForm.deserializer";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";
import { formToPreviewProduct } from "@/lib/admin/productPreview";
import { getProductDiffSummary } from "@/lib/adminProductDiff";
import { createEmptyProductFormState } from "@/types/adminProductForm";
import type { Product } from "@/types/product";

const golf = [
  { name: "수트라하버 GC", content: "27홀", images: ["https://cdn.example.com/golf-1.webp"] },
];
const hotels = [
  { name: "마젤란 리조트", content: "오션뷰", images: ["https://cdn.example.com/hotel-1.webp"] },
  { name: "퍼시픽 호텔", content: "시내" },
];
const attractions = [
  { name: "마누칸 섬", content: "스노클링", images: ["https://cdn.example.com/attraction-1.webp"] },
];

describe("golf course / hotel / attraction venues in the admin form", () => {
  it("round-trips golf_courses_json, hotels_json and attractions_json with images", () => {
    const product = {
      id: "p1",
      title: "코타키나발루 골프",
      description: "설명",
      image_url: "https://example.com/a.jpg",
      category: "골프",
      golf_courses_json: golf,
      hotels_json: hotels,
      attractions_json: attractions,
    } as Product;

    const form = deserializeAdminProductToForm(product);
    expect(form.golf_courses_json).toEqual(golf);
    expect(form.hotels_json).toEqual(hotels);
    expect(form.attractions_json).toEqual(attractions);

    const payload = serializeAdminProductForm(form, { editingId: "p1" });
    expect(payload.golf_courses_json).toEqual(golf);
    expect(payload.hotels_json).toEqual(hotels);
    expect(payload.attractions_json).toEqual(attractions);
  });

  it("drops empty rows and saves null when nothing is left", () => {
    const form = {
      ...createEmptyProductFormState(),
      title: "상품",
      hotels_json: [{ name: "", content: "", images: [] }],
      attractions_json: [{ name: "", content: "" }],
    };
    const payload = serializeAdminProductForm(form);
    expect(payload.hotels_json).toBeNull();
    expect(payload.attractions_json).toBeNull();
  });

  it("includes venues in the editor preview product", () => {
    const form = {
      ...createEmptyProductFormState(),
      title: "상품",
      golf_courses_json: golf,
      hotels_json: [...hotels, { name: " ", content: "이름 없음" }],
      attractions_json: attractions,
    };
    const preview = formToPreviewProduct(form, "");
    expect(preview.golf_courses_json).toEqual(golf);
    expect(preview.hotels_json).toEqual(hotels);
    expect(preview.attractions_json).toEqual(attractions);
  });

  it("reports attraction changes in the save diff", () => {
    const initial = { ...createEmptyProductFormState(), title: "상품" };
    const summary = getProductDiffSummary(initial, { ...initial, attractions_json: attractions });
    const basic = summary.sections.find((section) => section.key === "basic");
    expect(basic?.items).toContain("관광 정보가 수정되었습니다.");
  });
});
