import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/types/product";

const deleteByUrls = vi.fn();
vi.mock("@/lib/storage/deleteSupabaseStorageByPublicUrls", () => ({
  deleteSupabaseStorageByPublicUrls: (urls: string[]) => deleteByUrls(urls),
}));

import {
  deleteProductSupabaseImages,
  excludeSharedImageUrls,
} from "@/lib/admin/deleteProductSupabaseImages";

const base = "https://qmswixmwquuazrhfyils.supabase.co/storage/v1/object/public/product-images";
const shared = `${base}/shared-gallery.webp`;
const ownOnly = `${base}/incheon-only.webp`;

function product(id: string, overrides: Partial<Product> = {}): Product {
  return {
    id,
    title: id,
    description: "",
    image_url: shared,
    category: "여행상품",
    ...overrides,
  };
}

describe("deleteProductSupabaseImages", () => {
  beforeEach(() => {
    deleteByUrls.mockReset();
    deleteByUrls.mockResolvedValue({ deletedPaths: [], skippedUrls: [], errors: [] });
  });

  it("keeps urls still used by a departure sibling", async () => {
    const incheon = product("incheon", { images_json: [shared, ownOnly] });
    const busan = product("busan", { images_json: [shared] });

    await deleteProductSupabaseImages(incheon, { sharedWith: [busan] });

    expect(deleteByUrls).toHaveBeenCalledWith([ownOnly]);
  });

  it("skips the storage call when every url is shared", async () => {
    const incheon = product("incheon", { images_json: [shared] });
    const busan = product("busan", { images_json: [shared] });

    const result = await deleteProductSupabaseImages(incheon, { sharedWith: [busan] });

    expect(deleteByUrls).not.toHaveBeenCalled();
    expect(result.deletedPaths).toEqual([]);
  });

  it("deletes everything when there are no siblings", async () => {
    await deleteProductSupabaseImages(product("solo", { images_json: [shared, ownOnly] }));
    expect(deleteByUrls).toHaveBeenCalledWith(expect.arrayContaining([shared, ownOnly]));
  });

  it("excludeSharedImageUrls is a no-op without siblings", () => {
    expect(excludeSharedImageUrls([shared], [])).toEqual([shared]);
  });
});
