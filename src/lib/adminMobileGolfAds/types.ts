import type { MobileGolfAdBodyDoc } from "@/lib/adminMobileGolfAds/bodyDoc";
import {
  deriveLegacyFieldsFromBodyDoc,
  deriveStyleConfigFromBodyDoc,
  resolveMobileGolfAdBodyDoc,
} from "@/lib/adminMobileGolfAds/bodyDoc";

export type MobileGolfAdFontSize = "sm" | "md" | "lg";

export type MobileGolfAdSectionStyle = {
  fontSize: MobileGolfAdFontSize;
  accentColor: string | null;
  roundBox: boolean;
};

export type MobileGolfAdStyleConfig = {
  benefit: MobileGolfAdSectionStyle;
  trust: MobileGolfAdSectionStyle;
};

export const DEFAULT_MOBILE_GOLF_AD_STYLE_CONFIG: MobileGolfAdStyleConfig = {
  benefit: { fontSize: "md", accentColor: "#0f172a", roundBox: false },
  trust: { fontSize: "sm", accentColor: "#334155", roundBox: false },
};

/** 광고·하드코딩 랜딩 CTA — OAuth state 쿠키를 심는 start 라우트만 사용 (kauth 직링크 금지) */
export const MOBILE_GOLF_AD_KAKAO_SYNC_AUTH_URL = "/api/auth/kakao/start?next=/mypage/dashboard";

export type MobileGolfAdLandingRow = {
  id: string;
  title: string;
  slug: string;
  hero_image_url: string;
  benefit_text: string;
  trust_action_text: string;
  is_published: boolean;
  seo_title: string | null;
  seo_description: string | null;
  style_config: MobileGolfAdStyleConfig | Record<string, unknown> | null;
  body_doc: MobileGolfAdBodyDoc | Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type MobileGolfAdLanding = {
  id: string;
  title: string;
  slug: string;
  heroImageUrl: string;
  bodyDoc: MobileGolfAdBodyDoc;
  /** @deprecated legacy — derived from bodyDoc */
  benefitText: string;
  /** @deprecated legacy — derived from bodyDoc */
  trustActionText: string;
  isPublished: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  /** @deprecated legacy — derived from bodyDoc */
  styleConfig: MobileGolfAdStyleConfig;
  createdAt: string;
  updatedAt: string;
};

export type MobileGolfAdLandingInput = {
  title: string;
  slug: string;
  heroImageUrl: string;
  bodyDoc: MobileGolfAdBodyDoc;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

export type MobileGolfAdLandingListItem = Pick<
  MobileGolfAdLanding,
  "id" | "title" | "slug" | "isPublished" | "updatedAt"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseSectionStyle(
  raw: unknown,
  fallback: MobileGolfAdSectionStyle,
): MobileGolfAdSectionStyle {
  if (!isRecord(raw)) return { ...fallback };
  const fontSize = raw.fontSize === "sm" || raw.fontSize === "md" || raw.fontSize === "lg"
    ? raw.fontSize
    : fallback.fontSize;
  const accentColor =
    typeof raw.accentColor === "string" && /^#[0-9a-fA-F]{6}$/.test(raw.accentColor)
      ? raw.accentColor
      : raw.accentColor === null
        ? null
        : fallback.accentColor;
  const roundBox = typeof raw.roundBox === "boolean" ? raw.roundBox : fallback.roundBox;
  return { fontSize, accentColor, roundBox };
}

export function parseMobileGolfAdStyleConfig(raw: unknown): MobileGolfAdStyleConfig {
  if (!isRecord(raw)) {
    return {
      benefit: { ...DEFAULT_MOBILE_GOLF_AD_STYLE_CONFIG.benefit },
      trust: { ...DEFAULT_MOBILE_GOLF_AD_STYLE_CONFIG.trust },
    };
  }
  return {
    benefit: parseSectionStyle(raw.benefit, DEFAULT_MOBILE_GOLF_AD_STYLE_CONFIG.benefit),
    trust: parseSectionStyle(raw.trust, DEFAULT_MOBILE_GOLF_AD_STYLE_CONFIG.trust),
  };
}

export function mapMobileGolfAdLandingRow(row: MobileGolfAdLandingRow): MobileGolfAdLanding {
  const styleConfig = parseMobileGolfAdStyleConfig(row.style_config);
  const bodyDoc = resolveMobileGolfAdBodyDoc(row.body_doc, {
    benefitText: row.benefit_text,
    trustActionText: row.trust_action_text,
    styleConfig,
  });
  const legacy = deriveLegacyFieldsFromBodyDoc(bodyDoc);

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    heroImageUrl: row.hero_image_url,
    bodyDoc,
    benefitText: legacy.benefitText || row.benefit_text,
    trustActionText: legacy.trustActionText || row.trust_action_text,
    isPublished: row.is_published,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    styleConfig: deriveStyleConfigFromBodyDoc(bodyDoc),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildMobileGolfAdPublicPath(slug: string): string {
  return `/golf/ads/${slug.trim()}`;
}

export function resolveMobileGolfAdSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://thealltour.com";
  return raw.replace(/\/$/, "");
}

export function buildMobileGolfAdPublicUrl(slug: string, withUtm = true): string {
  const origin = resolveMobileGolfAdSiteOrigin();
  const path = buildMobileGolfAdPublicPath(slug);
  if (!withUtm) return `${origin}${path}`;
  const params = new URLSearchParams({
    utm_source: "kakao",
    utm_medium: "bizboard",
    utm_campaign: slug.trim(),
  });
  return `${origin}${path}?${params.toString()}`;
}

export type { MobileGolfAdBodyDoc } from "@/lib/adminMobileGolfAds/bodyDoc";
