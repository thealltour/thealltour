import { NextResponse } from "next/server";
import { getProducts } from "@/lib/products";

const MAX_SUGGESTIONS = 8;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return NextResponse.json({ suggestions: [] });
  }

  const products = await getProducts();

  const suggestions = products
    .filter((product) => {
      const title = product.title.toLowerCase();
      const description = product.description.toLowerCase();
      const category = product.category.toLowerCase();
      const theme = (product.theme ?? "").toLowerCase();

      return (
        title.includes(query) ||
        description.includes(query) ||
        category.includes(query) ||
        theme.includes(query)
      );
    })
    .slice(0, MAX_SUGGESTIONS)
    .map((product) => ({
      id: product.id,
      title: product.title,
      category: product.category,
      theme: product.theme ?? "",
    }));

  return NextResponse.json({ suggestions });
}
