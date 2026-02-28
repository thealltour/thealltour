export type Guide = {
  id: string;
  title: string;
  summary?: string;
  thumbnail_url?: string;
  landing_url?: string;
  guide_pdf_url?: string | null;
  guide_thumbnail_url?: string | null;
  is_published?: boolean;
  sort_order?: number;
  created_at?: string;
};

