export type Review = {
  id: string;
  member_id?: string;
  title: string;
  content: string;
  image_url?: string;
  image_urls?: string[];
  author_name: string;
  created_at?: string;
  rating?: number;
};
