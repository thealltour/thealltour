import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: { from: mocks.from },
}));
vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  revalidatePath: mocks.revalidatePath,
  unstable_cache: (fn: unknown) => fn,
}));

import { removeProductFromHomePlacements } from "@/lib/admin/removeProductFromHomePlacements";

function mockSiteSettings(value: string | null) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: value == null ? null : { value },
    error: null,
  });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  return {
    select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })),
    upsert,
  };
}

function mockCuratedDelete(rows: { id: string }[]) {
  const select = vi.fn().mockResolvedValue({ data: rows, error: null });
  return {
    delete: vi.fn(() => ({ eq: vi.fn(() => ({ select })) })),
  };
}

describe("removeProductFromHomePlacements", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("removes the id from home golf tour ids and curated mappings", async () => {
    const settings = mockSiteSettings(JSON.stringify(["a", "gone", "b"]));
    const curated = mockCuratedDelete([{ id: "map-1" }]);
    mocks.from.mockImplementation((table: string) => {
      if (table === "site_settings") return settings;
      if (table === "home_curated_section_products") return curated;
      throw new Error(`unexpected table ${table}`);
    });

    const result = await removeProductFromHomePlacements("gone");

    expect(result).toEqual({ removedFromGolfTour: true, removedFromCurated: 1, errors: [] });
    expect(settings.upsert).toHaveBeenCalledWith(
      { key: "home_golf_tour_product_ids", value: JSON.stringify(["a", "b"]) },
      { onConflict: "key" },
    );
    expect(mocks.revalidateTag).toHaveBeenCalledWith("site-settings", "max");
    expect(mocks.revalidateTag).toHaveBeenCalledWith("home-curated", "max");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("does not rewrite settings when the id is not listed", async () => {
    const settings = mockSiteSettings(JSON.stringify(["a"]));
    const curated = mockCuratedDelete([]);
    mocks.from.mockImplementation((table: string) =>
      table === "site_settings" ? settings : curated,
    );

    const result = await removeProductFromHomePlacements("other");

    expect(result.removedFromGolfTour).toBe(false);
    expect(result.removedFromCurated).toBe(0);
    expect(settings.upsert).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("handles a missing settings row", async () => {
    const settings = mockSiteSettings(null);
    const curated = mockCuratedDelete([]);
    mocks.from.mockImplementation((table: string) =>
      table === "site_settings" ? settings : curated,
    );

    const result = await removeProductFromHomePlacements("x");
    expect(result.errors).toEqual([]);
    expect(settings.upsert).not.toHaveBeenCalled();
  });
});
