import { TaxonomyOgCard, type TaxonomyOgCardProps } from "@/components/seo/TaxonomyOgCard";

export type RecommendedLandingOgCardProps = Omit<TaxonomyOgCardProps, "variant" | "footerCtaLabel">;

/** `/recommended/[slug]` 공개 랜딩 OG — 하단 CTA 배지 없이 간결하게 */
export function RecommendedLandingOgCard(props: RecommendedLandingOgCardProps) {
  return <TaxonomyOgCard variant="recommended" footerCtaLabel={null} {...props} />;
}
