import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { findOrCreateCustomerProfile } from "@/lib/customerProfiles";
import { notifyInquiryCreated } from "@/lib/notifications";
import { createNewInquiryNotification } from "@/lib/adminNotifications";
import { inferAttribution } from "@/lib/analytics/attribution";
import type { Inquiry, InquiryInput } from "@/types/inquiry";

function normalizeInquiryRow(row: Record<string, unknown>) {
  const quoteSnapshotRaw = row.quote_snapshot;
  let quote_snapshot: Inquiry["quote_snapshot"] = undefined;
  if (quoteSnapshotRaw && typeof quoteSnapshotRaw === "object") {
    const o = quoteSnapshotRaw as Record<string, unknown>;
    const qs = o.quoteSummary as Record<string, unknown> | undefined;
    quote_snapshot = {
      selectedOptions:
        o.selectedOptions && typeof o.selectedOptions === "object"
          ? (o.selectedOptions as Record<string, string>)
          : undefined,
      quoteSummary: qs
        ? {
            total: qs.total as number | null,
            basePrice: qs.basePrice as number | null,
            breakdown: Array.isArray(qs.breakdown)
              ? (qs.breakdown as Array<{ groupLabel: string; optionLabel: string; priceDelta: number }>)
              : [],
          }
        : undefined,
      inquiredAt: typeof o.inquiredAt === "string" ? o.inquiredAt : undefined,
    };
    if (!quote_snapshot.selectedOptions && !quote_snapshot.quoteSummary && !quote_snapshot.inquiredAt) {
      quote_snapshot = undefined;
    }
  }
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    content: String(row.content ?? ""),
    product_id: typeof row.product_id === "string" ? row.product_id : undefined,
    product_title: typeof row.product_title === "string" ? row.product_title : undefined,
    source_path: typeof row.source_path === "string" ? row.source_path : undefined,
    is_completed: typeof row.is_completed === "boolean" ? row.is_completed : undefined,
    customer_profile_id: typeof row.customer_profile_id === "string" ? row.customer_profile_id : undefined,
    consultation_status: typeof row.consultation_status === "string" ? row.consultation_status : undefined,
    booking_status: typeof row.booking_status === "string" ? row.booking_status : undefined,
    completed_at: typeof row.completed_at === "string" ? row.completed_at : undefined,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    quote_snapshot: quote_snapshot ?? undefined,
    first_touch:
      row.first_touch != null && typeof row.first_touch === "object"
        ? (row.first_touch as Inquiry["first_touch"])
        : undefined,
    inquiry_page_url: typeof row.inquiry_page_url === "string" ? row.inquiry_page_url : undefined,
    acquisition_channel: typeof row.acquisition_channel === "string" ? row.acquisition_channel : undefined,
    acquisition_source_label:
      typeof row.acquisition_source_label === "string" ? row.acquisition_source_label : undefined,
    acquisition_medium: typeof row.acquisition_medium === "string" ? row.acquisition_medium : undefined,
    acquisition_summary: typeof row.acquisition_summary === "string" ? row.acquisition_summary : undefined,
    first_landing_path: typeof row.first_landing_path === "string" ? row.first_landing_path : undefined,
  };
}

type ListStatus =
  | "all"
  | "new"
  | "contacted"
  | "closed"
  | "reserved"
  | "completed"
  | "pending"
  | "completed_legacy";
type SortOption = "pending_first" | "recent" | "oldest" | "name";
type SafeSummary = {
  pendingCount: number;
  completedCount: number;
  reservedCount: number;
  newCount: number;
  contactedCount: number;
  closedCount: number;
};

