export type MobileGolfAdLandingRow = {
  id: string;
  title: string;
  slug: string;
  hero_image_url: string;
  benefit_text: string;
  trust_action_text: string;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
  updated_at: string;
};

export type MobileGolfAdLanding = {
  id: string;
  title: string;
  slug: string;
  heroImageUrl: string;
  benefitText: string;
  trustActionText: string;
  isPublished: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobileGolfAdLandingInput = {
  title: string;
  slug: string;
  heroImageUrl: string;
  benefitText: string;
  trustActionText: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type MobileGolfAdLandingListItem = Pick<
  MobileGolfAdLanding,
  "id" | "title" | "slug" | "isPublished" | "updatedAt"
>;

export function mapMobileGolfAdLandingRow(row: MobileGolfAdLandingRow): MobileGolfAdLanding {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    heroImageUrl: row.hero_image_url,
    benefitText: row.benefit_text,
    trustActionText: row.trust_action_text,
    isPublished: row.is_published,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildMobileGolfAdPublicPath(slug: string): string {
  return `/golf/ads/${slug.trim()}`;
}

export function resolveMobileGolfAdSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://thealltour.com";
  return raw.replace(/\/$/, "");
}

export function buildMobileGolfAdPublicUrl(slug: string, withUtm = true): string {
  const origin = resolveMobileGolfAdSiteOrigin();
  const path = buildMobileGolfAdPublicPath(slug);
  if (!withUtm) return `${origin}${path}`;
  const params = new URLSearchParams({
    utm_source: "kakao",
    utm_medium: "bizboard",
    utm_campaign: slug.trim(),
  });
  return `${origin}${path}?${params.toString()}`;
}
