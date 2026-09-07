"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminCard from "@/components/admin/ui/AdminCard";

type PreviewItem =
  | { index: number; status: "valid"; observationId: string }
  | {
      index: number;
      status: "rejected";
      observationId: string | null;
      reason: string;
      issues?: Array<{ code: string; message: string; path: string }>;
    };

type IngestItem =
  | { index: number; status: "accepted"; observationId: string; stagingId: string }
  | { index: number; status: "duplicate"; observationId: string; existingId: string }
  | {
      index: number;
      status: "rejected";
      observationId: string | null;
      reason: string;
    };

type HistoryRow = {
  id: string;
  observationId: string;
  trendType: string;
  topic: string;
  status: string;
  ingestedAt: string | null;
  observedAt: string;
};

export function TrendInboxPageBody() {
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    counts: { valid: number; rejected: number };
    items: PreviewItem[];
    normalize?: { ok: boolean; reason?: string; normalizedCount: number };
  } | null>(null);
  const [ingestResult, setIngestResult] = useState<{
    counts: { accepted: number; duplicate: number; rejected: number };
    items: IngestItem[];
  } | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/trend-intake", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { recent?: HistoryRow[] };
      setHistory(data.recent ?? []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function onValidate() {
    setBusy(true);
    setError(null);
    setIngestResult(null);
    try {
      const res = await fetch("/api/admin/trend-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", paste }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "검증 실패");
        setPreview(null);
        return;
      }
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "검증 요청 실패");
    } finally {
      setBusy(false);
    }
  }

  async function onIngest() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/trend-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ingest", paste }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(typeof data.message === "string" ? data.message : "인입 실패");
        return;
      }
      setIngestResult(data);
      setPreview(null);
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "인입 요청 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="space-y-2">
        <p className="text-sm text-[var(--text-secondary)]">
          <Link href="/theall_manager_only/marketing-operations" className="underline-offset-2 hover:underline">
            마케팅 운영
          </Link>
          {" / "}
          Trend Inbox
        </p>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Trend Inbox</h1>
        <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
          Meta AI TrendSignal v1 JSON을 붙여넣어 검증·스테이징 인입합니다. Agenda 확정·CMC·HMR·게시에는
          접근하지 않습니다.
        </p>
      </header>

      <AdminCard>
        <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
          TrendSignal JSON paste
        </label>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={16}
          spellCheck={false}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-xs text-[var(--text-primary)]"
          placeholder='{"provider":"meta_ai","items":[...]}'
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !paste.trim()}
            onClick={() => void onValidate()}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            검증
          </button>
          <button
            type="button"
            disabled={busy || !paste.trim()}
            onClick={() => void onIngest()}
            className="rounded-lg bg-[var(--text-primary)] px-3 py-2 text-sm font-medium text-[var(--surface)] disabled:opacity-50"
          >
            인입하기
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : null}
      </AdminCard>

      {preview ? (
        <AdminCard>
          <h2 className="mb-2 text-base font-medium text-[var(--text-primary)]">검증 미리보기</h2>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            valid {preview.counts.valid} / rejected {preview.counts.rejected}
            {preview.normalize && !preview.normalize.ok
              ? ` · normalize: ${preview.normalize.reason}`
              : ""}
          </p>
          <ul className="space-y-2 text-sm">
            {preview.items.map((item) => (
              <li
                key={item.index}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]"
              >
                #{item.index} · {item.status}
                {item.status === "valid"
                  ? ` · ${item.observationId}`
                  : ` · ${item.reason}${item.observationId ? ` · ${item.observationId}` : ""}`}
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}

      {ingestResult ? (
        <AdminCard>
          <h2 className="mb-2 text-base font-medium text-[var(--text-primary)]">인입 결과</h2>
          <p className="mb-3 text-sm text-[var(--text-secondary)]">
            accepted {ingestResult.counts.accepted} · duplicate {ingestResult.counts.duplicate} ·
            rejected {ingestResult.counts.rejected}
          </p>
          <ul className="space-y-2 text-sm">
            {ingestResult.items.map((item) => (
              <li
                key={`${item.index}-${item.status}`}
                className="rounded-md border border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]"
              >
                #{item.index} · {item.status}
                {"observationId" in item && item.observationId
                  ? ` · ${item.observationId}`
                  : ""}
                {item.status === "rejected" ? ` · ${item.reason}` : ""}
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}

      <AdminCard>
        <h2 className="mb-2 text-base font-medium text-[var(--text-primary)]">최근 인입</h2>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">아직 인입된 항목이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {history.map((row) => (
              <li key={row.id} className="flex flex-col gap-0.5 py-2">
                <span className="font-medium text-[var(--text-primary)]">{row.topic}</span>
                <span className="text-[var(--text-secondary)]">
                  {row.trendType} · {row.observationId} · {row.ingestedAt ?? row.observedAt}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
