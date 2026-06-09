import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";

export type SiteSettings = {
  kakao_channel_url: string;
  instagram_url: string;
  /** 푸터 상담·채널 — 네이버 밴드. 비어 있으면 버튼 미노출 */
  naver_band_url: string;
  /** 푸터 상담·채널 — 네이버 블로그. 비어 있으면 버튼 미노출 */
  naver_blog_url: string;
  kakao_chat_url: string;
  company_name: string;
  ceo_name: string;
  address: string;
  business_reg_no: string;
  tourism_reg_no: string;
  mail_order_reg_no: string;
  main_phone: string;
  main_email: string;
  products_hero_headline: string;
  products_hero_subcopy: string;
  products_hero_regions: string;
  golf_hero_headline: string;
  golf_hero_subcopy: string;
  golf_hero_regions: string;
  /** 메인 홈 DESTINATIONS 섹션에 노출할 지역(taxonomy) id 목록. JSON 배열 문자열. 비어 있으면 허브 노출 지역 전체를 기본 순서로 사용. */
  home_region_card_ids: string;
  /** 메인 홈 지역 섹션 상단 문구: eyebrow(작은 라벨). 비어 있으면 "DESTINATIONS" 사용 */
  home_region_section_eyebrow: string;
  /** 메인 홈 지역 섹션 제목. 비어 있으면 "어디로 떠나고 싶으신가요?" 사용 */
  home_region_section_title: string;
  /** 메인 홈 지역 섹션 부제목. 비어 있으면 "지역별 여행 상품을 만나보세요." 사용 */
  home_region_section_description: string;
  /** 메인 홈 THEME 섹션에 노출할 테마(taxonomy) id 목록. JSON 배열 문자열. 비어 있으면 허브 노출 테마 전체를 기본 순서로 사용. 최대 8개. */
  home_theme_card_ids: string;
  /** 메인 홈 테마 섹션 상단 문구: eyebrow(작은 라벨). 비어 있으면 "TRAVEL THEMES" 사용 */
  home_theme_section_eyebrow: string;
  /** 메인 홈 테마 섹션 제목. 비어 있으면 "이런 여행은 어떠세요?" 사용 */
  home_theme_section_title: string;
  /** 메인 홈 테마 섹션 부제목. 비어 있으면 "테마별로 여행 상품을 둘러보세요." 사용 */
  home_theme_section_description: string;
  /**
   * /products?collection=recommend 에 노출할 기획(taxonomy_type=campaign) id 목록. JSON 배열 문자열.
   * 상품에 동일 이름이 `campaigns`로 붙어 있으면 추천 컬렉션에 포함. `is_recommend`와 OR.
   */
  products_collection_recommend_campaign_ids: string;
  /** /products?collection=popular — 동일. `is_popular`와 OR. */
  products_collection_popular_campaign_ids: string;
  about_kicker: string;
  about_title: string;
  about_paragraph1: string;
  about_paragraph2: string;
  about_cta_label: string;
  about_cta_href: string;
  /** 예약금 안내 기본 금액 (표시용) */
  deposit_amount_default: string;
  deposit_bank_name: string;
  deposit_bank_account: string;
  deposit_account_holder: string;
  /** 외부 결제링크 목록 JSON: [{ id, label, url }] */
  deposit_payment_links: string;
  /** @deprecated deposit_payment_links로 이전. DB에만 남을 수 있음 */
  deposit_payment_link?: string;
  /** 상담 SLA 안내 (분) */
  consult_sla_minutes: string;
};

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  kakao_channel_url: process.env.NEXT_PUBLIC_KAKAO_CHANNEL_URL ?? "https://pf.kakao.com",
  instagram_url: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "https://www.instagram.com/thealltour",
  naver_band_url: "",
  naver_blog_url: "",
  kakao_chat_url: process.env.NEXT_PUBLIC_KAKAO_CHAT_URL ?? "https://pf.kakao.com",
  company_name: "(주)더올투어",
  ceo_name: "김지호",
  address: "경기도 고양시 덕양구 용현로 27, 407호(행신동, 행신프라자)",
  business_reg_no: "645-88-03583",
  tourism_reg_no: "",
  mail_order_reg_no: "",
  main_phone: "",
  main_email: "thealltour@gmail.com",
  products_hero_headline:
    "패키지상품으로 원하시는 지역·예산에 맞춰 바로 상담까지 연결해 드려요.",
  products_hero_subcopy:
    "골프/패키지, 가족·지인·단체 여행까지. 관심 있는 지역과 대략적인 일정만 알려주시면, 담당자가 상품을 추려 1:1로 안내해 드립니다.",
  products_hero_regions: JSON.stringify([
    { id: "japan", label: "일본 골프·패키지", searchKeyword: "일본" },
    { id: "se-asia", label: "동남아 골프·휴양", searchKeyword: "동남아" },
    { id: "europe", label: "유럽 여행", searchKeyword: "유럽" },
    { id: "domestic", label: "국내·제주", searchKeyword: "국내" },
  ]),
  golf_hero_headline: "골프/파크골프 전문 맞춤 설계로 라운딩 동선을 깔끔하게 잡아드립니다.",
  golf_hero_subcopy:
    "선호하는 골프장, 라운딩 횟수, 동행 인원과 예산을 알려주시면, 시즌에 맞는 최적의 골프투어 코스를 추천해 드립니다.",
  golf_hero_regions: JSON.stringify([
    { id: "golf-japan", label: "일본 골프투어", searchKeyword: "일본 골프" },
    { id: "golf-se-asia", label: "동남아 골프투어", searchKeyword: "동남아 골프" },
    { id: "golf-domestic", label: "국내 골프/파크골프", searchKeyword: "국내 골프" },
  ]),
  home_region_card_ids: "[]",
  home_region_section_eyebrow: "DESTINATIONS",
  home_region_section_title: "어디로 떠나고 싶으신가요?",
  home_region_section_description: "지역별 여행 상품을 만나보세요.",
  home_theme_card_ids: "[]",
  home_theme_section_eyebrow: "TRAVEL THEMES",
  home_theme_section_title: "이런 여행은 어떠세요?",
  home_theme_section_description: "테마별로 여행 상품을 둘러보세요.",
  products_collection_recommend_campaign_ids: "[]",
  products_collection_popular_campaign_ids: "[]",
  about_kicker: "ABOUT THEALL TOUR",
  about_title: "여행을 디자인해 드립니다",
  about_paragraph1:
    "당신 만의 특별한 여정이 되어야 할 여행, 똑같은 패키지 여행에 지치셨나요? 더올투어는 정형화된 일정이 아닌, 고객 한 분 한 분의 취향과 목적에 맞춘 '큐레이팅 여행'을 지향합니다.",
  about_paragraph2:
    "수년간 쌓아온 노하우와 탄탄한 현지 네트워크를 바탕으로, 남들은 모르는 숨은 명소부터 프라이빗한 숙소까지 세밀하게 설계해 드립니다. 전문가의 시선으로 고른 고품격 여행, 이제 더올투어와 함께 시작하세요.",
  about_cta_label: "맞춤 여행 상담 받기",
  about_cta_href: "/#contact",
  deposit_amount_default: "",
  deposit_bank_name: "",
  deposit_bank_account: "",
  deposit_account_holder: "(주)더올투어",
  deposit_payment_links: "[]",
  consult_sla_minutes: "30",
};

