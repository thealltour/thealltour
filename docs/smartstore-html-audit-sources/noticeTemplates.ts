/**
 * PR-E: 그룹별 상품 안내 공통 템플릿 (product_notice_templates)
 * - 신규 테이블 우선, booking_notes 만 product_terms_templates 레거시 폴백
 */

import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/product";
import {
  TERMS_TEMPLATE_TYPES,
  type TermsTemplateType,
  getTermsTemplateContent,
  getTermsTemplateContentFromMap,
  type TermsTemplateMap,
} from "@/lib/termsTemplates";

export type NoticeTemplateGroup =
  | "booking_notes"
  | "travel_notes"
  | "booking_conditions"
  | "refund_policy";

export type NoticeTemplatesByGroup = Record<NoticeTemplateGroup, TermsTemplateMap>;

export type NoticeTemplateRow = {
  id: string;
  template_group: NoticeTemplateGroup;
  type: string;
  label: string | null;
  content: string | null;
  sort_order: number;
  updated_at: string;
};

function emptyTypeMap(): TermsTemplateMap {
  return {
    overseas_brokerage: "",
    domestic_brokerage: "",
    overseas_direct: "",
    domestic_direct: "",
  };
}

export function createEmptyNoticeTemplatesByGroup(): NoticeTemplatesByGroup {
  return {
    booking_notes: emptyTypeMap(),
    travel_notes: emptyTypeMap(),
    booking_conditions: emptyTypeMap(),
    refund_policy: emptyTypeMap(),
  };
}

function isKnownType(type: string): type is TermsTemplateType {
  return (TERMS_TEMPLATE_TYPES as readonly string[]).includes(type);
}

function rowGroupIsNotice(g: string): g is NoticeTemplateGroup {
  return (
    g === "booking_notes" ||
    g === "travel_notes" ||
    g === "booking_conditions" ||
    g === "refund_policy"
  );
}

export const getNoticeTemplatesByGroup = unstable_cache(
  async (): Promise<NoticeTemplatesByGroup> => {
    const result = createEmptyNoticeTemplatesByGroup();
    const { data, error } = await supabase
      .from("product_notice_templates")
      .select("template_group,type,content,sort_order")
      .order("sort_order", { ascending: true })
      .order("type", { ascending: true });

    if (error || !data) return result;

    for (const row of data as { template_group: string; type: string; content: string | null }[]) {
      if (!rowGroupIsNotice(row.template_group)) continue;
      if (!isKnownType(row.type)) continue;
      result[row.template_group][row.type] = row.content?.trim() ?? "";
    }
    return result;
  },
  ["product-notice-templates-by-group"],
  { revalidate: 60, tags: ["products"] },
);

/**
 * 상품별 직접 입력이 비어 있을 때 사용할 공통 템플릿 본문.
 * booking_notes: 신규 테이블 → (비어 있으면) product_terms_templates
 * 그 외 그룹: 신규 테이블만
 */
export async function getNoticeTemplateContent(
  group: NoticeTemplateGroup,
  type?: string | null,
): Promise<string> {
  if (!type || !isKnownType(type)) return "";
  const maps = await getNoticeTemplatesByGroup();
  const fromNew = maps[group][type].trim();
  if (fromNew) return fromNew;
  if (group === "booking_notes") {
    // TODO(PR-H): legacy product_terms_templates fallback is temporary — remove after full migration
    return (await getTermsTemplateContent(type)).trim();
  }
  return "";
}

export function getNoticeTemplateContentFromMaps(
  maps: NoticeTemplatesByGroup,
  group: NoticeTemplateGroup,
  type?: string | null,
  legacyTermsMap?: TermsTemplateMap | null,
): string {
  if (!type || !isKnownType(type)) return "";
  const fromNew = maps[group][type].trim();
  if (fromNew) return fromNew;
  if (group === "booking_notes" && legacyTermsMap) {
    // TODO(PR-H): legacy product_terms_templates fallback is temporary — remove after full migration
    return getTermsTemplateContentFromMap(legacyTermsMap, type).trim();
  }
  return "";
}

export type ResolvedProductNoticesForDetail = {
  bookingNotes: string;
  travelNotes: string;
  bookingConditions: string;
  refundPolicy: string;
};

export async function resolveBookingNoticeForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  legacyTerms: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  const t = (await getNoticeTemplateContent("booking_notes", templateType ?? undefined)).trim();
  if (t) return t;
  // TODO(PR-H): legacy fallback (terms_and_notes) is temporary — remove after full migration
  return legacyTerms?.trim() ?? "";
}

export async function resolveTravelNoticeForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("travel_notes", templateType ?? undefined)).trim();
}

export async function resolveBookingConditionsForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("booking_conditions", templateType ?? undefined)).trim();
}

/** 환불 규정: 직접입력 → refund_policy 템플릿만. legacy/terms_and_notes 폴백 없음 */
export async function resolveRefundPolicyForDetail(
  direct: string | null | undefined,
  templateType: string | null | undefined,
): Promise<string> {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return (await getNoticeTemplateContent("refund_policy", templateType ?? undefined)).trim();
}

/**
 * 상품 상세·관리자 미리보기(서버) 공통 해석.
 * 순서: 직접입력 → 공통 템플릿 → (예약 유의만) terms_and_notes 레거시.
 * 템플릿 로드는 getNoticeTemplatesByGroup 캐시를 공유하므로 Promise.all로 병렬 호출해도 중복 fetch가 최소화됨.
 */
export async function resolveProductNoticesForDetailPage(
  product: Product,
): Promise<ResolvedProductNoticesForDetail> {
  const [bookingNotes, travelNotes, bookingConditions, refundPolicy] = await Promise.all([
    resolveBookingNoticeForDetail(
      product.booking_notes,
      product.booking_notes_template_type,
      product.terms_and_notes,
    ),
    resolveTravelNoticeForDetail(product.travel_notes, product.travel_notes_template_type),
    resolveBookingConditionsForDetail(
      product.booking_conditions,
      product.booking_conditions_template_type,
    ),
    resolveRefundPolicyForDetail(product.refund_policy, product.refund_policy_template_type),
  ]);
  return { bookingNotes, travelNotes, bookingConditions, refundPolicy };
}

export function resolveBookingNoticeForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  legacyTerms: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
  legacyTermsMap: TermsTemplateMap | null | undefined,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  const t = getNoticeTemplateContentFromMaps(
    noticeMaps,
    "booking_notes",
    templateType,
    legacyTermsMap ?? undefined,
  );
  if (t) return t;
  // TODO(PR-H): legacy fallback (terms_and_notes) is temporary — remove after full migration
  return legacyTerms?.trim() ?? "";
}

export function resolveTravelNoticeForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "travel_notes", templateType);
}

export function resolveBookingConditionsForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "booking_conditions", templateType);
}

export function resolveRefundPolicyForDetailSync(
  direct: string | null | undefined,
  templateType: string | null | undefined,
  noticeMaps: NoticeTemplatesByGroup,
): string {
  const d = direct?.trim() ?? "";
  if (d) return d;
  return getNoticeTemplateContentFromMaps(noticeMaps, "refund_policy", templateType);
}
