export type HomeBanner = {
  id: string;
  title: string;
  image_url: string;
  mobile_image_url?: string | null;
  link_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
  created_at?: string | null;
};
