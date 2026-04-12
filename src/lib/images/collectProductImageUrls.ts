import type { Product } from "@/types/product";
import { collectProductImageEntries } from "./collectProductImageEntries";

/** URL만 필요할 때. 수집·중복 제거 규칙은 `collectProductImageEntries`와 동일합니다. */
export function collectProductImageUrls(product: Product): string[] {
  return collectProductImageEntries(product).map((e) => e.url);
}
