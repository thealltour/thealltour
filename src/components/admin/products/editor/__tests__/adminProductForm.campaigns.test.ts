import { describe, expect, it } from "vitest";
import {
  parseCampaignsFormString,
  stringifyCampaignsFormList,
} from "@/components/admin/products/editor/adminProductForm.helpers";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";
import { createEmptyProductFormState } from "@/types/adminProductForm";

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
