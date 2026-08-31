import { NextResponse } from "next/server";
import { getProductSuggestionItems } from "@/lib/products/productSuggestions";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q") ?? "";
  const suggestions = await getProductSuggestionItems(rawQuery);
  return NextResponse.json({ suggestions });
}
