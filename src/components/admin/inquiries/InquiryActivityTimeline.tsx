"use client";

import { useCallback, useEffect, useState } from "react";
import type { InquiryActivityLog } from "@/types/inquiry";

type Props = {
  inquiryId: string;
  refreshKey?: number;
};

function formatLogTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function InquiryActivityTimeline({ inquiryId, refreshKey = 0 }: Props) {
  const [logs, setLogs] = useState<InquiryActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inquiries/${encodeURIComponent(inquiryId)}/activity-logs`);
      const data = (await res.json()) as { logs?: InquiryActivityLog[]; message?: string };
      if (!res.ok) {
        setError(data.message ?? "활동 로그를 불러오지 못했습니다.");
        setLogs([]);
        return;
      }
      setLogs(data.logs ?? []);
    } catch {
      setError("활동 로그 요청 중 오류가 발생했습니다.");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [inquiryId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="max-h-52 overflow-y-auto pr-1">
      {loading ? <p className="text-xs text-[var(--text-muted)]">불러오는 중…</p> : null}
      {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
      {!loading && !error && logs.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">활동 내역이 없습니다.</p>
      ) : null}
      {!loading && !error && logs.length > 0 ? (
        <ul className="space-y-2.5 border-l-2 border-[var(--border)] pl-3">
          {logs.map((log) => (
            <li key={log.id} className="relative">
              <p className="text-[11px] text-[var(--text-muted)]">
                <span className="tabular-nums">{formatLogTime(log.created_at)}</span>
                {log.actor_name ? <span> · {log.actor_name}</span> : null}
              </p>
              <p className="mt-0.5 text-xs leading-snug text-[var(--text-primary)]">{log.summary}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
