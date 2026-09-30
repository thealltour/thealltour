import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { parseHomeGolfTourProductIds } from "@/lib/siteSettings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const HOME_GOLF_TOUR_KEY = "home_golf_tour_product_ids";
const SITE_SETTINGS_TAG = "site-settings";

export type RemoveProductFromHomePlacementsResult = {
  removedFromGolfTour: boolean;
  removedFromCurated: number;
  errors: string[];
};

export function revalidateHomePlacementCaches(): void {
  revalidateTag(SITE_SETTINGS_TAG, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.HOME_CURATED, REVALIDATE_MAX);
  revalidatePath("/");
}

/**
 * home_golf_tour_product_ids is a JSON string in site_settings with no FK,
 * so a deleted product id stays there until removed explicitly.
 */
export async function removeProductFromHomePlacements(
  productId: string,
): Promise<RemoveProductFromHomePlacementsResult> {
  const id = productId.trim();
  const result: RemoveProductFromHomePlacementsResult = {
    removedFromGolfTour: false,
    removedFromCurated: 0,
    errors: [],
  };
  if (!id) return result;

  const settingRow = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", HOME_GOLF_TOUR_KEY)
    .maybeSingle();

  if (settingRow.error) {
    result.errors.push(`골프투어 설정 조회 실패: ${settingRow.error.message}`);
  } else {
    const raw = typeof settingRow.data?.value === "string" ? settingRow.data.value : "";
    const ids = parseHomeGolfTourProductIds({ home_golf_tour_product_ids: raw });
    if (ids.includes(id)) {
      const next = ids.filter((value) => value !== id);
      const upsert = await supabaseAdmin
        .from("site_settings")
        .upsert({ key: HOME_GOLF_TOUR_KEY, value: JSON.stringify(next) }, { onConflict: "key" });
      if (upsert.error) {
        result.errors.push(`골프투어 설정 저장 실패: ${upsert.error.message}`);
      } else {
        result.removedFromGolfTour = true;
      }
    }
  }

  const curated = await supabaseAdmin
    .from("home_curated_section_products")
    .delete()
    .eq("product_id", id)
    .select("id");

  if (curated.error) {
    result.errors.push(`메인 추천상품 매핑 삭제 실패: ${curated.error.message}`);
  } else {
    result.removedFromCurated = Array.isArray(curated.data) ? curated.data.length : 0;
  }

  revalidateHomePlacementCaches();
  return result;
}
