import { revalidateTag } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { requireAdminSession } from "@/lib/apiAuth";
import { jsonError, jsonOk } from "@/lib/api/response";
import { TERMS_TEMPLATE_TYPES, type TermsTemplateType } from "@/lib/termsTemplates";
import {
  createEmptyNoticeTemplatesByGroup,
  type NoticeTemplateGroup,
  type NoticeTemplatesByGroup,
} from "@/lib/noticeTemplates";
import {
  loadNoticeTemplateMaps,
  loadLegacyTermsTemplateRows,
  upsertNoticeTemplateRows,
  type NoticeTemplateUpsertRow,
} from "@/lib/adminNoticeTemplates/repository";

type LegacyTermsBody = Partial<Record<TermsTemplateType, string>>;

type NoticeTemplatesPatchBody = Partial<{
  booking_notes: LegacyTermsBody;
  travel_notes: LegacyTermsBody;
  booking_conditions: LegacyTermsBody;
  refund_policy: LegacyTermsBody;
}>;

const GROUPS: NoticeTemplateGroup[] = [
  "booking_notes",
  "travel_notes",
  "booking_conditions",
  "refund_policy",
];

function buildLegacyMapFromRows(
  rows: { type: string; content: string | null }[] | null,
): Record<TermsTemplateType, string> {
  const out = createEmptyNoticeTemplatesByGroup().booking_notes;
  for (const type of TERMS_TEMPLATE_TYPES) {
    const item = (rows ?? []).find((row) => row.type === type);
    out[type] = typeof item?.content === "string" ? item.content : "";
  }
  return out;
}

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const [noticeResult, legacyResult] = await Promise.all([
    loadNoticeTemplateMaps(),
    loadLegacyTermsTemplateRows(),
  ]);

  if (!noticeResult.ok) {
    return jsonError(noticeResult.message, 500);
  }

  if (legacyResult.errorMessage) {
    return jsonError(legacyResult.errorMessage, 500);
  }

  return jsonOk({
    notice: noticeResult.maps,
    legacy: buildLegacyMapFromRows(legacyResult.data),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as NoticeTemplatesPatchBody;
  const upsertRows: NoticeTemplateUpsertRow[] = [];

  for (const group of GROUPS) {
    const partial = body[group];
    if (!partial || typeof partial !== "object") continue;
    for (const type of TERMS_TEMPLATE_TYPES) {
      if (!(type in partial)) continue;
      const raw = partial[type];
      upsertRows.push({
        template_group: group,
        type,
        content: typeof raw === "string" ? raw.trim() : "",
        sort_order: 0,
      });
    }
  }

  if (upsertRows.length === 0) {
    return jsonError("저장할 템플릿이 없습니다.", 400);
  }

  const saved = await upsertNoticeTemplateRows(upsertRows);
  if (!saved.ok) {
    return jsonError(saved.message, 500);
  }

  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  return jsonOk({ message: "공지 템플릿이 저장되었습니다." });
}
