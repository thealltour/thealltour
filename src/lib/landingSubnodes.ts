import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cacheTags";
import { buildProductsFilterHref } from "@/lib/productFilters";
import type {
  LandingSubnode,
  LandingParentKind,
  LandingSubnodeFilterPayload,
} from "@/types/landingSubnode";

const ALLOWED_QUERY_KEYS = [
  "destination",
  "city",
  "region",
  "theme",
  "q",
  "tourType",
  "sort",
  "style",
] as const;

function normalizeFilterPayload(raw: unknown): LandingSubnodeFilterPayload {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: LandingSubnodeFilterPayload = {};
  for (const key of ALLOWED_QUERY_KEYS) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) out[key] = v.trim();
  }
  return out;
}

function mapRow(row: Record<string, unknown>): LandingSubnode {
  const fp = row.filter_payload;
  return {
    id: String(row.id ?? ""),
    parent_kind: (row.parent_kind as LandingParentKind) ?? "destination",
    parent_slug: String(row.parent_slug ?? ""),
    node_type: (row.node_type as LandingSubnode["node_type"]) ?? "custom",
    title: String(row.title ?? ""),
    slug: String(row.slug ?? ""),
    description:
      typeof row.description === "string" && row.description.trim()
        ? row.description.trim()
        : null,
    image_url:
      typeof row.image_url === "string" && row.image_url.trim()
        ? row.image_url.trim()
        : null,
    badge_label:
      typeof row.badge_label === "string" && row.badge_label.trim()
        ? row.badge_label.trim()
        : null,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
    is_active: row.is_active === true,
    filter_payload: normalizeFilterPayload(fp),
    created_at:
      typeof row.created_at === "string" ? row.created_at : null,
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

/**
 * 상세 랜딩별 활성 하위 탐색 노드 목록 조회.
 * parent_kind + parent_slug 로 필터, sort_order 순.
 */
export async function getLandingSubnodes(
  parentKind: LandingParentKind,
  parentSlug: string,
): Promise<LandingSubnode[]> {
  const normalized = parentSlug.trim().toLowerCase().replace(/\s+/g, "-");
  if (!normalized) return [];

  return unstable_cache(
    async () => {
      const { data, error } = await supabase
        .from("landing_subnodes")
        .select("*")
        .eq("parent_kind", parentKind)
        .eq("parent_slug", normalized)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true });

      if (error) return [];
      return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
    },
    ["landing-subnodes", parentKind, normalized],
    { revalidate: 120, tags: [CACHE_TAGS.LANDING_SUBNODES] },
  )();
}

/**
 * 하위 노드 카드 클릭 시 이동 URL.
 * filter_payload 를 buildProductsFilterHref 로 전달해 /products?destination=...&city=... 등 생성.
 */
export function getLandingSubnodeHref(filterPayload: LandingSubnodeFilterPayload): string {
  return buildProductsFilterHref({
    destination: filterPayload.destination,
    city: filterPayload.city,
    theme: filterPayload.theme,
    region: filterPayload.region,
    q: filterPayload.q,
    sort: filterPayload.sort ?? null,
    tourType: filterPayload.tourType ?? null,
  });
}
