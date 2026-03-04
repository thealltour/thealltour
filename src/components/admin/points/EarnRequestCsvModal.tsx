"use client";

import { useState } from "react";

type Props = {
  onApplied: () => Promise<void> | void;
};

export default function EarnRequestCsvModal({ onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("booking_ref,amount,grant_status,admin_memo\n");
  const [previewRows, setPreviewRows] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");

  const preview = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/points/earn-requests/csv-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "미리보기에 실패했습니다.");
        return;
      }
      setPreviewRows(Array.isArray(data.rows) ? data.rows : []);
    } finally {
      setLoading(false);
    }
  };

  const apply = async () => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/admin/points/earn-requests/csv-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message || "일괄 적용 실패");
        return;
      }
      setMessage(`적용 완료: 성공 ${data.successCount} / 실패 ${data.failCount}`);
      await onApplied();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
      >
        CSV 반자동 지급
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">CSV 반자동 지급</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">헤더: booking_ref,amount,grant_status,admin_memo</p>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={10}
              className="input-base mt-3 w-full resize-none bg-[var(--surface-muted)]"
            />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={preview} disabled={loading} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
                preview
              </button>
              <button type="button" onClick={apply} disabled={loading} className="rounded-md bg-[var(--primary)] px-3 py-1.5 text-sm font-semibold text-[var(--on-primary)]">
                apply
              </button>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm">
                닫기
              </button>
            </div>
            {message ? <p className="mt-2 text-xs text-[var(--text-secondary)]">{message}</p> : null}
            {previewRows.length > 0 ? (
              <div className="mt-3 max-h-56 overflow-auto rounded-lg border border-[var(--border)] p-2">
                {previewRows.map((row, idx) => (
                  <pre key={idx} className="text-xs text-[var(--text-secondary)]">
                    {JSON.stringify(row)}
                  </pre>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
