"use client";

import { useState, useCallback } from "react";

export type CatalogItem = {
  id: string;
  title: string;
  description: string | null;
  point_cost: number;
  stock: number | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

type Props = {
  item: CatalogItem;
  onClose: () => void;
  onSuccess: () => void;
};

export default function RewardExchangeModal({ item, onClose, onSuccess }: Props) {
  const [shippingName, setShippingName] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [zip, setZip] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!consent) {
        setError("개인정보 제공 및 배송 목적 동의에 체크해 주세요.");
        return;
      }
      if (!shippingName.trim() || !shippingPhone.trim() || !address1.trim()) {
        setError("수령인 이름, 연락처, 주소를 모두 입력해 주세요.");
        return;
      }
      setSubmitting(true);
      setError("");
      try {
        const res = await fetch("/api/rewards/redemptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            catalogId: item.id,
            shippingInfo: {
              shipping_name: shippingName.trim(),
              shipping_phone: shippingPhone.trim(),
              shipping_address1: address1.trim(),
              shipping_address2: address2.trim() || undefined,
              shipping_zip: zip.trim() || undefined,
            },
            userMessage: userMessage.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.message ?? "신청에 실패했습니다.");
          return;
        }
        onSuccess();
        onClose();
      } finally {
        setSubmitting(false);
      }
    },
    [item.id, consent, shippingName, shippingPhone, address1, address2, zip, userMessage, onClose, onSuccess]
  );

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exchange-modal-title"
    >
      <div
        className="modal-container max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="exchange-modal-title" className="text-lg font-semibold text-[var(--text-primary)]">
          교환 신청 · {item.title}
        </h2>
        <p className="mt-1 text-sm font-semibold text-[var(--primary)]">
          {Number(item.point_cost).toLocaleString()}P 차감
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-[var(--text-secondary)]">수령인 이름 *</span>
            <input
              type="text"
              value={shippingName}
              onChange={(e) => setShippingName(e.target.value)}
              className="input-base mt-1 w-full bg-[var(--surface)]"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text-secondary)]">연락처 *</span>
            <input
              type="text"
              value={shippingPhone}
              onChange={(e) => setShippingPhone(e.target.value)}
              className="input-base mt-1 w-full bg-[var(--surface)]"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text-secondary)]">주소 *</span>
            <input
              type="text"
              value={address1}
              onChange={(e) => setAddress1(e.target.value)}
              placeholder="기본 주소"
              className="input-base mt-1 w-full bg-[var(--surface)]"
              required
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text-secondary)]">상세 주소</span>
            <input
              type="text"
              value={address2}
              onChange={(e) => setAddress2(e.target.value)}
              placeholder="상세주소, 동/호수 등"
              className="input-base mt-1 w-full bg-[var(--surface)]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text-secondary)]">우편번호</span>
            <input
              type="text"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              className="input-base mt-1 w-full bg-[var(--surface)]"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-[var(--text-secondary)]">요청 메모</span>
            <textarea
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              rows={2}
              className="input-base mt-1 w-full resize-none bg-[var(--surface)]"
              placeholder="배송 시 요청사항 등"
            />
          </label>

          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">안내</p>
            <p className="mt-1">
              신청 시 보유 포인트에서 해당 포인트가 <strong>즉시 차감(RESERVE)</strong>됩니다. 승인 후 발송되며,
              반려 시 포인트가 복구됩니다.
            </p>
          </div>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 rounded border-[var(--border)] bg-[var(--surface)]"
            />
            <span className="text-sm text-[var(--text-secondary)]">
              수령인 이름, 연락처, 주소를 경품 배송 목적으로 수집·이용하는 것에 동의합니다. (필수)
            </span>
          </label>

          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-admin-secondary flex-1"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-admin-primary flex-1 disabled:opacity-50"
            >
              {submitting ? "신청 중…" : "교환 신청"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
