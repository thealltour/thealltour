import "server-only";

import type { QuoteSnapshot } from "@/types/inquiry";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type RecommendedBookingProduct = {
  product_id: string | null;
  product_title: string;
  source: "inquiry" | "booking" | "catalog_match";
  source_id: string | null;
  source_label: string;
  quoted_total: number | null;
  catalog_price: number | null;
  is_active: boolean | null;
  reason: string;
};

type RecommendedBookingProductInternal = RecommendedBookingProduct & {
  sort_priority: number;
};

export type CustomerBookingContext = {
  customer: {
    customer_profile_id: string;
    member_id: string | null;
    name: string;
    phone: string;
    email: string | null;
  };
  recommended_products: RecommendedBookingProduct[];
  recent_inquiries: Array<{
    id: string;
    product_title: string | null;
    product_id: string | null;
    booking_status: string | null;
    consultation_status: string | null;
    created_at: string | null;
  }>;
  recent_bookings: Array<{
    id: string;
    booking_number: string;
    product_title: string | null;
    product_id: string | null;
    booking_status: string;
    created_at: string | null;
  }>;
  hints: {
    payment_total_amount: number | null;
    departure_date: string | null;
  };
};

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, "\\$&");
}

function parseQuoteTotal(snapshot: unknown): number | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as Record<string, unknown>;
  const summary = (s.quoteSummary ?? s.quote_summary) as Record<string, unknown> | undefined;
  if (!summary) return null;
  const total = summary.total ?? summary.total_amount;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  return null;
}

function parseDesiredDeparture(snapshot: unknown): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const s = snapshot as QuoteSnapshot;
  const date = s.desiredDeparture?.date;
  return typeof date === "string" && date.trim() ? date.trim() : null;
}

function recoKey(productId: string | null, productTitle: string): string {
  return `${productId ?? ""}::${productTitle.trim().toLowerCase()}`;
}

