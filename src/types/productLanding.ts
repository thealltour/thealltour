/**
 * 랜딩 페이지용 타입 (region/theme).
 * 후속 PR에서 실제 랜딩 UI가 이 shape를 소비.
 */

export type ProductLandingType = "region" | "theme";

export type ProductLandingHero = {
  eyebrow: string;
  title: string;
  description: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
};

export type ProductLandingFeaturedLink = {
  key: string;
  label: string;
  href: string;
};

export type ProductLandingProductSummary = {
  id: string;
  title: string;
  imageUrl?: string | null;
  description?: string | null;
  price?: string | number | null;
  href: string;
  categories?: string[];
  themes?: string[];
};

export type ProductLandingData = {
  type: ProductLandingType;
  slug: string;
  taxonomyName: string;
  taxonomySlug: string | null;
  hero: ProductLandingHero;
  featuredLinks: ProductLandingFeaturedLink[];
  recommendedProducts: ProductLandingProductSummary[];
  relatedTaxonomies: ProductLandingFeaturedLink[];
  productCount: number;
};
