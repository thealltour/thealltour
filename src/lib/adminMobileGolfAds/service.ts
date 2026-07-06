import "server-only";

import {
  createMobileGolfAdLanding,
  deleteMobileGolfAdLanding,
  getMobileGolfAdLandingById,
  listMobileGolfAdLandings,
  publishMobileGolfAdLanding,
  unpublishMobileGolfAdLanding,
  updateMobileGolfAdLanding,
} from "@/lib/adminMobileGolfAds/repository";
import type { MobileGolfAdLandingInput } from "@/lib/adminMobileGolfAds/types";
import {
  MobileGolfAdValidationError,
  validateMobileGolfAdForPublish,
  validateMobileGolfAdInput,
} from "@/lib/adminMobileGolfAds/validation";

export class MobileGolfAdServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "VALIDATION_ERROR") {
    super(message);
    this.name = "MobileGolfAdServiceError";
    this.status = status;
    this.code = code;
  }
}

function wrapError(error: unknown): never {
  if (error instanceof MobileGolfAdValidationError) {
    throw new MobileGolfAdServiceError(error.message, 400, "VALIDATION_ERROR");
  }
  if (error instanceof MobileGolfAdServiceError) throw error;
  const message = error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.";
  if (message.includes("찾을 수 없")) {
    throw new MobileGolfAdServiceError(message, 404, "NOT_FOUND");
  }
  if (message.includes("slug")) {
    throw new MobileGolfAdServiceError(message, 409, "DUPLICATE_SLUG");
  }
  throw new MobileGolfAdServiceError(message, 500, "INTERNAL_ERROR");
}

export async function listAdminMobileGolfAds() {
  try {
    const items = await listMobileGolfAdLandings();
    return { items, total: items.length };
  } catch (error) {
    wrapError(error);
  }
}

export async function getAdminMobileGolfAd(id: string) {
  try {
    const item = await getMobileGolfAdLandingById(id);
    if (!item) throw new MobileGolfAdServiceError("랜딩을 찾을 수 없습니다.", 404, "NOT_FOUND");
    return item;
  } catch (error) {
    wrapError(error);
  }
}

export async function createAdminMobileGolfAd(raw: MobileGolfAdLandingInput) {
  try {
    const input = validateMobileGolfAdInput(raw);
    return await createMobileGolfAdLanding(input);
  } catch (error) {
    wrapError(error);
  }
}

export async function updateAdminMobileGolfAd(id: string, raw: MobileGolfAdLandingInput) {
  try {
    const existing = await getMobileGolfAdLandingById(id);
    if (!existing) throw new MobileGolfAdServiceError("랜딩을 찾을 수 없습니다.", 404, "NOT_FOUND");
    const input = validateMobileGolfAdInput(raw);
    return await updateMobileGolfAdLanding(id, input);
  } catch (error) {
    wrapError(error);
  }
}

export async function deleteAdminMobileGolfAd(id: string) {
  try {
    await deleteMobileGolfAdLanding(id);
  } catch (error) {
    wrapError(error);
  }
}

export async function publishAdminMobileGolfAd(id: string) {
  try {
    const existing = await getMobileGolfAdLandingById(id);
    if (!existing) throw new MobileGolfAdServiceError("랜딩을 찾을 수 없습니다.", 404, "NOT_FOUND");
    validateMobileGolfAdForPublish({
      title: existing.title,
      slug: existing.slug,
      heroImageUrl: existing.heroImageUrl,
      bodyDoc: existing.bodyDoc,
      seoTitle: existing.seoTitle,
      seoDescription: existing.seoDescription,
    });
    return await publishMobileGolfAdLanding(id);
  } catch (error) {
    wrapError(error);
  }
}

export async function unpublishAdminMobileGolfAd(id: string) {
  try {
    return await unpublishMobileGolfAdLanding(id);
  } catch (error) {
    wrapError(error);
  }
}

export { getPublishedMobileGolfAdLandingBySlug } from "@/lib/adminMobileGolfAds/repository";
