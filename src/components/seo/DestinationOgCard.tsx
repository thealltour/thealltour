import { TaxonomyOgCard, type TaxonomyOgCardProps } from "@/components/seo/TaxonomyOgCard";

export type DestinationOgCardProps = Omit<TaxonomyOgCardProps, "variant">;

export function DestinationOgCard(props: DestinationOgCardProps) {
  return <TaxonomyOgCard variant="destination" {...props} />;
}
