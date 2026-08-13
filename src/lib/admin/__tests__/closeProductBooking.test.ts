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
}));

import {
  closeProductBooking,
  CloseProductBookingError,
} from "@/lib/admin/closeProductBooking";

function mockProductsUpdate(result: { data: { id: string } | null; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  return {
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({ maybeSingle })),
      })),
    })),
    maybeSingle,
  };
}

function mockCuratedDelete(result: { data: { id: string }[] | null; error: { message: string } | null }) {
  const select = vi.fn().mockResolvedValue(result);
  return {
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({ select })),
    })),
    select,
  };
}

describe("closeProductBooking", () => {
  beforeEach(() => {
    mocks.from.mockReset();
    mocks.revalidateTag.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("sets SOLD_OUT and deletes featured mappings", async () => {
    const products = mockProductsUpdate({ data: { id: "prod-1" }, error: null });
    const curated = mockCuratedDelete({
      data: [{ id: "map-1" }, { id: "map-2" }],
      error: null,
    });
    mocks.from.mockImplementation((table: string) => {
      if (table === "products") return products;
      if (table === "home_curated_section_products") return curated;
      throw new Error(`unexpected table ${table}`);
    });

    const result = await closeProductBooking("prod-1");

    expect(result).toEqual({ status: "SOLD_OUT", removedFromFeatured: 2 });
    expect(products.update).toHaveBeenCalledWith({ status: "SOLD_OUT" });
    expect(curated.delete).toHaveBeenCalled();
    expect(mocks.revalidateTag).toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/products/prod-1");
  });

  it("returns removedFromFeatured 0 when product was not featured", async () => {
    const products = mockProductsUpdate({ data: { id: "prod-2" }, error: null });
    const curated = mockCuratedDelete({ data: [], error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "products") return products;
      if (table === "home_curated_section_products") return curated;
      throw new Error(`unexpected table ${table}`);
    });

    const result = await closeProductBooking("prod-2");
    expect(result).toEqual({ status: "SOLD_OUT", removedFromFeatured: 0 });
  });

  it("throws 404 when product is missing", async () => {
    const products = mockProductsUpdate({ data: null, error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "products") return products;
      throw new Error(`unexpected table ${table}`);
    });

    await expect(closeProductBooking("missing")).rejects.toMatchObject({
      name: "CloseProductBookingError",
      httpStatus: 404,
    } satisfies Partial<CloseProductBookingError>);
  });
});
