"use client";

import { useState } from "react";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Props = {
  onSubmitted: () => Promise<void> | void;
};

const MAX_FILES = 3;
const MAX_SIZE = 10 * 1024 * 1024;

export default function EarnRequestForm({ onSubmitted }: Props) {
  const [bookingRef, setBookingRef] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [payerName, setPayerName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [memo, setMemo] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const onChangeFiles = (nextFiles: FileList | null) => {
    const arr = nextFiles ? Array.from(nextFiles) : [];
    if (arr.length > MAX_FILES) {
      setMessage({ type: "err", text: "증빙 파일은 최대 3개까지 선택할 수 있습니다." });
      return;
    }
    for (const file of arr) {
      if (!(file.type.startsWith("image/") || file.type === "application/pdf")) {
        setMessage({ type: "err", text: "이미지 또는 PDF만 업로드 가능합니다." });
        return;
      }
      if (file.size > MAX_SIZE) {
        setMessage({ type: "err", text: "파일당 최대 10MB까지 업로드 가능합니다." });
        return;
      }
    }
    setFiles(arr);
    setMessage(null);
  };

  const submit = async () => {
    if (!bookingRef || !departureDate || !payerName) {
      setMessage({ type: "err", text: "예약번호, 출발일, 결제자명은 필수입니다." });
      return;
    }
    if (files.length < 1 || files.length > 3) {
      setMessage({ type: "err", text: "증빙 파일은 1~3개 업로드가 필요합니다." });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append("booking_ref", bookingRef);
      formData.append("departure_date", departureDate);
      formData.append("payer_name", payerName);
      formData.append("contact_phone", contactPhone);
      formData.append("memo", memo);
      files.forEach((file) => formData.append("attachments", file));

      const res = await fetch("/api/points/earn-requests", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "err", text: data.message || "요청 등록에 실패했습니다." });
        return;
      }

      setMessage({ type: "ok", text: data.message || "적립 요청이 접수되었습니다." });
      setBookingRef("");
      setDepartureDate("");
      setPayerName("");
      setContactPhone("");
      setMemo("");
      setFiles([]);
      await onSubmitted();
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-sm text-[var(--text-secondary)]">
        예약 확인 후 포인트가 지급됩니다. (영업일 기준 검수 후 반영)
      </p>
      <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-3">
        <input
          value={bookingRef}
          onChange={(e) => setBookingRef(e.target.value)}
          placeholder="예약번호 *"
          className="input-base bg-[var(--surface-muted)]"
        />
        <input
          type="date"
          value={departureDate}
          onChange={(e) => setDepartureDate(e.target.value)}
          className="input-base bg-[var(--surface-muted)]"
        />
        <input
          value={payerName}
          onChange={(e) => setPayerName(e.target.value)}
          placeholder="결제자명 *"
          className="input-base bg-[var(--surface-muted)]"
        />
        <input
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="연락처 (선택)"
          className="input-base bg-[var(--surface-muted)]"
        />
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="요청 메모"
          rows={3}
          className="input-base resize-none bg-[var(--surface-muted)] sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-[var(--text-secondary)]">증빙 업로드 (1~3개, 이미지/PDF, 파일당 10MB)</label>
          <input
            type="file"
            accept="image/*,application/pdf"
            multiple
            onChange={(e) => onChangeFiles(e.target.files)}
            className="block w-full text-sm text-[var(--text-secondary)]"
          />
          {files.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`}>{file.name}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {message ? (
        <p className={message.type === "ok" ? "text-sm text-[var(--success)]" : "text-sm text-[var(--danger)]"}>
          {message.text}
        </p>
      ) : null}

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className={cn(
          "rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-50",
          solidButtonShadowClasses,
        )}
      >
        {loading ? "제출 중..." : "적립 요청 제출"}
      </button>
    </section>
  );
}
