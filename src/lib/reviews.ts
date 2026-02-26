import { supabase } from "@/lib/supabase";
import type { Review } from "@/types/review";

function normalizeReview(row: Record<string, unknown>): Review {
  const imageUrls = Array.isArray(row.image_urls)
    ? row.image_urls.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const legacyImageUrl = typeof row.image_url === "string" ? row.image_url : undefined;

  return {
    id: String(row.id ?? ""),
    member_id: typeof row.member_id === "string" ? row.member_id : undefined,
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    image_url: legacyImageUrl,
    image_urls: imageUrls.length > 0 ? imageUrls : legacyImageUrl ? [legacyImageUrl] : [],
    author_name: String(row.author_name ?? ""),
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    rating: typeof row.rating === "number" ? row.rating : undefined,
  };
}

export async function getReviews() {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return [] as Review[];
  }
  return (data ?? []).map((row) => normalizeReview(row as Record<string, unknown>));
}
