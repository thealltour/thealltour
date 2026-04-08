/**
 * PR-IMAGE-3: ModetourImportV1 내 http(s) 이미지 URL을 Supabase product-images로 재호스팅.
 * 클라이언트 번들에 포함되지 않도록 server-only.
 */
import "server-only";

import type { ModetourImportV1, ModetourImageHeuristicHints } from "@/types/modetourImport";
import { uploadImageFromUrl } from "@/lib/images/uploadImageFromUrl";

export type NormalizeImportImageStats = {
  uniqueUrls: number;
  attempted: number;
  uploaded: number;
  failed: number;
  skippedInternal: number;
  skipped: boolean;
  reason?: string;
};

function isHttpImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/** 이미 우리 Supabase product-images 공개 URL이면 재업로드하지 않음 */
function isInternalProductImageUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  try {
    const u = new URL(url);
    const b = new URL(base);
    if (u.origin !== b.origin) return false;
    return u.pathname.includes("/storage/v1/object/public/product-images/");
  } catch {
    return false;
  }
}

function collectUniqueExternalImageUrls(input: ModetourImportV1): string[] {
  const raw: string[] = [];
  const push = (u?: string | null) => {
    const t = u?.trim();
    if (!t || !isHttpImageUrl(t)) return;
    if (isInternalProductImageUrl(t)) return;
    raw.push(t);
  };

  push(input.media?.heroImageUrl);
  for (const u of input.media?.galleryImageUrls ?? []) push(u);
  for (const u of input.media?.unassignedImageUrls ?? []) push(u);
  for (const d of input.itinerary?.days ?? []) {
    for (const u of d.imageUrls ?? []) push(u);
    for (const e of d.events ?? []) {
      for (const u of e.imageUrls ?? []) push(u);
    }
  }
  return [...new Set(raw)];
}

function replaceUrl(map: Map<string, string>, u: string | undefined): string | undefined {
  if (u == null) return u;
  const t = u.trim();
  if (!t) return u;
  return map.get(t) ?? u;
}

function applyReplacements(input: ModetourImportV1, urlMap: Map<string, string>): ModetourImportV1 {
  const out = structuredClone(input) as ModetourImportV1;
  if (out.media) {
    if (out.media.heroImageUrl) {
      out.media.heroImageUrl = replaceUrl(urlMap, out.media.heroImageUrl);
    }
    if (out.media.galleryImageUrls?.length) {
      out.media.galleryImageUrls = out.media.galleryImageUrls.map((x) => replaceUrl(urlMap, x) ?? x);
    }
    if (out.media.unassignedImageUrls?.length) {
      out.media.unassignedImageUrls = out.media.unassignedImageUrls.map((x) => replaceUrl(urlMap, x) ?? x);
    }
    const hints = out.media.imageHintsByUrl;
    if (hints && Object.keys(hints).length > 0) {
      const next: Record<string, ModetourImageHeuristicHints> = {};
      for (const [oldKey, meta] of Object.entries(hints)) {
        const nk = replaceUrl(urlMap, oldKey) ?? oldKey;
        next[nk] = meta;
      }
      out.media.imageHintsByUrl = next;
    }
  }
  if (out.itinerary?.days?.length) {
    for (const d of out.itinerary.days) {
      if (d.imageUrls?.length) {
        d.imageUrls = d.imageUrls.map((x) => replaceUrl(urlMap, x) ?? x);
      }
      for (const ev of d.events ?? []) {
        if (ev.imageUrls?.length) {
          ev.imageUrls = ev.imageUrls.map((x) => replaceUrl(urlMap, x) ?? x);
        }
      }
    }
  }
  return out;
}

/**
 * 외부 URL은 병렬 업로드 후 내부 URL로 치환, 실패 시 원본 URL 유지(fallback).
 */
export async function normalizeModetourImportImages(
  input: ModetourImportV1,
): Promise<{ payload: ModetourImportV1; stats: NormalizeImportImageStats }> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      payload: input,
      stats: {
        uniqueUrls: 0,
        attempted: 0,
        uploaded: 0,
        failed: 0,
        skippedInternal: 0,
        skipped: true,
        reason: "missing_supabase_env",
      },
    };
  }

  const unique = collectUniqueExternalImageUrls(input);
  const skippedInternal =
    (() => {
      let n = 0;
      const visit = (u?: string | null) => {
        const t = u?.trim();
        if (t && isHttpImageUrl(t) && isInternalProductImageUrl(t)) n += 1;
      };
      visit(input.media?.heroImageUrl);
      for (const u of input.media?.galleryImageUrls ?? []) visit(u);
      for (const u of input.media?.unassignedImageUrls ?? []) visit(u);
      for (const d of input.itinerary?.days ?? []) {
        for (const u of d.imageUrls ?? []) visit(u);
        for (const e of d.events ?? []) {
          for (const u of e.imageUrls ?? []) visit(u);
        }
      }
      return n;
    })();

  if (unique.length === 0) {
    return {
      payload: input,
      stats: {
        uniqueUrls: 0,
        attempted: 0,
        uploaded: 0,
        failed: 0,
        skippedInternal,
        skipped: false,
      },
    };
  }

  const settled = await Promise.allSettled(
    unique.map(async (url) => {
      const uploaded = await uploadImageFromUrl(url);
      const finalUrl = uploaded.success ? uploaded.url : url;
      return { url, finalUrl, ok: uploaded.success };
    }),
  );

  const urlMap = new Map<string, string>();
  let uploaded = 0;
  let failed = 0;
  for (let i = 0; i < settled.length; i++) {
    const url = unique[i]!;
    const s = settled[i]!;
    if (s.status === "fulfilled") {
      urlMap.set(s.value.url, s.value.finalUrl);
      if (s.value.ok) uploaded += 1;
      else failed += 1;
    } else {
      urlMap.set(url, url);
      failed += 1;
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[IMAGE][UPLOAD_FAIL]", url, s.reason);
      }
    }
  }

  const payload = applyReplacements(input, urlMap);

  return {
    payload,
    stats: {
      uniqueUrls: unique.length,
      attempted: unique.length,
      uploaded,
      failed,
      skippedInternal,
      skipped: false,
    },
  };
}
