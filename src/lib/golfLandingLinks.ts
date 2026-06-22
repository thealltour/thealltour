import "server-only";

import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { CACHE_TAGS } from "@/lib/cacheTags";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

export type PublishedGolfDestinationLanding = {
  id: string;
  title: string;
  slug: string;
  href: string;
  destinationId: string | null;
  destinationSlug: string | null;
  destinationName: string | null;
};

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

export function buildGolfDestinationLandingSlug(rootSlug: string): string {
  const root = normalizeSlug(rootSlug);
  if (!root) return "";
  return root.endsWith("-golf-travel") ? root : `${root}-golf-travel`;
}

export function buildGolfDestinationLandingHref(slug: string): string {
  const normalized = normalizeSlug(slug);
  return normalized ? `/recommended/${encodeURIComponent(normalized)}` : "/recommended";
}

async function loadPublishedGolfDestinationLandingsUncached(): Promise<PublishedGolfDestinationLanding[]> {
  try {
    const { data, error } = await supabase
      .from("home_curated_sections")
      .select("id, title, slug, landing_enabled, template_type, source_taxonomy_id, source_taxonomy_slug")
      .eq("is_active", true)
      .eq("landing_enabled", true)
      .eq("template_type", "destination_golf_consulting")
      .order("title", { ascending: true });
    if (error) {
      console.error("[golfLandingLinks] published landings query failed:", error.message);
      return [];
    }

    return (data ?? [])
      .map((row) => {
        const r = row as Record<string, unknown>;
        const slug = typeof r.slug === "string" ? r.slug.trim() : "";
        if (!slug) return null;
        const item: PublishedGolfDestinationLanding = {
          id: String(r.id ?? ""),
          title: typeof r.title === "string" ? r.title : slug,
          slug,
          href: buildGolfDestinationLandingHref(slug),
          destinationId: typeof r.source_taxonomy_id === "string" ? r.source_taxonomy_id : null,
          destinationSlug: typeof r.source_taxonomy_slug === "string" ? r.source_taxonomy_slug : null,
          destinationName: null,
        };
        return item;
      })
      .filter((item): item is PublishedGolfDestinationLanding => item != null);
  } catch (err) {
    console.error("[golfLandingLinks] published landings load error:", err);
    return [];
  }
}

export async function getPublishedGolfDestinationLandings(): Promise<PublishedGolfDestinationLanding[]> {
  return unstable_cache(loadPublishedGolfDestinationLandingsUncached, ["published-golf-destination-landings"], {
    tags: [CACHE_TAGS.HOME_CURATED, CACHE_TAGS.PRODUCTS],
    revalidate: 120,
  })();
}

export async function getGolfDestinationLandingHrefByDestinationId(
  destinationId: string | null | undefined,
): Promise<string | null> {
  const id = destinationId?.trim();
  if (!id) return null;
  const landings = await getPublishedGolfDestinationLandings();
  const match = landings.find((item) => item.destinationId?.trim() === id);
  return match?.href ?? null;
}

export async function getGolfDestinationLandingHrefForTaxonomy(
  destination: Pick<ProductTaxonomy, "id" | "slug" | "name">,
): Promise<string | null> {
  const landings = await getPublishedGolfDestinationLandings();
  const id = destination.id?.trim();
  const slug = normalizeSlug(destination.slug ?? destination.name ?? "");
  const match =
    landings.find((item) => item.destinationId?.trim() === id) ??
    landings.find((item) => item.destinationSlug && normalizeSlug(item.destinationSlug) === slug);
  return match?.href ?? null;
}

/** destination root slug로 published 골프 랜딩 href (없으면 null) */
export async function getGolfDestinationLandingHrefByRootSlug(
  rootSlug: string,
): Promise<string | null> {
  const target = buildGolfDestinationLandingSlug(rootSlug);
  if (!target) return null;
  const landings = await getPublishedGolfDestinationLandings();
  const match = landings.find((item) => normalizeSlug(item.slug) === target);
  return match?.href ?? null;
}