export async function getCustomerBookingContext(input: {
  customer_profile_id: string;
  member_id?: string | null;
}): Promise<CustomerBookingContext> {
  const profileId = input.customer_profile_id.trim();
  const memberId = input.member_id?.trim() || null;

  const { data: profileRow } = await supabaseAdmin
    .from("customer_profiles")
    .select("id, name, phone, email")
    .eq("id", profileId)
    .maybeSingle();

  let customerName = String(profileRow?.name ?? "");
  let customerPhone = String(profileRow?.phone ?? "");
  let customerEmail = typeof profileRow?.email === "string" ? profileRow.email : null;

  if (memberId) {
    const { data: memberRow } = await supabaseAdmin
      .from("members")
      .select("name, phone, email")
      .eq("id", memberId)
      .maybeSingle();
    if (memberRow) {
      customerName = customerName || String(memberRow.name ?? "");
      customerPhone = customerPhone || String(memberRow.phone ?? "");
      customerEmail = customerEmail ?? (typeof memberRow.email === "string" ? memberRow.email : null);
    }
  }

  let inquiryQuery = supabaseAdmin
    .from("inquiries")
    .select(
      "id, product_id, product_title, booking_status, consultation_status, quote_snapshot, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(10);

  if (memberId) {
    inquiryQuery = inquiryQuery.or(
      `customer_profile_id.eq.${profileId},member_id.eq.${memberId}`,
    );
  } else {
    inquiryQuery = inquiryQuery.eq("customer_profile_id", profileId);
  }

  let bookingQuery = supabaseAdmin
    .from("travel_bookings")
    .select("id, booking_number, product_id, product_title, booking_status, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  if (memberId) {
    bookingQuery = bookingQuery.or(
      `customer_profile_id.eq.${profileId},member_id.eq.${memberId}`,
    );
  } else {
    bookingQuery = bookingQuery.eq("customer_profile_id", profileId);
  }

  const [inquiriesRes, bookingsRes] = await Promise.all([inquiryQuery, bookingQuery]);

  const inquiries = inquiriesRes.data ?? [];
  const bookings = bookingsRes.data ?? [];

  const recent_inquiries = inquiries.map((row) => ({
    id: String(row.id),
    product_title: typeof row.product_title === "string" ? row.product_title : null,
    product_id: typeof row.product_id === "string" ? row.product_id : null,
    booking_status: typeof row.booking_status === "string" ? row.booking_status : null,
    consultation_status:
      typeof row.consultation_status === "string" ? row.consultation_status : null,
    created_at: row.created_at ? String(row.created_at) : null,
  }));

  const recent_bookings = bookings.map((row) => ({
    id: String(row.id),
    booking_number: String(row.booking_number ?? ""),
    product_title: typeof row.product_title === "string" ? row.product_title : null,
    product_id: typeof row.product_id === "string" ? row.product_id : null,
    booking_status: String(row.booking_status ?? "reserved"),
    created_at: row.created_at ? String(row.created_at) : null,
  }));

  const recoMap = new Map<string, RecommendedBookingProductInternal>();
  const titlesNeedingMatch: string[] = [];

  for (const inq of inquiries) {
    const title = typeof inq.product_title === "string" ? inq.product_title.trim() : "";
    if (!title) continue;

    const productId = typeof inq.product_id === "string" ? inq.product_id : null;
    const bookingStatus = typeof inq.booking_status === "string" ? inq.booking_status : "none";
    const isActiveIntent = bookingStatus !== "reserved" && bookingStatus !== "completed";
    const priority = isActiveIntent ? 1 : 2;
    const key = recoKey(productId, title);

    if (!recoMap.has(key) || (recoMap.get(key)!.sort_priority > priority)) {
      recoMap.set(key, {
        product_id: productId,
        product_title: title,
        source: "inquiry",
        source_id: String(inq.id),
        source_label: isActiveIntent ? `진행 중 문의 #${inq.id}` : `최근 문의 #${inq.id}`,
        quoted_total: parseQuoteTotal(inq.quote_snapshot),
        catalog_price: null,
        is_active: null,
        reason: isActiveIntent ? "진행 중 문의" : "최근 문의",
        sort_priority: priority,
      });
    }

    if (!productId) titlesNeedingMatch.push(title);
  }

  for (const book of bookings) {
    const title = typeof book.product_title === "string" ? book.product_title.trim() : "";
    if (!title) continue;

    const productId = typeof book.product_id === "string" ? book.product_id : null;
    const key = recoKey(productId, title);
    if (recoMap.has(key)) continue;

    recoMap.set(key, {
      product_id: productId,
      product_title: title,
      source: "booking",
      source_id: String(book.id),
      source_label: `과거 예약 ${book.booking_number ?? book.id}`,
      quoted_total: null,
      catalog_price: null,
      is_active: null,
      reason: "과거 예약",
      sort_priority: 3,
    });

    if (!productId) titlesNeedingMatch.push(title);
  }

  const productIds = [...new Set([...recoMap.values()].map((r) => r.product_id).filter(Boolean))] as string[];
  const catalogById = new Map<
    string,
    { price: number | null; is_active: boolean | null; title: string }
  >();

  if (productIds.length > 0) {
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, title, price, is_active")
      .in("id", productIds);

    for (const p of products ?? []) {
      catalogById.set(String(p.id), {
        price: typeof p.price === "number" ? p.price : null,
        is_active: typeof p.is_active === "boolean" ? p.is_active : null,
        title: String(p.title ?? ""),
      });
    }
  }

  for (const title of [...new Set(titlesNeedingMatch)]) {
    const escaped = escapeIlike(title.slice(0, 80));
    const { data: matched } = await supabaseAdmin
      .from("products")
      .select("id, title, price, is_active")
      .ilike("title", `%${escaped}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!matched) continue;

    const matchId = String(matched.id);
    const matchTitle = String(matched.title ?? title);
    const key = recoKey(matchId, matchTitle);
    if (recoMap.has(key)) continue;

    recoMap.set(key, {
      product_id: matchId,
      product_title: matchTitle,
      source: "catalog_match",
      source_id: null,
      source_label: "상품명 매칭",
      quoted_total: null,
      catalog_price: typeof matched.price === "number" ? matched.price : null,
      is_active: typeof matched.is_active === "boolean" ? matched.is_active : null,
      reason: "카탈로그 매칭 (확인 필요)",
      sort_priority: 4,
    });
  }

  const recommended_products = [...recoMap.values()]
    .map((item) => {
      if (item.product_id && catalogById.has(item.product_id)) {
        const cat = catalogById.get(item.product_id)!;
        return {
          ...item,
          product_title: item.product_title || cat.title,
          catalog_price: cat.price,
          is_active: cat.is_active,
        };
      }
      return item;
    })
    .sort((a, b) => a.sort_priority - b.sort_priority || a.product_title.localeCompare(b.product_title))
    .map(({ sort_priority: _sort, ...rest }) => rest);

  const topInquiry = inquiries.find((inq) => {
    const bs = typeof inq.booking_status === "string" ? inq.booking_status : "none";
    return bs !== "reserved" && bs !== "completed";
  }) ?? inquiries[0];

  const hints = {
    payment_total_amount: topInquiry ? parseQuoteTotal(topInquiry.quote_snapshot) : null,
    departure_date: topInquiry ? parseDesiredDeparture(topInquiry.quote_snapshot) : null,
  };

  return {
    customer: {
      customer_profile_id: profileId,
      member_id: memberId,
      name: customerName || "고객",
      phone: customerPhone,
      email: customerEmail,
    },
    recommended_products,
    recent_inquiries,
    recent_bookings,
    hints,
  };
}
