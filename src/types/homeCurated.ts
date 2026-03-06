import type { Product } from "@/types/product";

export type HomeCuratedSettings = {
  id: string;
  setting_key: string;
  section_label: string;
  section_title: string;
  section_description: string;
  catalog_button_label: string;
  catalog_button_href: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type HomeCuratedSection = {
  id: string;
  setting_id: string;
  title: string;
  description: string;
  sort_order: number;
  max_items: number;
  is_active: boolean;
  created_at?: string;
};

/** Admin API: section with product count */
export type HomeCuratedSectionWithCount = HomeCuratedSection & {
  product_count: number;
};

export type HomeCuratedSectionProduct = {
  id: string;
  section_id: string;
  product_id: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
};

/** Admin API: mapping row with product detail */
export type SectionProductMappingRow = HomeCuratedSectionProduct & {
  product: Product | null;
};

export type HomeCuratedSectionWithProducts = HomeCuratedSection & {
  products: Product[];
};

export type HomeCuratedData = {
  settings: HomeCuratedSettings | null;
  sections: HomeCuratedSectionWithProducts[];
};