async function getInquirySummarySafe(): Promise<SafeSummary> {
  const [
    pendingSummary,
    completedSummary,
    reservedSummary,
    newSummary,
    contactedSummary,
    closedSummary,
  ] = await Promise.all([
    supabase
      .from("inquiries")
      .select("*", { count: "exact", head: true })
      .or("consultation_status.neq.closed,booking_status.eq.none"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("booking_status", "completed"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("booking_status", "reserved"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("consultation_status", "new"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("consultation_status", "contacted"),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("consultation_status", "closed"),
  ]);

  if (
    pendingSummary.error ||
    completedSummary.error ||
    reservedSummary.error ||
    newSummary.error ||
    contactedSummary.error ||
    closedSummary.error
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
    };
  }

  return {
    pendingCount: pendingSummary.count ?? 0,
    completedCount: completedSummary.count ?? 0,
    reservedCount: reservedSummary.count ?? 0,
    newCount: newSummary.count ?? 0,
    contactedCount: contactedSummary.count ?? 0,
    closedCount: closedSummary.count ?? 0,
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
    statusParam === "reserved" ||
    statusParam === "completed" ||
    statusParam === "pending" ||
    statusParam === "completed_legacy"
      ? statusParam
      : "all";
  const sortParam = url.searchParams.get("sort");
  const sort: SortOption =
    sortParam === "recent" || sortParam === "oldest" || sortParam === "name" || sortParam === "pending_first"
      ? sortParam
      : "pending_first";
  const pageRaw = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const pageSizeRaw = Number.parseInt(url.searchParams.get("pageSize") ?? "10", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isFinite(pageSizeRaw) ? Math.min(Math.max(pageSizeRaw, 5), 50) : 10;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("inquiries").select("*", { count: "exact" });

  if (search) {
    const escaped = search.replace(/[%_]/g, "\\$&");
    query = query.or(
      `name.ilike.%${escaped}%,phone.ilike.%${escaped}%,content.ilike.%${escaped}%,product_title.ilike.%${escaped}%`,
    );
  }

  if (status === "new") query = query.eq("consultation_status", "new");
  else if (status === "contacted") query = query.eq("consultation_status", "contacted");
  else if (status === "closed") query = query.eq("consultation_status", "closed");
  else if (status === "reserved") query = query.eq("booking_status", "reserved");
  else if (status === "completed") query = query.eq("booking_status", "completed");
  else if (status === "pending") {
    query = query.or("consultation_status.neq.closed,booking_status.eq.none");
  } else if (status === "completed_legacy") {
    query = query.eq("is_completed", true);
  }

  if (sort === "pending_first") {
    query = query.order("consultation_status", { ascending: true }).order("created_at", { ascending: false });
  } else if (sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (sort === "name") {
    query = query.order("name", { ascending: true }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  let { data, error, count } = await query.range(from, to);

  if (error) {
    let fallback = supabase.from("inquiries").select("*", { count: "exact" });
    if (search) {
      const escaped = search.replace(/[%_]/g, "\\$&");
      fallback = fallback.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,content.ilike.%${escaped}%`);
    }
    const fallbackResult = await fallback
      .order("created_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    data = fallbackResult.data;
    error = fallbackResult.error;
    count = fallbackResult.count ?? 0;
  }

  if (error) {
    return NextResponse.json({ message: "문의 목록 조회에 실패했습니다." }, { status: 500 });
  }

  const summary = await getInquirySummarySafe();

  return NextResponse.json({
    items: (data ?? []).map((row) => normalizeInquiryRow(row as Record<string, unknown>)),
    total: count ?? 0,
    page,
    pageSize,
    pendingCount: summary.pendingCount,
    completedCount: summary.completedCount,
    reservedCount: summary.reservedCount,
    newCount: summary.newCount,
    contactedCount: summary.contactedCount,
    closedCount: summary.closedCount,
  });
}

type BulkPatchBody = {
  ids?: string[];
  /** @deprecated 단계적 deprecated. consultation_status / booking_status 사용 권장.
   * TODO(후속 PR): 관리자 문의 UI를 consultation_status/booking_status 기반으로 개편 후 is_completed 제거. */
  is_completed?: boolean;
  consultation_status?: "new" | "contacted" | "closed";
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
  const normalizedPhone = phone.replace(/[^0-9]/g, "");
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

  const aligoController = new AbortController();
  const aligoTimeout = setTimeout(() => aligoController.abort(), 5000);

  try {
    console.log("[inquiries] calling aligo relay server", {
      inquiryId,
      phone,
      normalizedPhone,
      productTitle: productTitle || null,
      sourcePath: sourcePath || null,
    });

    const relayResponse = await fetch("http://121.78.183.144:3000/send-aligo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiver: normalizedPhone,
        msg: message,
      }),
      signal: aligoController.signal,
    });

    const relayBody = await relayResponse.text();

    if (!relayResponse.ok) {
      console.error("[inquiries] aligo relay responded with non-2xx", {
        inquiryId,
        status: relayResponse.status,
        body: relayBody,
      });
    } else {
      console.log("[inquiries] aligo relay success", {
        inquiryId,
        status: relayResponse.status,
        body: relayBody,
      });
    }
  } catch (error) {
    console.error("[inquiries] failed to call aligo relay server", {
      inquiryId,
      error,
    });
  } finally {
    clearTimeout(aligoTimeout);
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
