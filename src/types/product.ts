export type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  category: string;
  theme?: string;
  price?: number;
  duration?: string;
  itinerary?: string;
  inclusions?: string;
  is_active?: boolean;
  is_featured_home?: boolean;
  sort_order?: number;
  created_at?: string;
};
