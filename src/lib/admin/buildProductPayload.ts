/**
 * ProductFormState → API POST body (상품 생성용).
 * PR9: serializer 계층으로 통합. create/update 동일 규칙 유지.
 */

import type { ProductFormState } from "@/types/adminProductForm";
import { serializeAdminProductForm } from "@/components/admin/products/editor/adminProductForm.serializer";

export type ProductCreateBodyOverrides = {
  product_source_url?: string;
};

/**
 * 폼 상태를 API POST /api/admin/products 에 보낼 body로 변환한다.
 * 내부적으로 serializeAdminProductForm 사용. source_url 등은 overrides로 덮어쓸 수 있다.
 */
export function buildProductCreateBody(
  form: ProductFormState,
  overrides?: ProductCreateBodyOverrides,
): Record<string, unknown> {
  const formForSerialize: ProductFormState = {
    ...form,
    product_source_url:
      overrides?.product_source_url?.trim() ?? form.product_source_url?.trim() ?? "",
  };
  const payload = serializeAdminProductForm(formForSerialize, {
    unassignedImageUrls: [],
  }) as Record<string, unknown>;
  if (overrides?.product_source_url !== undefined) {
    const v = overrides.product_source_url?.trim();
    payload.product_source_url = v === "" ? undefined : v;
  }
  return payload;
}
