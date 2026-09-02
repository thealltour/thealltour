import Link from "next/link";
import { assertDevRoutesEnabled } from "@/lib/dev/assertDevRoutesEnabled";
import {
  getProductsPage,
  PRODUCT_LIST_PAGE_SIZE_MAX,
} from "@/lib/products/productListingQuery";
import DevProductCardV2Grid from "@/components/dev/DevProductCardV2Grid";

export default async function DevProductsPage() {
  assertDevRoutesEnabled();

  const { items } = await getProductsPage({
    page: 1,
    pageSize: PRODUCT_LIST_PAGE_SIZE_MAX,
  });

  return (
    <div className="min-h-screen page-bg-wash px-6 py-10">
      <main className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href="/products"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ← 상품 목록(기존 UI)
          </Link>
        </div>
        <DevProductCardV2Grid products={items} />
      </main>
    </div>
  );
}
