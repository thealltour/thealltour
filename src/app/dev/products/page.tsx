import Link from "next/link";
import { getProducts } from "@/lib/products";
import DevProductCardV2Grid from "@/components/dev/DevProductCardV2Grid";

export default async function DevProductsPage() {
  const products = await getProducts();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white px-6 py-10">
      <main className="mx-auto max-w-6xl">
        <div className="mb-6">
          <Link
            href="/products"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            ← 상품 목록(기존 UI)
          </Link>
        </div>
        <DevProductCardV2Grid products={products} />
      </main>
    </div>
  );
}
