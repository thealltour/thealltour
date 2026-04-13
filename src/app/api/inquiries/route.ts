import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { findOrCreateCustomerProfile } from "@/lib/customerProfiles";
import { notifyInquiryCreated } from "@/lib/notifications";
import { createNewInquiryNotification } from "@/lib/adminNotifications";
import { inferAttribution } from "@/lib/analytics/attribution";
import type { Inquiry, InquiryInput } from "@/types/inquiry";
import { normalizeInquiryRow } from "@/lib/inquiries/normalizeInquiryRow";
import { normalizeReceiverPhone, sendAligoRelay } from "@/lib/notifications/sendAligoRelay";
import {
  INQUIRY_API_ASSIGNEE_NO_SELF,
  INQUIRY_API_ASSIGNEE_UNASSIGNED,
} from "@/components/admin/inquiries/inquiryQueue.utils";

type ListStatus =
  | "all"
  | "new"
  | "contacted"
  | "closed"
  | "on_hold"
  | "reserved"
  | "completed"
  | "pending"
  | "delayed"
  | "completed_legacy"
  | "in_progress";
type SortOption = "pending_first" | "recent" | "oldest" | "name" | "priority_queue";
type ListQuickFilter = "all" | "unresponded" | "overdue" | "today" | "hot" | "unassigned";

type SafeSummary = {
  /** 응답 필요 상담: new + contacted (보류·종료 제외) */
  pendingCount: number;
  completedCount: number;
  reservedCount: number;
  newCount: number;
  contactedCount: number;
  closedCount: number;
  onHoldCount: number;
  /** 대기열 요약(전체 DB 기준, 퀵 필터 카드용) */
  queueOverdueCount: number;
  queueFollowUpTodayCount: number;
  queueHotLeadCount: number;
  queueUnassignedCount: number;
};

function kstYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function kstDayBoundsIso(): { start: string; end: string } {
  const d = kstYmd();
  const start = new Date(`${d}T00:00:00+09:00`);
  const end = new Date(`${d}T23:59:59.999+09:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

function applyInquiryListFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  search: string,
  status: ListStatus,
  quick: ListQuickFilter,
  createdAfterIso: string | null,
) {
  if (createdAfterIso) {
    query = query.gte("created_at", createdAfterIso);
  }

  if (search) {
    const escaped = search.replace(/[%_]/g, "\\$&");
    query = query.or(
      `name.ilike.%${escaped}%,phone.ilike.%${escaped}%,content.ilike.%${escaped}%,product_title.ilike.%${escaped}%`,
    );
  }

  if (status === "in_progress") {
    query = query.in("consultation_status", ["new", "contacted", "on_hold"]);
  } else if (status === "new") query = query.eq("consultation_status", "new");
  else if (status === "contacted") query = query.eq("consultation_status", "contacted");
  else if (status === "closed") query = query.eq("consultation_status", "closed");
  else if (status === "on_hold") query = query.eq("consultation_status", "on_hold");
  else if (status === "reserved") query = query.eq("booking_status", "reserved");
  else if (status === "completed") query = query.eq("booking_status", "completed");
  else if (status === "pending") {
    query = query.in("consultation_status", ["new", "contacted"]);
  } else if (status === "delayed") {
    const delayedThresholdIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    query = query.in("consultation_status", ["new", "contacted"]).lt("created_at", delayedThresholdIso);
  } else if (status === "completed_legacy") {
    query = query.eq("is_completed", true);
  }

  if (quick === "unresponded") {
    query = query.eq("consultation_status", "new");
  } else if (quick === "overdue") {
    const nowIso = new Date().toISOString();
    query = query.not("follow_up_at", "is", null).lt("follow_up_at", nowIso);
  } else if (quick === "today") {
    const { start, end } = kstDayBoundsIso();
    query = query.gte("follow_up_at", start).lte("follow_up_at", end);
  } else if (quick === "hot") {
    query = query.eq("lead_priority", "high");
  } else if (quick === "unassigned") {
    query = query.is("assignee_name", null);
  }

  return query;
}

function aggregateAssigneeWorkloadFromRows(rows: { assignee_name: string | null }[] | null) {
  const byName: Record<string, number> = {};
  let unassigned = 0;
  for (const r of rows ?? []) {
    const n = typeof r.assignee_name === "string" ? r.assignee_name.trim() : "";
    if (!n) unassigned += 1;
    else byName[n] = (byName[n] ?? 0) + 1;
  }
  return { byName, unassigned };
}

async function getInquirySummarySafe(): Promise<SafeSummary> {
  const nowIso = new Date().toISOString();
  const { start: kstStart, end: kstEnd } = kstDayBoundsIso();

  const [
    pendingSummary,
    completedSummary,
    reservedSummary,
    newSummary,
    contactedSummary,
    closedSummary,
    onHoldSummary,
    overdueSummary,
    todaySummary,
    hotSummary,
    unassignedSummary,
  ] = await Promise.all([
    supabase.from("inquiries").select("*", { count: "exact", head: true }).in("consultation_status", ["new", "contacted"]),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("booking_status", "completed"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("booking_status", "reserved"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("consultation_status", "new"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("consultation_status", "contacted"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("consultation_status", "closed"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("consultation_status", "on_hold"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).not("follow_up_at", "is", null).lt("follow_up_at", nowIso),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).gte("follow_up_at", kstStart).lte("follow_up_at", kstEnd),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("lead_priority", "high"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).is("assignee_name", null),
  ]);

  if (
    pendingSummary.error ||
    completedSummary.error ||
    reservedSummary.error ||
    newSummary.error ||
    contactedSummary.error ||
    closedSummary.error ||
    onHoldSummary.error
  ) {
    const [legacyPending, legacyCompleted] = await Promise.all([
      supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("is_completed", false),
      supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("is_completed", true),
    ]);
    return {
      pendingCount: legacyPending.error ? 0 : (legacyPending.count ?? 0),
      completedCount: legacyCompleted.error ? 0 : (legacyCompleted.count ?? 0),
      reservedCount: 0,
      newCount: 0,
      contactedCount: 0,
      closedCount: 0,
      onHoldCount: 0,
      queueOverdueCount: 0,
      queueFollowUpTodayCount: 0,
      queueHotLeadCount: 0,
      queueUnassignedCount: 0,
    };
  }

  return {
    pendingCount: pendingSummary.count ?? 0,
    completedCount: completedSummary.count ?? 0,
    reservedCount: reservedSummary.count ?? 0,
    newCount: newSummary.count ?? 0,
    contactedCount: contactedSummary.count ?? 0,
    closedCount: closedSummary.count ?? 0,
    onHoldCount: onHoldSummary.count ?? 0,
    queueOverdueCount: overdueSummary.error ? 0 : (overdueSummary.count ?? 0),
    queueFollowUpTodayCount: todaySummary.error ? 0 : (todaySummary.count ?? 0),
    queueHotLeadCount: hotSummary.error ? 0 : (hotSummary.count ?? 0),
    queueUnassignedCount: unassignedSummary.error ? 0 : (unassignedSummary.count ?? 0),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const statusParam = url.searchParams.get("status");
  const status: ListStatus =
    statusParam === "new" ||
    statusParam === "contacted" ||
    statusParam === "closed" ||
    statusParam === "on_hold" ||
    statusParam === "reserved" ||
    statusParam === "completed" ||
    statusParam === "pending" ||
    statusParam === "delayed" ||
    statusParam === "completed_legacy" ||
    statusParam === "in_progress"
      ? statusParam
      : "all";

  const createdAfterRaw = url.searchParams.get("createdAfter")?.trim() ?? "";
  let createdAfterIso: string | null = null;
  if (createdAfterRaw) {
    const t = new Date(createdAfterRaw).getTime();
    if (!Number.isNaN(t)) createdAfterIso = new Date(t).toISOString();
  }
  const sortParam = url.searchParams.get("sort");
  const sort: SortOption =
    sortParam === "recent" ||
    sortParam === "oldest" ||
    sortParam === "name" ||
    sortParam === "pending_first" ||
    sortParam === "priority_queue"
      ? sortParam
      : "priority_queue";

  const quickParam = url.searchParams.get("quick");
  const quick: ListQuickFilter =
    quickParam === "unresponded" ||
    quickParam === "overdue" ||
    quickParam === "today" ||
    quickParam === "hot" ||
    quickParam === "unassigned"
      ? quickParam
      : "all";
  const pageRaw = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSizeRaw = Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 5), 50) : 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const assigneeNameRaw = url.searchParams.get("assigneeName")?.trim() ?? "";

  const applyAssigneeToListQuery = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    q: any,
  ) => {
    if (assigneeNameRaw === INQUIRY_API_ASSIGNEE_UNASSIGNED) return q.is("assignee_name", null);
    if (assigneeNameRaw === INQUIRY_API_ASSIGNEE_NO_SELF) return q.eq("assignee_name", INQUIRY_API_ASSIGNEE_NO_SELF);
    if (assigneeNameRaw) return q.eq("assignee_name", assigneeNameRaw);
    return q;
  };

  const orderSort: Exclude<SortOption, "priority_queue"> = sort === "priority_queue" ? "pending_first" : sort;

  const applyListOrdering = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    q: any,
  ) => {
    if (orderSort === "pending_first") {
      return q.order("consultation_status", { ascending: true }).order("created_at", { ascending: false });
    }
    if (orderSort === "oldest") {
      return q.order("created_at", { ascending: true });
    }
    if (orderSort === "name") {
      return q.order("name", { ascending: true }).order("created_at", { ascending: false });
    }
    return q.order("created_at", { ascending: false });
  };

  const workloadLimit = 5000;
  let listQuery = applyAssigneeToListQuery(
    applyInquiryListFilters(supabase.from("inquiries").select("*", { count: "exact" }), search, status, quick, createdAfterIso),
  );
  listQuery = applyListOrdering(listQuery);

  const workloadQuery = applyInquiryListFilters(
    supabase.from("inquiries").select("assignee_name"),
    search,
    status,
    quick,
    createdAfterIso,
  ).limit(workloadLimit);

  const [listResult, workloadResult] = await Promise.all([listQuery.range(from, to), workloadQuery]);

  let { data, error, count } = listResult;

  if (error) {
    let fallback = applyAssigneeToListQuery(
      applyInquiryListFilters(supabase.from("inquiries").select("*", { count: "exact" }), search, status, quick, createdAfterIso),
    );
    fallback = fallback.order("created_at", { ascending: false, nullsFirst: false });
    const fallbackResult = await fallback.range(from, to);

    data = fallbackResult.data;
    error = fallbackResult.error;
    count = fallbackResult.count ?? 0;
  }

  if (error) {
    return NextResponse.json({ message: "문의 목록 조회에 실패했습니다." }, { status: 500 });
  }

  const assigneeWorkload = workloadResult.error
    ? { byName: {} as Record<string, number>, unassigned: 0 }
    : aggregateAssigneeWorkloadFromRows(workloadResult.data as { assignee_name: string | null }[] | null);
  const assigneeWorkloadCapped =
    !workloadResult.error && (workloadResult.data?.length ?? 0) >= workloadLimit;

  const summary = await getInquirySummarySafe();

  return NextResponse.json({
    items: ((data ?? []) as Record<string, unknown>[]).map((row) => normalizeInquiryRow(row)),
    total: count ?? 0,
    page,
    pageSize,
    pendingCount: summary.pendingCount,
    completedCount: summary.completedCount,
    reservedCount: summary.reservedCount,
    newCount: summary.newCount,
    contactedCount: summary.contactedCount,
    closedCount: summary.closedCount,
    onHoldCount: summary.onHoldCount,
    queueOverdueCount: summary.queueOverdueCount,
    queueFollowUpTodayCount: summary.queueFollowUpTodayCount,
    queueHotLeadCount: summary.queueHotLeadCount,
    queueUnassignedCount: summary.queueUnassignedCount,
    assigneeWorkload,
    assigneeWorkloadCapped,
  });
}

type BulkPatchBody = {
  ids?: string[];
  /** @deprecated 단계적 deprecated. consultation_status / booking_status 사용 권장.
   * TODO(후속 PR): 관리자 문의 UI를 consultation_status/booking_status 기반으로 개편 후 is_completed 제거. */
  is_completed?: boolean;
  consultation_status?: "new" | "contacted" | "closed" | "on_hold";
  booking_status?: "none" | "reserved" | "completed" | "canceled";
};

export async function PATCH(request: Request) {
  const body = (await request.json()) as BulkPatchBody;
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { message: "ids 배열이 필요합니다." },
      { status: 400 },
    );
  }

  const updatePayload: Record<string, unknown> = {};
  if (typeof body.is_completed === "boolean") {
    updatePayload.is_completed = body.is_completed;
  }
  if (
    body.consultation_status === "new" ||
    body.consultation_status === "contacted" ||
    body.consultation_status === "closed"
  ) {
    updatePayload.consultation_status = body.consultation_status;
  }
  if (
    body.booking_status === "none" ||
    body.booking_status === "reserved" ||
    body.booking_status === "completed" ||
    body.booking_status === "canceled"
  ) {
    updatePayload.booking_status = body.booking_status;
  }
  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { message: "is_completed, consultation_status, booking_status 중 하나 이상이 필요합니다." },
      { status: 400 },
    );
  }

  const updateResults = await Promise.all(
    ids.map((id) => supabase.from("inquiries").update(updatePayload).eq("id", id)),
  );

  const failed = updateResults.find((result) => result.error);
  if (failed?.error) {
    const code = failed.error.code;
    if (code === "42703") {
      return NextResponse.json(
        { message: "inquiries 테이블에 is_completed 컬럼이 없습니다. DB 업그레이드 SQL을 실행해 주세요." },
        { status: 500 },
      );
    }
    if (code === "42501") {
      return NextResponse.json(
        { message: "inquiries 테이블 UPDATE 권한(RLS 정책)이 없습니다. 정책 SQL을 확인해 주세요." },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { message: `일괄 상태 업데이트에 실패했습니다. (${failed.error.message})` },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "선택한 문의 상태가 업데이트되었습니다." });
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<InquiryInput>;
  const name = body.name?.trim();
  const phone = body.phone?.trim();
  const content = body.content?.trim();
  const productId = body.product_id?.trim();
  const productTitle = body.product_title?.trim();
  const sourcePath = body.source_path?.trim();
  const selectedOptions = body.selected_options;
  const quoteSummaryRaw = body.quote_summary;
  const inquiredAt = body.inquired_at?.trim();
  const firstTouch = body.first_touch;
  const inquiryPageUrl = body.inquiry_page_url?.trim();

  if (!name || !phone) {
    return NextResponse.json({ message: "이름과 연락처를 입력해 주세요." }, { status: 400 });
  }

  const hasOptionPayload =
    (selectedOptions && Object.keys(selectedOptions).length > 0) ||
    (quoteSummaryRaw &&
      (quoteSummaryRaw.total != null || (quoteSummaryRaw.breakdown?.length ?? 0) > 0)) ||
    inquiredAt;

  let quoteSnapshot: Record<string, unknown> | null = null;
  if (hasOptionPayload) {
    quoteSnapshot = {
      inquiredAt: inquiredAt || new Date().toISOString(),
    };
    if (selectedOptions && Object.keys(selectedOptions).length > 0) {
      quoteSnapshot.selectedOptions = selectedOptions;
    }
    if (quoteSummaryRaw && (quoteSummaryRaw.total != null || (quoteSummaryRaw.breakdown?.length ?? 0) > 0)) {
      quoteSnapshot.quoteSummary = {
        total: quoteSummaryRaw.total,
        basePrice: quoteSummaryRaw.base_price,
        breakdown: (quoteSummaryRaw.breakdown ?? []).map((b) => ({
          groupLabel: b.group_label,
          optionLabel: b.option_label,
          priceDelta: b.price_delta,
        })),
      };
    }
  }

  const contentValue = content ?? "";
  const insertPayload: Record<string, unknown> = {
    name,
    phone,
    content: contentValue,
    product_id: productId || null,
    product_title: productTitle || null,
    source_path: sourcePath || null,
  };
  if (quoteSnapshot) {
    insertPayload.quote_snapshot = quoteSnapshot;
  }
  if (firstTouch != null && typeof firstTouch === "object") {
    insertPayload.first_touch = firstTouch;
  }
  if (inquiryPageUrl) {
    insertPayload.inquiry_page_url = inquiryPageUrl;
  }

  const attribution = inferAttribution(firstTouch ?? undefined);
  insertPayload.acquisition_channel = attribution.acquisition_channel;
  insertPayload.acquisition_source_label = attribution.acquisition_source_label;
  insertPayload.acquisition_medium = attribution.acquisition_medium;
  insertPayload.acquisition_summary = attribution.acquisition_summary;
  insertPayload.first_landing_path = attribution.first_landing_path;

  const profile = await findOrCreateCustomerProfile({
    name,
    phone,
    source: "inquiry",
  });
  if (profile) {
    insertPayload.customer_profile_id = profile.id;
  }

  // 1차: 전체 payload(quote_snapshot, customer_profile_id, product_*, source_path 포함)로 insert
  const insertResultWithProduct = await supabase
    .from("inquiries")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  let inquiryId = insertResultWithProduct.data?.id;
  if (insertResultWithProduct.error || !insertResultWithProduct.data) {
    const firstError = insertResultWithProduct.error;
    const code = firstError?.code;

    // 2차: quote_snapshot만 제거하고 재시도 (product_*, source_path, customer_profile_id 유지)
    if (code === "42703" && quoteSnapshot) {
      const withoutQuote: Record<string, unknown> = {
        name,
        phone,
        content: contentValue,
        product_id: productId || null,
        product_title: productTitle || null,
        source_path: sourcePath || null,
      };
      if (insertPayload.customer_profile_id) {
        withoutQuote.customer_profile_id = insertPayload.customer_profile_id;
      }
      const retryWithoutQuote = await supabase
        .from("inquiries")
        .insert(withoutQuote)
        .select("id")
        .maybeSingle();
      if (!retryWithoutQuote.error && retryWithoutQuote.data) {
        inquiryId = retryWithoutQuote.data.id;
        console.error("[inquiries POST] fallback: quote_snapshot 제거 후 저장 성공", {
          code,
          message: firstError?.message,
        });
      }
    }

    if (!inquiryId) {
      // 3차: customer_profile_id 제거 후 재시도 (product_*, source_path 유지)
      const withoutProfile: Record<string, unknown> = {
        name,
        phone,
        content: contentValue,
        product_id: productId || null,
        product_title: productTitle || null,
        source_path: sourcePath || null,
      };
      const retryWithoutProfile = await supabase
        .from("inquiries")
        .insert(withoutProfile)
        .select("id")
        .maybeSingle();
      if (!retryWithoutProfile.error && retryWithoutProfile.data) {
        inquiryId = retryWithoutProfile.data.id;
        console.error("[inquiries POST] fallback: customer_profile_id 제거 후 저장 성공", {
          code: firstError?.code,
          message: firstError?.message,
        });
      }
    }

    // 최종: 정말 불가할 때만 최소 필드 insert
    if (!inquiryId) {
      const insertLegacy = await supabase
        .from("inquiries")
        .insert({
          name,
          phone,
          content: contentValue,
        })
        .select("id")
        .maybeSingle();
      if (insertLegacy.error || !insertLegacy.data) {
        console.error("[inquiries POST] fallback: 최소 필드 insert 실패", {
          error: insertLegacy.error?.message,
          code: insertLegacy.error?.code,
        });
        return NextResponse.json({ message: "문의 저장에 실패했습니다." }, { status: 500 });
      }
      inquiryId = insertLegacy.data.id;
      console.error("[inquiries POST] fallback: 최소 필드(name,phone,content)만 저장됨. product/customer_profile 등 유실 가능.");
    }
  }

  // 문의 저장 성공 이후: 가비아 알리고 중계 서버 호출 (부수효과, 실패해도 응답 유지)
  const normalizedPhone = normalizeReceiverPhone(phone);
  const message = [
    "[더올투어 문의접수]",
    `이름: ${name}`,
    `연락처: ${normalizedPhone}`,
    productTitle ? `상품: ${productTitle}` : null,
    sourcePath ? `유입: ${sourcePath}` : null,
    contentValue ? `문의내용: ${contentValue}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    console.log("[inquiries] calling aligo relay server", {
      inquiryId,
      phone,
      normalizedPhone,
      productTitle: productTitle || null,
      sourcePath: sourcePath || null,
    });

    const { data } = await sendAligoRelay({
      receiver: normalizedPhone,
      msg: message,
      relayExtras: {
        name,
        phone,
        product_title: productTitle || null,
        source_path: sourcePath || null,
        content: contentValue || "",
      },
    });

    console.log("[inquiries] aligo relay success", {
      inquiryId,
      data,
    });
  } catch (error) {
    console.error("[inquiries] failed to call aligo relay server", {
      inquiryId,
      error,
    });
  }

  await Promise.allSettled([
    notifyInquiryCreated({ name, phone, content: contentValue }),
    createNewInquiryNotification({
      inquiryId: String(inquiryId),
      name,
      phone,
      content: contentValue,
    }),
  ]);

  return NextResponse.json({ message: "문의가 저장되었습니다." }, { status: 201 });
}
