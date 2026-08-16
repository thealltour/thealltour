"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalProvider";

const REPORT_REASONS = [
  { value: "ad_spam", label: "광고/홍보" },
  { value: "abuse", label: "욕설/비방" },
  { value: "false_info", label: "허위 정보" },
  { value: "other", label: "기타" },
] as const;

type Props = {
  reviewId: string;
  onClose: () => void;
  onSuccess?: () => void;
};

export default function ReviewReportModal({ reviewId, onClose, onSuccess }: Props) {
  const pathname = usePathname();
  const { openAuth } = useAuthModal();
  const [selected, setSelected] = useState<string>("");
  const [otherText, setOtherText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const reasonLabel = REPORT_REASONS.find((r) => r.value === selected)?.label ?? selected;
    const reason = selected === "other" ? `기타: ${otherText.trim()}` : reasonLabel;
    if (!reason.trim()) {
      alert("신고 사유를 선택하거나 입력해 주세요.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          onClose();
          openAuth({ mode: "login", next: pathname });
          return;
        }
        alert(data?.message ?? "신고 접수에 실패했습니다.");
        return;
      }
      onSuccess?.();
      onClose();
      alert("신고가 접수되었습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="report-modal-title" className="text-lg font-bold text-slate-900">
          리뷰 신고
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          신고 사유를 선택해 주세요. 검토 후 조치하겠습니다.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] p-3 has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-soft)]"
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.value}
                  checked={selected === r.value}
                  onChange={() => setSelected(r.value)}
                  className="h-4 w-4 border-[var(--border-strong)] text-[var(--primary)]"
                />
                <span className="text-sm font-medium text-slate-800">{r.label}</span>
              </label>
            ))}
          </div>
          {selected === "other" && (
            <div>
              <label htmlFor="report-other" className="block text-sm font-medium text-slate-700">
                사유 입력 (필수)
              </label>
              <textarea
                id="report-other"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="구체적인 사유를 입력해 주세요"
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                required
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading || (selected === "other" && !otherText.trim())}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? "처리 중…" : "신고하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
