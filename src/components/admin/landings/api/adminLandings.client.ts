"use client";

import type {
  AdminLandingDetail,
  AdminLandingListResponse,
  LandingGenerationCandidatesResponse,
  LandingGenerationFilterType,
  LandingGenerationRequestItem,
  LandingGenerationResult,
  LandingPublishValidationIssue,
} from "@/types/adminLanding";
import type { AdminLandingSection } from "@/types/adminLanding";
import { parseJsonResponse } from "@/components/admin/products/api/adminApiClient.shared";

const BASE = "/api/admin/landings";

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: string }).error;
    if (typeof error === "string" && error.trim()) return error;
  }
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: string }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export class AdminLandingPublishClientError extends Error {
  issues: LandingPublishValidationIssue[];
  constructor(issues: LandingPublishValidationIssue[]) {
    super("VALIDATION_FAILED");
    this.name = "AdminLandingPublishClientError";
    this.issues = issues;
  }
}

function isPublishValidationPayload(
  payload: unknown,
): payload is { error: string; issues: LandingPublishValidationIssue[] } {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as { error?: unknown; issues?: unknown };
  return p.error === "VALIDATION_FAILED" && Array.isArray(p.issues);
}

export async function listAdminLandingsClient(): Promise<AdminLandingListResponse> {
  const response = await fetch(BASE, { cache: "no-store" });
  const data = await parseJsonResponse<AdminLandingListResponse | { error?: string; message?: string }>(
    response,
  ).catch(() => ({} as { error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "랜딩 목록을 불러오지 못했습니다."));
  }
  return data as AdminLandingListResponse;
}

export async function getAdminLandingClient(id: string): Promise<AdminLandingDetail> {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, { cache: "no-store" });
  const data = await parseJsonResponse<{ item?: AdminLandingDetail; error?: string; message?: string }>(
    response,
  ).catch(() => ({} as { item?: AdminLandingDetail; error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "랜딩 상세를 불러오지 못했습니다."));
  }
  if (!data.item) {
    throw new Error("랜딩 상세 응답이 비어 있습니다.");
  }
  return data.item;
}

export type AdminLandingUpsertPayload = {
  title: string;
  slug: string;
  templateType: string;
  status: "draft" | "published" | "archived";
  summary?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sourcePath?: string | null;
  quoteCategory?: string | null;
};

export async function createAdminLandingClient(payload: AdminLandingUpsertPayload): Promise<AdminLandingDetail> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ item?: AdminLandingDetail; error?: string; message?: string }>(
    response,
  ).catch(() => ({} as { item?: AdminLandingDetail; error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "랜딩 생성에 실패했습니다."));
  }
  if (!data.item) throw new Error("랜딩 생성 응답이 비어 있습니다.");
  return data.item;
}

export async function deleteAdminLandingClient(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (response.status === 204) return;
  const data = await parseJsonResponse<{ error?: string; message?: string }>(response).catch(
    () => ({} as { error?: string; message?: string }),
  );
  if (response.status === 404) {
    throw new Error(extractErrorMessage(data, "이미 삭제되었거나 찾을 수 없는 랜딩입니다."));
  }
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "랜딩 삭제에 실패했습니다."));
  }
}

export async function updateAdminLandingClient(
  id: string,
  payload: AdminLandingUpsertPayload,
): Promise<AdminLandingDetail> {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonResponse<{ item?: AdminLandingDetail; error?: string; message?: string }>(
    response,
  ).catch(() => ({} as { item?: AdminLandingDetail; error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "랜딩 수정에 실패했습니다."));
  }
  if (!data.item) throw new Error("랜딩 수정 응답이 비어 있습니다.");
  return data.item;
}

export async function publishAdminLandingClient(id: string): Promise<AdminLandingDetail> {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await parseJsonResponse<
    { item?: AdminLandingDetail; error?: string; issues?: LandingPublishValidationIssue[] } | unknown
  >(response).catch(() => ({}));
  if (response.status === 422 && isPublishValidationPayload(data)) {
    throw new AdminLandingPublishClientError(data.issues);
  }
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Publish에 실패했습니다."));
  }
  const ok = data as { item?: AdminLandingDetail };
  if (!ok.item) throw new Error("Publish 응답이 비어 있습니다.");
  return ok.item;
}

export async function unpublishAdminLandingClient(id: string): Promise<AdminLandingDetail> {
  const response = await fetch(`${BASE}/${encodeURIComponent(id)}/unpublish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = await parseJsonResponse<{ item?: AdminLandingDetail; error?: string; message?: string }>(
    response,
  ).catch(() => ({} as { item?: AdminLandingDetail; error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "Unpublish에 실패했습니다."));
  }
  if (!data.item) throw new Error("Unpublish 응답이 비어 있습니다.");
  return data.item;
}

export async function listLandingSectionsClient(landingId: string): Promise<AdminLandingSection[]> {
  const response = await fetch(`${BASE}/${encodeURIComponent(landingId)}/sections`, { cache: "no-store" });
  const data = await parseJsonResponse<{ items?: AdminLandingSection[]; error?: string; message?: string }>(
    response,
  ).catch(() => ({} as { items?: AdminLandingSection[]; error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "섹션 목록을 불러오지 못했습니다."));
  }
  if (!Array.isArray(data.items)) {
    throw new Error("섹션 목록 응답 형식이 올바르지 않습니다.");
  }
  return data.items;
}

export async function updateLandingSectionClient(
  landingId: string,
  sectionId: string,
  payload: {
    title?: string;
    description?: string | null;
    body?: string | null;
    isEnabled?: boolean;
    sortOrder?: number;
  },
): Promise<AdminLandingSection> {
  const response = await fetch(
    `${BASE}/${encodeURIComponent(landingId)}/sections/${encodeURIComponent(sectionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const data = await parseJsonResponse<{ item?: AdminLandingSection; error?: string; message?: string }>(
    response,
  ).catch(() => ({} as { item?: AdminLandingSection; error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "섹션 저장에 실패했습니다."));
  }
  if (!data.item) throw new Error("섹션 저장 응답이 비어 있습니다.");
  return data.item;
}

export async function listLandingGenerationCandidatesClient(params?: {
  taxonomyType?: LandingGenerationFilterType;
  alreadyGenerated?: boolean;
}): Promise<LandingGenerationCandidatesResponse> {
  const sp = new URLSearchParams();
  if (params?.taxonomyType) sp.set("taxonomyType", params.taxonomyType);
  if (typeof params?.alreadyGenerated === "boolean") {
    sp.set("alreadyGenerated", params.alreadyGenerated ? "true" : "false");
  }
  const query = sp.toString();
  const response = await fetch(`${BASE}/generation-candidates${query ? `?${query}` : ""}`, {
    cache: "no-store",
  });
  const data = await parseJsonResponse<LandingGenerationCandidatesResponse | { error?: string; message?: string }>(
    response,
  ).catch(() => ({} as { error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "자동 생성 후보를 불러오지 못했습니다."));
  }
  return data as LandingGenerationCandidatesResponse;
}

export async function generateLandingsFromTaxonomyClient(
  items: LandingGenerationRequestItem[],
): Promise<LandingGenerationResult> {
  const response = await fetch(`${BASE}/generate-from-taxonomy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = await parseJsonResponse<LandingGenerationResult | { error?: string; message?: string }>(
    response,
  ).catch(() => ({} as { error?: string; message?: string }));
  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "taxonomy 기반 초안 생성에 실패했습니다."));
  }
  return data as LandingGenerationResult;
}
