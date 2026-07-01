import { describe, expect, it } from "vitest";
import { deserializeAdminProductToForm } from "@/components/admin/products/editor/adminProductForm.deserializer";
import type { Product } from "@/types/product";

describe("deserializeAdminProductToForm departure schedules", () => {
  it("hydrates form rows from raw departure_schedules_json when departureSchedules is absent", () => {
    const raw = {
      id: "p1",
      title: "테스트 상품",
      description: "설명",
      image_url: "https://example.com/a.jpg",
      category: "여행상품",
      departure_schedules_json: [
        { departureDate: "2025-07-23", price: 890000, label: "7/23(수)" },
        { departureDate: "2025-07-30", price: 920000 },
      ],
    } as Product & { departure_schedules_json: unknown };

    const form = deserializeAdminProductToForm(raw);

    expect(form.departure_schedules).toHaveLength(2);
    expect(form.departure_schedules[0]).toMatchObject({
      departureDate: "2025-07-23",
      price: "890,000",
      label: "7/23(수)",
    });
    expect(form.departure_schedules[1]).toMatchObject({
      departureDate: "2025-07-30",
      price: "920,000",
    });
  });
});
