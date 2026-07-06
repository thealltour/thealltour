"use client";

import type { MobileGolfAdLanding, MobileGolfAdLandingInput, MobileGolfAdLandingListItem } from "@/lib/adminMobileGolfAds/types";

const BASE = "/api/admin/landings/mobile-golf-ads";

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string; message?: string };
  if (!res.ok) {
    throw new Error(data.error ?? data.message ?? `요청 실패 (${res.status})`);
  }
  return data;
}

export async function listMobileGolfAdsClient(): Promise<{
  items: MobileGolfAdLandingListItem[];
  total: number;
}> {
  return parseJson(await fetch(BASE, { cache: "no-store" }));
}

export async function getMobileGolfAdClient(id: string): Promise<MobileGolfAdLanding> {
  const data = await parseJson<{ item: MobileGolfAdLanding }>(
    await fetch(`${BASE}/${encodeURIComponent(id)}`, { cache: "no-store" }),
  );
  return data.item;
}

export async function createMobileGolfAdClient(
  input: MobileGolfAdLandingInput,
): Promise<MobileGolfAdLanding> {
  const data = await parseJson<{ item: MobileGolfAdLanding }>(
    await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return data.item;
}

export async function updateMobileGolfAdClient(
  id: string,
  input: MobileGolfAdLandingInput,
): Promise<MobileGolfAdLanding> {
  const data = await parseJson<{ item: MobileGolfAdLanding }>(
    await fetch(`${BASE}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return data.item;
}

export async function deleteMobileGolfAdClient(id: string): Promise<void> {
  await parseJson(await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export async function publishMobileGolfAdClient(id: string): Promise<MobileGolfAdLanding> {
  const data = await parseJson<{ item: MobileGolfAdLanding }>(
    await fetch(`${BASE}/${encodeURIComponent(id)}/publish`, { method: "POST" }),
  );
  return data.item;
}

export async function unpublishMobileGolfAdClient(id: string): Promise<MobileGolfAdLanding> {
  const data = await parseJson<{ item: MobileGolfAdLanding }>(
    await fetch(`${BASE}/${encodeURIComponent(id)}/unpublish`, { method: "POST" }),
  );
  return data.item;
}

export const ADMIN_MOBILE_GOLF_ADS_ROUTE = "/theall_manager_only/landings/mobile-golf-ads";
export const ADMIN_MOBILE_GOLF_ADS_NEW_ROUTE = `${ADMIN_MOBILE_GOLF_ADS_ROUTE}/new`;

export function buildAdminMobileGolfAdEditHref(id: string): string {
  return `${ADMIN_MOBILE_GOLF_ADS_ROUTE}/${encodeURIComponent(id)}`;
}

export function buildMobileGolfAdPreviewHref(slug: string): string {
  return `/golf/ads/${encodeURIComponent(slug)}`;
}
