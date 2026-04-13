import { TaxonomyOgCard, type TaxonomyOgCardProps } from "@/components/seo/TaxonomyOgCard";

export type ThemeOgCardProps = Omit<TaxonomyOgCardProps, "variant">;

export function ThemeOgCard(props: ThemeOgCardProps) {
  return <TaxonomyOgCard variant="theme" {...props} />;
}
