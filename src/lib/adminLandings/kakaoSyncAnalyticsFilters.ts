import { KAKAO_SYNC_GOLF_LANDING_SLUG } from "@/lib/hardcodedLandings/kakaoSyncGolf/urls";

const KAKAO_TEMPLATE_TYPES = new Set(["kakao_sync_golf", "mobile_golf_ad"]);

export type KakaoSyncEventLike = {
  template_type?: string | null;
  landing_slug?: string | null;
  source_path?: string | null;
  page_path?: string | null;
  section?: string | null;
  metadata?: unknown;
};

export function isKakaoSyncAnalyticsEvent(row: KakaoSyncEventLike): boolean {
  const template = String(row.template_type ?? "").trim();
  if (KAKAO_TEMPLATE_TYPES.has(template)) return true;
  const slug = String(row.landing_slug ?? "").trim();
  if (slug === KAKAO_SYNC_GOLF_LANDING_SLUG) return true;
  const path = String(row.source_path ?? row.page_path ?? "");
  if (path.startsWith("/golf/kakao-sync") || path.startsWith("/golf/ads/")) return true;
  if (String(row.section ?? "") === "kakao_sync_golf_landing") return true;
  if (row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)) {
    const meta = row.metadata as Record<string, unknown>;
    if (meta.funnel === "kakao_sync") return true;
    if (meta.landingKind === "kakao_sync_golf" || meta.landingKind === "mobile_golf_ad") return true;
  }
  return false;
}

export function resolveKakaoSyncCampaign(row: {
  template_type?: string | null;
  landing_slug?: string | null;
  source_path?: string | null;
}): { key: string; label: string; templateType: string } {
  const template = String(row.template_type ?? "").trim() || "unknown";
  const slug = String(row.landing_slug ?? "").trim();
  if (template === "kakao_sync_golf" || slug === KAKAO_SYNC_GOLF_LANDING_SLUG) {
    return { key: "kakao-sync", label: "하드코딩 · kakao-sync", templateType: "kakao_sync_golf" };
  }
  if (slug) {
    return { key: `ads:${slug}`, label: `모바일 골프 · ${slug}`, templateType: "mobile_golf_ad" };
  }
  const path = String(row.source_path ?? "");
  const m = path.match(/\/golf\/ads\/([^/?#]+)/);
  if (m?.[1]) {
    return { key: `ads:${m[1]}`, label: `모바일 골프 · ${m[1]}`, templateType: "mobile_golf_ad" };
  }
  return { key: "other", label: "기타", templateType: template || "unknown" };
}
