import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CloseProductBookingResult = {
  status: "SOLD_OUT";
  removedFromFeatured: number;
};

export class CloseProductBookingError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = "CloseProductBookingError";
    this.httpStatus = httpStatus;
  }
}

export async function closeProductBooking(productId: string): Promise<CloseProductBookingResult> {
  const id = productId.trim();
  if (!id) {
    throw new CloseProductBookingError("상품 ID가 필요합니다.", 400);
  }

  const updateResult = await supabaseAdmin
    .from("products")
    .update({ status: "SOLD_OUT" })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateResult.error) {
    throw new CloseProductBookingError(
      `예약마감 처리에 실패했습니다. (${updateResult.error.message})`,
      500,
    );
  }
  if (!updateResult.data) {
    throw new CloseProductBookingError("상품을 찾을 수 없습니다.", 404);
  }

  const deleteResult = await supabaseAdmin
    .from("home_curated_section_products")
    .delete()
    .eq("product_id", id)
    .select("id");

  if (deleteResult.error) {
    throw new CloseProductBookingError(
      `메인 추천상품 제외에 실패했습니다. (${deleteResult.error.message})`,
      500,
    );
  }

  const removedFromFeatured = Array.isArray(deleteResult.data) ? deleteResult.data.length : 0;

  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.HOME_CURATED, REVALIDATE_MAX);
  revalidatePath("/");
  revalidatePath(`/products/${id}`);
  revalidatePath("/products");

  return { status: "SOLD_OUT", removedFromFeatured };
}
