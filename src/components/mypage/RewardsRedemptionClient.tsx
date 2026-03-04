"use client";

import { useMemo, useState } from "react";

type CatalogItem = {
  id: string;
  title: string;
  description: string | null;
  point_cost: number;
  stock: number | null;
  image_url: string | null;
};

type Props = {
  initialCatalog: CatalogItem[];
  initialBalance: number;
  initialName?: string;
  initialPhone?: string;
};

type FormState = {
  shippingName: string;
  shippingPhone: string;
  shippingZip: string;
  shippingAddress1: string;
  shippingAddress2: string;
  contactTime: string;
  userMessage: string;
};

const INITIAL_FORM: FormState = {
  shippingName: "",
  shippingPhone: "",
  shippingZip: "",
  shippingAddress1: "",
  shippingAddress2: "",
  contactTime: "",
  userMessage: "",
};

export default function RewardsRedemptionClient({
  initialCatalog,
  initialBalance,
  initialName,
  initialPhone,
}: Props) {
  const [catalog] = useState(initialCatalog);
  const [balance, setBalance] = useState(initialBalance);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<FormState>({
    ...INITIAL_FORM,
    shippingName: initialName ?? "",
    shippingPhone: initialPhone ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const canSubmit = useMemo(() => {
    if (!selected) return false;
    return Boolean(form.shippingName && form.shippingPhone && form.shippingAddress1);
  }, [selected, form.shippingName, form.shippingPhone, form.shippingAddress1]);

  const refreshPoints = async () => {
    const res = await fetch("/api/me/points", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setBalance(Number(data?.balance ?? 0));
  };

  const requestRedemption = async () => {
    if (!selected || !canSubmit) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/me/rewards/redemptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogId: selected.id,
          shippingName: form.shippingName,
          shippingPhone: form.shippingPhone,
          shippingZip: form.shippingZip || undefined,
          shippingAddress1: form.shippingAddress1,
          shippingAddress2: form.shippingAddress2 || undefined,
          contactTime: form.contactTime || undefined,
          userMessage: form.userMessage || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.message || "신청에 실패했습니다." });
        return;
      }
      setMessage({ type: "ok", text: "신청이 완료되었습니다. 신청 내역에서 상태를 확인해 주세요." });
      setSelected(null);
      setForm((prev) => ({ ...INITIAL_FORM, shippingName: prev.shippingName, shippingPhone: prev.shippingPhone }));
      await refreshPoints();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--text-secondary)]">현재 사용 가능 포인트</p>
        <p className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{balance.toLocaleString()}P</p>
      </div>

      <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {catalog.map((reward) => (
          <article key={reward.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)]">
              <span className="text-xs text-[var(--text-secondary)]">{reward.image_url ? "이미지" : "이미지 placeholder"}</span>
            </div>
            <h2 className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{reward.title}</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{Number(reward.point_cost).toLocaleString()}P 필요</p>
            <button
              type="button"
              onClick={() => setSelected(reward)}
              className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              교환하기
            </button>
          </article>
        ))}
      </div>

      {message ? (
        <p className={message.type === "ok" ? "text-sm text-[var(--success)]" : "text-sm text-[var(--danger)]"}>{message.text}</p>
      ) : null}

      {selected ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="text-base font-semibold text-[var(--text-primary)]">교환 신청 - {selected.title}</h3>
          <div className="mt-3 flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
            <input
              value={form.shippingName}
              onChange={(e) => setForm((prev) => ({ ...prev, shippingName: e.target.value }))}
              placeholder="수령인 이름 *"
              className="input-base bg-[var(--surface-muted)]"
            />
            <input
              value={form.shippingPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, shippingPhone: e.target.value }))}
              placeholder="연락처 *"
              className="input-base bg-[var(--surface-muted)]"
            />
            <input
              value={form.shippingZip}
              onChange={(e) => setForm((prev) => ({ ...prev, shippingZip: e.target.value }))}
              placeholder="우편번호"
              className="input-base bg-[var(--surface-muted)]"
            />
            <input
              value={form.contactTime}
              onChange={(e) => setForm((prev) => ({ ...prev, contactTime: e.target.value }))}
              placeholder="연락 가능한 시간대 (선택)"
              className="input-base bg-[var(--surface-muted)]"
            />
            <input
              value={form.shippingAddress1}
              onChange={(e) => setForm((prev) => ({ ...prev, shippingAddress1: e.target.value }))}
              placeholder="주소 1 *"
              className="input-base bg-[var(--surface-muted)] sm:col-span-2"
            />
            <input
              value={form.shippingAddress2}
              onChange={(e) => setForm((prev) => ({ ...prev, shippingAddress2: e.target.value }))}
              placeholder="주소 2"
              className="input-base bg-[var(--surface-muted)] sm:col-span-2"
            />
            <textarea
              value={form.userMessage}
              onChange={(e) => setForm((prev) => ({ ...prev, userMessage: e.target.value }))}
              placeholder="요청사항 (선택)"
              className="input-base resize-none bg-[var(--surface-muted)] sm:col-span-2"
              rows={3}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={requestRedemption}
              disabled={!canSubmit || submitting}
              className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--on-primary)] disabled:opacity-50"
            >
              {submitting ? "신청 중..." : "신청하기"}
            </button>
            <a
              href="/mypage/redemptions"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-sm text-[var(--text-primary)]"
            >
              신청내역 보기
            </a>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-[var(--text-secondary)]"
            >
              취소
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
