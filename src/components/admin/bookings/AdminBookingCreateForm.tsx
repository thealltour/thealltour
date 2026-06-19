"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  BookingCustomerSearchPicker,
  type SelectedBookingCustomer,
} from "@/components/admin/bookings/BookingCustomerSearchPicker";
import {
  BookingProductPicker,
  type SelectedBookingProduct,
} from "@/components/admin/bookings/BookingProductPicker";

function AdminBookingCreateFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [customer, setCustomer] = useState<SelectedBookingCustomer | null>(null);
  const [inquiryId, setInquiryId] = useState<string | null>(null);
  const [product, setProduct] = useState<SelectedBookingProduct | null>(null);
  const [form, setForm] = useState({
    departure_date: "",
    return_date: "",
    traveler_count: "1",
    payer_name: "",
    primary_traveler_phone: "",
    payment_total: "",
    payment_paid: "",
  });

  useEffect(() => {
    const linkedInquiryId = searchParams.get("inquiry_id")?.trim();
    if (linkedInquiryId) {
      setInquiryId(linkedInquiryId);
    }

    const profileId = searchParams.get("customer_profile_id")?.trim();
    if (!profileId || customer) return;

    const memberId = searchParams.get("member_id")?.trim() || null;
    const productId = searchParams.get("product_id")?.trim() || null;
    const productTitle = searchParams.get("product_title")?.trim() || "";

    void (async () => {
      const params = new URLSearchParams({ customer_profile_id: profileId });
      if (memberId) params.set("member_id", memberId);
      const res = await fetch(`/api/admin/bookings/customer-context?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.customer) return;

      setCustomer({
        customer_profile_id: data.customer.customer_profile_id,
        member_id: data.customer.member_id,
        name: data.customer.name,
        phone: data.customer.phone,
        email: data.customer.email,
        label: "링크로 연결됨",
      });
      setForm((prev) => ({
        ...prev,
        payer_name: data.customer.name || prev.payer_name,
        primary_traveler_phone: data.customer.phone || prev.primary_traveler_phone,
        departure_date: data.hints?.departure_date || prev.departure_date,
        payment_total:
          data.hints?.payment_total_amount != null
            ? String(data.hints.payment_total_amount)
            : prev.payment_total,
      }));

      if (productId && productTitle) {
        setProduct({
          product_id: productId,
          product_title: productTitle,
          source: "링크",
        });
      } else if (data.recommended_products?.[0]) {
        const top = data.recommended_products[0];
        setProduct({
          product_id: top.product_id,
          product_title: top.product_title,
          catalog_price: top.catalog_price,
          quoted_total: top.quoted_total,
          source: top.reason,
          is_active: top.is_active,
        });
        if (top.quoted_total != null && !form.payment_total) {
          setForm((prev) => ({ ...prev, payment_total: String(top.quoted_total) }));
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap from URL once
  }, [searchParams]);

  const handleCustomerChange = (next: SelectedBookingCustomer | null) => {
    setCustomer(next);
    setProduct(null);
    if (!next) return;
    setForm((prev) => ({
      ...prev,
      payer_name: next.name || prev.payer_name,
      primary_traveler_phone: next.phone || prev.primary_traveler_phone,
    }));
  };

  const handleProductChange = (next: SelectedBookingProduct | null) => {
    setProduct(next);
    if (!next) return;
    if (next.quoted_total != null) {
      setForm((prev) => ({ ...prev, payment_total: String(next.quoted_total) }));
    } else if (next.catalog_price != null) {
      setForm((prev) => ({
        ...prev,
        payment_total: prev.payment_total || String(next.catalog_price),
      }));
    }
  };

  const submit = async () => {
    if (!customer?.customer_profile_id) {
      setMessage("고객을 검색해 연결해 주세요.");
      return;
    }
    if (!form.departure_date || !form.return_date) {
      setMessage("출발일과 귀국일을 입력해 주세요.");
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_profile_id: customer.customer_profile_id,
          member_id: customer.member_id ?? undefined,
          inquiry_id: inquiryId ?? undefined,
          product_id: product?.product_id ?? undefined,
          product_title: product?.product_title?.trim() || undefined,
          departure_date: form.departure_date,
          return_date: form.return_date,
          traveler_count: Number(form.traveler_count) || 1,
          payer_name: form.payer_name.trim() || customer.name,
          primary_traveler_phone: form.primary_traveler_phone.trim() || customer.phone,
          travelers: (form.payer_name.trim() || customer.name)
            ? [{
                full_name: form.payer_name.trim() || customer.name,
                phone: form.primary_traveler_phone.trim() || customer.phone,
                is_primary: true,
                is_payer: true,
              }]
            : undefined,
          payment: {
            total_amount: form.payment_total ? Number(form.payment_total) : undefined,
            paid_amount: form.payment_paid ? Number(form.payment_paid) : undefined,
          },
          send_confirmation_sms: Boolean((form.primary_traveler_phone.trim() || customer.phone).trim()),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.message ?? "생성에 실패했습니다.");
        return;
      }
      router.push(`/theall_manager_only/bookings/${data.booking_id}`);
    } finally {
      setLoading(false);
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 md:p-6">
      <h2 className="text-lg font-semibold">예약 직접 생성</h2>
      <p className="text-sm text-[var(--text-muted)]">
        고객을 연결한 뒤 추천 상품 또는 카탈로그 검색으로 상품을 선택하세요.
      </p>

      {inquiryId ? (
        <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-muted)]">
          연결 문의: {inquiryId}
        </p>
      ) : null}

      <BookingCustomerSearchPicker
        value={customer}
        onChange={handleCustomerChange}
        onPrefill={(patch) => {
          setForm((prev) => ({
            ...prev,
            payer_name: patch.payer_name ?? prev.payer_name,
            primary_traveler_phone: patch.primary_traveler_phone ?? prev.primary_traveler_phone,
          }));
        }}
      />

      {customer ? (
        <BookingProductPicker
          value={product}
          onChange={handleProductChange}
          customerProfileId={customer.customer_profile_id}
          memberId={customer.member_id}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-muted)]">출발일 *</span>
          <input type="date" value={form.departure_date} onChange={set("departure_date")} className="input-base mt-1 w-full" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[var(--text-muted)]">귀국일 *</span>
          <input type="date" value={form.return_date} onChange={set("return_date")} className="input-base mt-1 w-full" />
        </label>
      </div>
      <input value={form.traveler_count} onChange={set("traveler_count")} type="number" min={1} placeholder="인원" className="input-base w-full max-w-xs" />
      <input value={form.payer_name} onChange={set("payer_name")} placeholder="결제자명" className="input-base w-full" />
      <input value={form.primary_traveler_phone} onChange={set("primary_traveler_phone")} placeholder="연락처" className="input-base w-full" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={form.payment_total} onChange={set("payment_total")} type="number" placeholder="총 금액" className="input-base" />
        <input value={form.payment_paid} onChange={set("payment_paid")} type="number" placeholder="입금액" className="input-base" />
      </div>
      {message ? <p className="text-sm text-[var(--danger)]">{message}</p> : null}
      <button
        type="button"
        disabled={loading || !customer}
        onClick={() => void submit()}
        className="rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-4 py-2 text-sm text-[var(--on-primary)] disabled:opacity-50"
      >
        {loading ? "생성 중…" : "예약 생성"}
      </button>
    </div>
  );
}

export default function AdminBookingCreateForm() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-[var(--text-muted)]">불러오는 중…</p>}>
      <AdminBookingCreateFormInner />
    </Suspense>
  );
}
