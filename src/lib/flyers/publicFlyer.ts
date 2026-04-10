import type { FlyerDraftState } from "@/lib/flyers/flyer.types";

/** 공개 공유용 slug (DB `share_slug`와 동일 규칙) */
export function isValidPublicFlyerSlug(raw: string): boolean {
  const s = raw?.trim() ?? "";
  return /^[a-z0-9]{10,32}$/.test(s);
}

export function buildPublicFlyerUrl(origin: string, slug: string): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/flyers/${encodeURIComponent(slug.trim())}`;
}

export type PublicFlyerApiSuccess = {
  ok: true;
  draft: FlyerDraftState;
  /** 페이지 제목용 (DB title 컬럼 우선) */
  displayTitle: string;
};

export type PublicFlyerApiError = {
  ok: false;
  message: string;
};
