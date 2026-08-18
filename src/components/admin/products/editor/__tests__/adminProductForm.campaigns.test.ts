import { describe, expect, it } from "vitest";
import {
  parseCampaignsFormString,
  stringifyCampaignsFormList,
} from "@/components/admin/products/editor/adminProductForm.helpers";
import { deserializeAdminProductToForm } from "@/components/admin/products/editor/adminProductForm.deserializer";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";
import { createEmptyProductFormState } from "@/types/adminProductForm";
import type { Product } from "@/types/product";

describe("parseCampaignsFormString", () => {
  it("preserves campaign names with spaces and slashes", () => {
    expect(parseCampaignsFormString("신규,인기,시즌 / 특가")).toEqual([
      "신규",
      "인기",
      "시즌 / 특가",
    ]);
  });

  it("round-trips through stringifyCampaignsFormList", () => {
    const list = ["신규", "인기", "추천", "시즌 / 특가"];
    expect(parseCampaignsFormString(stringifyCampaignsFormList(list))).toEqual(list);
  });

  it("splits on comma, newline, and pipe only", () => {
    expect(parseCampaignsFormString("A|B\nC,D")).toEqual(["A", "B", "C", "D"]);
  });
});

describe("serializeAdminProductForm campaigns", () => {
  it("keeps 시즌 / 특가 as a single campaign token", () => {
    const form = {
      ...createEmptyProductFormState(),
      campaigns: "신규,인기,추천,시즌 / 특가",
    };
    const payload = serializeAdminProductForm(form);
    expect(payload.campaigns).toEqual(["신규", "인기", "추천", "시즌 / 특가"]);
  });
});

describe("serializeAdminProductForm departure schedules", () => {
  it("omits departure_schedules_json when edit load had rows but form is empty", () => {
    const form = {
      ...createEmptyProductFormState(),
      departure_schedules: [],
    };
    const payload = serializeAdminProductForm(form, {
      editingId: "prod-1",
      loadedDepartureScheduleCount: 3,
    });
    expect(payload).not.toHaveProperty("departure_schedules_json");
  });

  it("sends null when creating with empty schedules", () => {
    const form = {
      ...createEmptyProductFormState(),
      departure_schedules: [],
    };
    const payload = serializeAdminProductForm(form);
    expect(payload.departure_schedules_json).toBeNull();
  });
});

describe("admin product form package catalog", () => {
  it("serializes catalog and deserializes it back", () => {
    const form = {
      ...createEmptyProductFormState(),
      package_catalog_json: {
        hotels: [{ name: "로열 퍼시픽 호텔" }],
        attractions: [
          {
            name: "오페라하우스",
            description: "시드니 랜드마크",
            imageUrls: ["https://image.hanatour.com/opera.jpg"],
          },
        ],
        optionalTours: [],
        referenceNotes: "ETA 비자 개별 발급",
      },
    };
    const payload = serializeAdminProductForm(form);
    expect(payload.package_catalog_json).toEqual({
      hotels: [{ name: "로열 퍼시픽 호텔" }],
      attractions: [
        {
          name: "오페라하우스",
          description: "시드니 랜드마크",
          imageUrls: ["https://image.hanatour.com/opera.jpg"],
        },
      ],
      optionalTours: [],
      referenceNotes: "ETA 비자 개별 발급",
    });

    const hydrated = deserializeAdminProductToForm({
      id: "p1",
      title: "테스트",
      description: "설명",
      image_url: "https://example.com/a.jpg",
      category: "여행상품",
      package_catalog_json: payload.package_catalog_json,
    } as Product);
    expect(hydrated.package_catalog_json.hotels).toEqual([{ name: "로열 퍼시픽 호텔" }]);
    expect(hydrated.package_catalog_json.referenceNotes).toBe("ETA 비자 개별 발급");
  });

  it("serializes empty catalog as null so band products stay unset", () => {
    const payload = serializeAdminProductForm(createEmptyProductFormState());
    expect(payload.package_catalog_json).toBeNull();
  });
});