async function fetchSiteSettingsRaw(): Promise<SiteSettings> {
  const { data, error } = await supabase.from("site_settings").select("key, value");

  if (error || !data) {
    return DEFAULT_SITE_SETTINGS;
  }

  const map = new Map<string, string>();
  for (const row of data as { key: string; value: string }[]) {
    if (!row || !row.key) continue;
    map.set(row.key, row.value ?? "");
  }

  return {
    kakao_channel_url: map.get("kakao_channel_url") || DEFAULT_SITE_SETTINGS.kakao_channel_url,
    instagram_url: map.get("instagram_url") || DEFAULT_SITE_SETTINGS.instagram_url,
    naver_band_url: (map.get("naver_band_url") ?? "").trim(),
    naver_blog_url: (map.get("naver_blog_url") ?? "").trim(),
    kakao_chat_url: map.get("kakao_chat_url") || DEFAULT_SITE_SETTINGS.kakao_chat_url,
    company_name: map.get("company_name") || DEFAULT_SITE_SETTINGS.company_name,
    ceo_name: map.get("ceo_name") || DEFAULT_SITE_SETTINGS.ceo_name,
    address: map.get("address") || DEFAULT_SITE_SETTINGS.address,
    business_reg_no: map.get("business_reg_no") || DEFAULT_SITE_SETTINGS.business_reg_no,
    tourism_reg_no: map.get("tourism_reg_no") || DEFAULT_SITE_SETTINGS.tourism_reg_no,
    mail_order_reg_no: map.get("mail_order_reg_no") || DEFAULT_SITE_SETTINGS.mail_order_reg_no,
    main_phone: map.get("main_phone") || DEFAULT_SITE_SETTINGS.main_phone,
    main_email: map.get("main_email") || DEFAULT_SITE_SETTINGS.main_email,
    products_hero_headline:
      map.get("products_hero_headline") || DEFAULT_SITE_SETTINGS.products_hero_headline,
    products_hero_subcopy:
      map.get("products_hero_subcopy") || DEFAULT_SITE_SETTINGS.products_hero_subcopy,
    products_hero_regions:
      map.get("products_hero_regions") || DEFAULT_SITE_SETTINGS.products_hero_regions,
    golf_hero_headline:
      map.get("golf_hero_headline") || DEFAULT_SITE_SETTINGS.golf_hero_headline,
    golf_hero_subcopy:
      map.get("golf_hero_subcopy") || DEFAULT_SITE_SETTINGS.golf_hero_subcopy,
    golf_hero_regions:
      map.get("golf_hero_regions") || DEFAULT_SITE_SETTINGS.golf_hero_regions,
    home_region_card_ids:
      map.get("home_region_card_ids") ?? DEFAULT_SITE_SETTINGS.home_region_card_ids,
    home_region_section_eyebrow:
      map.get("home_region_section_eyebrow") ?? DEFAULT_SITE_SETTINGS.home_region_section_eyebrow,
    home_region_section_title:
      map.get("home_region_section_title") ?? DEFAULT_SITE_SETTINGS.home_region_section_title,
    home_region_section_description:
      map.get("home_region_section_description") ?? DEFAULT_SITE_SETTINGS.home_region_section_description,
    home_theme_card_ids:
      map.get("home_theme_card_ids") ?? DEFAULT_SITE_SETTINGS.home_theme_card_ids,
    home_theme_section_eyebrow:
      map.get("home_theme_section_eyebrow") ?? DEFAULT_SITE_SETTINGS.home_theme_section_eyebrow,
    home_theme_section_title:
      map.get("home_theme_section_title") ?? DEFAULT_SITE_SETTINGS.home_theme_section_title,
    home_theme_section_description:
      map.get("home_theme_section_description") ?? DEFAULT_SITE_SETTINGS.home_theme_section_description,
    products_collection_recommend_campaign_ids:
      map.get("products_collection_recommend_campaign_ids") ??
      DEFAULT_SITE_SETTINGS.products_collection_recommend_campaign_ids,
    products_collection_popular_campaign_ids:
      map.get("products_collection_popular_campaign_ids") ??
      DEFAULT_SITE_SETTINGS.products_collection_popular_campaign_ids,
    about_kicker: map.get("about_kicker") || DEFAULT_SITE_SETTINGS.about_kicker,
    about_title: map.get("about_title") || DEFAULT_SITE_SETTINGS.about_title,
    about_paragraph1:
      map.get("about_paragraph1") || DEFAULT_SITE_SETTINGS.about_paragraph1,
    about_paragraph2:
      map.get("about_paragraph2") || DEFAULT_SITE_SETTINGS.about_paragraph2,
    about_cta_label:
      map.get("about_cta_label") || DEFAULT_SITE_SETTINGS.about_cta_label,
    about_cta_href: map.get("about_cta_href") || DEFAULT_SITE_SETTINGS.about_cta_href,
    deposit_amount_default:
      map.get("deposit_amount_default") ?? DEFAULT_SITE_SETTINGS.deposit_amount_default,
    deposit_bank_name: map.get("deposit_bank_name") ?? DEFAULT_SITE_SETTINGS.deposit_bank_name,
    deposit_bank_account:
      map.get("deposit_bank_account") ?? DEFAULT_SITE_SETTINGS.deposit_bank_account,
    deposit_account_holder:
      map.get("deposit_account_holder") ?? DEFAULT_SITE_SETTINGS.deposit_account_holder,
    deposit_payment_links:
      map.get("deposit_payment_links") ?? DEFAULT_SITE_SETTINGS.deposit_payment_links,
    deposit_payment_link: map.get("deposit_payment_link") ?? "",
    consult_sla_minutes:
      map.get("consult_sla_minutes") ?? DEFAULT_SITE_SETTINGS.consult_sla_minutes,
  };
}

