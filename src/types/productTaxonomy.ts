export type ProductTaxonomyType = "category" | "theme";

export type ProductTaxonomy = {
  id: string;
  type: ProductTaxonomyType;
  name: string;
  is_active: boolean;
  sort_order: number | null;
  created_at: string | null;
};

export type ProductTaxonomyWithUsage = ProductTaxonomy & {
  usageCount: number;
};
