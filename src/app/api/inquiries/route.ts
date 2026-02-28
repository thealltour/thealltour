import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { notifyInquiryCreated } from "@/lib/notifications";
import { createNewInquiryNotification } from "@/lib/adminNotifications";
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
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    quote_snapshot: quote_snapshot ?? undefined,
  };
}

type ListStatus = "all" | "completed" | "pending";
type SortOption = "pending_first" | "recent" | "oldest" | "name";
type SafeSummary = { pendingCount: number; completedCount: number };

async function getInquirySummarySafe(): Promise<SafeSummary> {
  const [pendingSummary, completedSummary] = await Promise.all([
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("is_completed", false),
    supabase.from("inquiries").select("*", { count: "exact", head: true }).eq("is_completed", true),
  ]);

  return {
    pendingCount: pendingSummary.error ? 0 : (pendingSummary.count ?? 0),
    completedCount: completedSummary.error ? 0 : (completedSummary.count ?? 0),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const statusParam = url.searchParams.get("status");
  const status: ListStatus =
    statusParam === "completed" || statusParam === "pending" ? statusParam : "all";
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

  if (status === "completed") query = query.eq("is_completed", true);
  if (status === "pending") query = query.eq("is_completed", false);

  if (sort === "pending_first") {
    query = query.order("is_completed", { ascending: true }).order("created_at", { ascending: false });
  } else if (sort === "oldest") {
    query = query.order("created_at", { ascending: true });
  } else if (sort === "name") {
    query = query.order("name", { ascending: true }).order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  let { data, error, count } = await query.range(from, to);

  if (error) {
    // Fallback for legacy schema (e.g. missing is_completed/product_title columns).
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
  });
}

type BulkPatchBody = {
  ids?: string[];
  is_completed?: boolean;
};

export async function PATCH(request: Request) {
  const body = (await request.json()) as BulkPatchBody;
  const ids = Array.isArray(body.ids) ? body.ids.filter(Boolean) : [];
  const isCompleted = body.is_completed;

  if (ids.length === 0 || typeof isCompleted !== "boolean") {
    return NextResponse.json(
      { message: "ids 배열과 is_completed(boolean) 값이 필요합니다." },
      { status: 400 },
    );
  }

  const updateResults = await Promise.all(
    ids.map((id) =>
      supabase
        .from("inquiries")
        .update({ is_completed: isCompleted })
        .eq("id", id),
    ),
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

  if (!name || !phone || !content) {
    return NextResponse.json({ message: "이름, 연락처, 문의 내용은 필수입니다." }, { status: 400 });
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

  const insertPayload: Record<string, unknown> = {
    name,
    phone,
    content,
    product_id: productId || null,
    product_title: productTitle || null,
    source_path: sourcePath || null,
  };
  if (quoteSnapshot) {
    insertPayload.quote_snapshot = quoteSnapshot;
  }

  const insertResultWithProduct = await supabase
    .from("inquiries")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  let inquiryId = insertResultWithProduct.data?.id;
  if (insertResultWithProduct.error || !insertResultWithProduct.data) {
    if (insertResultWithProduct.error?.code === "42703" && quoteSnapshot) {
      const retry = await supabase
        .from("inquiries")
        .insert({
          name,
          phone,
          content,
          product_id: productId || null,
          product_title: productTitle || null,
          source_path: sourcePath || null,
        })
        .select("id")
        .maybeSingle();
      if (!retry.error && retry.data) {
        inquiryId = retry.data.id;
      }
    }
    if (!inquiryId) {
      const insertLegacy = await supabase
        .from("inquiries")
        .insert({
          name,
          phone,
          content,
        })
        .select("id")
        .maybeSingle();
      if (insertLegacy.error || !insertLegacy.data) {
        return NextResponse.json({ message: "문의 저장에 실패했습니다." }, { status: 500 });
      }
      inquiryId = insertLegacy.data.id;
    }
  }

  await notifyInquiryCreated({ name, phone, content });
  await createNewInquiryNotification({
    inquiryId: String(inquiryId),
    name,
    phone,
    content,
  });

  return NextResponse.json({ message: "문의가 저장되었습니다." }, { status: 201 });
}
