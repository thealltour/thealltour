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
  // Notion 연동 필드
  slug?: string | null;
  notion_page_id?: string | null;
  notion_url?: string | null;
  title_override?: string | null;
  cover_image_url?: string | null;
  tags?: string[] | null;
  category?: string | null;
  published_at?: string | null;
  /** 랜딩 연결: destination taxonomy id (product_taxonomies.id, taxonomy_type=destination) */
  destination_id?: string | null;
  /** 랜딩 연결: theme taxonomy id (product_taxonomies.id, taxonomy_type=theme) */
  theme_id?: string | null;
  /** 카드 뱃지용: destination_id로 조회한 지역명. API에서 채움 */
  destination_name?: string | null;
  /** 카드 뱃지용: theme_id로 조회한 테마명. API에서 채움 */
  theme_name?: string | null;
  notion_last_edited_time?: string | null;
  last_synced_at?: string | null;
  // SEO 필드
  seo_title?: string | null;
  seo_description?: string | null;
  focus_keyword?: string | null;
};