/**
 * DB에서 site_settings를 바로 읽습니다. 관리자 저장 직후 푸터 등에 즉시 반영하려면 이 함수를 쓰세요.
 * (getSiteSettings는 unstable_cache를 사용하므로, revalidateTag 타이밍에 따라 짧은 지연·불일치가 날 수 있습니다.)
 */
export async function getSiteSettingsLive(): Promise<SiteSettings> {
  return fetchSiteSettingsRaw();
}

/** 5분 캐시 — 관리자에서 site_settings 수정 시 revalidateTag("site-settings") 호출 필요 */
export async function getSiteSettings(): Promise<SiteSettings> {
  return unstable_cache(
    fetchSiteSettingsRaw,
    ["site-settings"],
    { revalidate: 300, tags: ["site-settings"] },
  )();
}

/** 메인 홈 지역카드에 노출할 destination taxonomy id 목록 (순서 유지). 비어 있으면 설정 미사용. */
export function parseHomeRegionCardIds(settings: Pick<SiteSettings, "home_region_card_ids">): string[] {
  const raw = settings.home_region_card_ids?.trim() ?? "";
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
  } catch {
    return [];
  }
}

/** 메인 홈 테마카드에 노출할 theme taxonomy id 목록 (순서 유지). 비어 있으면 설정 미사용. 최대 8개 사용 권장. */
export function parseHomeThemeCardIds(settings: Pick<SiteSettings, "home_theme_card_ids">): string[] {
  const raw = settings.home_theme_card_ids?.trim() ?? "";
  if (!raw || raw === "[]") return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim())
      .slice(0, 8);
  } catch {
    return [];
  }
}

function parseJsonTaxonomyIdArray(raw: string | undefined): string[] {
  const s = raw?.trim() ?? "";
  if (!s || s === "[]") return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
  } catch {
    return [];
  }
}

/** 추천 컬렉션용 campaign taxonomy id (순서 유지). */
export function parseProductsCollectionRecommendCampaignIds(
  settings: Pick<SiteSettings, "products_collection_recommend_campaign_ids">,
): string[] {
  return parseJsonTaxonomyIdArray(settings.products_collection_recommend_campaign_ids);
}

/** 인기 컬렉션용 campaign taxonomy id (순서 유지). */
export function parseProductsCollectionPopularCampaignIds(
  settings: Pick<SiteSettings, "products_collection_popular_campaign_ids">,
): string[] {
  return parseJsonTaxonomyIdArray(settings.products_collection_popular_campaign_ids);
}

