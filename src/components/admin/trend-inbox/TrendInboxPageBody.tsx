"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MarketingTeamSubnav } from "@/components/admin/ai-marketing/MarketingTeamSubnav";
import AdminCard from "@/components/admin/ui/AdminCard";
import { cn } from "@/lib/cn";

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
  createdAt?: string;
  ingestedAt: string | null;
  observedAt: string;
  discardedAt?: string | null;
};

function statusLabelKo(status: string): string {
  if (status === "new" || status === "accepted") return "대기";
  if (status === "ingested") return "처리됨";
  if (status === "discarded") return "폐기";
  if (status === "duplicate") return "중복";
  if (status === "rejected") return "거부";
  if (status === "valid") return "유효";
  return status;
}

function statusTone(status: string): "success" | "warning" | "danger" | "muted" {
  if (status === "new" || status === "accepted" || status === "valid") return "warning";
  if (status === "ingested") return "success";
  if (status === "discarded" || status === "rejected") return "danger";
  if (status === "duplicate") return "muted";
  return "muted";
}

function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const toneClass = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-800",
    danger: "border-red-500/30 bg-red-500/10 text-red-700",
    muted: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-secondary)]",
  }[tone];
  return (
    <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-xs font-medium", toneClass)}>
      {statusLabelKo(status)}
    </span>
  );
}

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
  const [pendingNewCount, setPendingNewCount] = useState(0);
  const ingestResultRef = useRef<HTMLDivElement | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/trend-intake", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        recent?: HistoryRow[];
        pendingNewCount?: number;
      };
      setHistory(data.recent ?? []);
      setPendingNewCount(
        typeof data.pendingNewCount === "number" ? data.pendingNewCount : 0,
      );
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!ingestResult) return;
    ingestResultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ingestResult]);

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

  const ingestBanner =
    ingestResult == null
      ? null
      : ingestResult.counts.accepted > 0
        ? {
            tone: "success" as const,
            title: "스테이징 인입 완료",
            body: `수락 ${ingestResult.counts.accepted}건이 대기(new) 상태입니다. 내일 09:00 Agenda preflight에서 처리됩니다.`,
          }
        : ingestResult.counts.duplicate > 0 && ingestResult.counts.rejected === 0
          ? {
              tone: "muted" as const,
              title: "이미 인입된 항목",
              body: `중복 ${ingestResult.counts.duplicate}건 — 기존 observation과 동일해 새로 저장되지 않았습니다.`,
            }
          : {
              tone: "danger" as const,
              title: "인입되지 않음",
              body: `거부 ${ingestResult.counts.rejected}건 · 중복 ${ingestResult.counts.duplicate}건. 사유를 확인한 뒤 다시 시도하세요.`,
            };

  const bannerClass = {
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100",
    muted: "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-primary)]",
    danger: "border-red-500/40 bg-red-500/10 text-red-900 dark:text-red-100",
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-secondary)]">
          AI Marketing Team
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-[var(--text-primary)] sm:text-2xl">트렌드 인입</h1>
          <span className="inline-flex rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800">
            대기 NEW {pendingNewCount}건
          </span>
        </div>
        <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
          Meta AI TrendSignal v1 JSON을 붙여넣어 검증·스테이징 인입합니다. Agenda 확정·CMC·HMR·게시에는
          접근하지 않습니다.
        </p>
      </header>

      <MarketingTeamSubnav />

      <AdminCard>
        <label className="mb-2 block text-sm font-medium text-[var(--text-primary)]">
          TrendSignal JSON paste
        </label>
        <textarea
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={10}
          spellCheck={false}
          className="min-h-[12rem] w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-xs text-[var(--text-primary)] sm:min-h-[20rem]"
          placeholder='{"provider":"meta_ai","items":[...]}'
        />
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={busy || !paste.trim()}
            onClick={() => void onValidate()}
            className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 text-sm font-medium disabled:opacity-50 sm:w-auto"
          >
            검증
          </button>
          <button
            type="button"
            disabled={busy || !paste.trim()}
            onClick={() => void onIngest()}
            className="min-h-11 w-full rounded-lg bg-[var(--text-primary)] px-4 py-2.5 text-sm font-medium text-[var(--surface)] disabled:opacity-50 sm:w-auto"
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
            유효 {preview.counts.valid} / 거부 {preview.counts.rejected}
            {preview.normalize && !preview.normalize.ok
              ? ` · normalize: ${preview.normalize.reason}`
              : ""}
          </p>
          <ul className="space-y-2 text-sm">
            {preview.items.map((item) => (
              <li
                key={item.index}
                className="flex flex-col gap-1 rounded-md border border-[var(--border)] px-3 py-2 text-[var(--text-secondary)] sm:flex-row sm:flex-wrap sm:items-center sm:gap-2"
              >
                <StatusBadge status={item.status} />
                <span>#{item.index}</span>
                {item.status === "valid" ? (
                  <span className="break-all">{item.observationId}</span>
                ) : (
                  <span className="break-all">
                    {item.reason}
                    {item.observationId ? ` · ${item.observationId}` : ""}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </AdminCard>
      ) : null}

      {ingestResult ? (
        <div ref={ingestResultRef}>
          <AdminCard>
            <h2 className="mb-2 text-base font-medium text-[var(--text-primary)]">인입 결과</h2>
            {ingestBanner ? (
              <div className={cn("mb-3 rounded-lg border px-3 py-3 text-sm", bannerClass[ingestBanner.tone])}>
                <p className="font-medium">{ingestBanner.title}</p>
                <p className="mt-1 opacity-90">{ingestBanner.body}</p>
              </div>
            ) : null}
            <p className="mb-3 text-sm text-[var(--text-secondary)]">
              수락 {ingestResult.counts.accepted} · 중복 {ingestResult.counts.duplicate} · 거부{" "}
              {ingestResult.counts.rejected}
            </p>
            <ul className="space-y-2 text-sm">
              {ingestResult.items.map((item) => (
                <li
                  key={`${item.index}-${item.status}`}
                  className="flex flex-col gap-1 rounded-md border border-[var(--border)] px-3 py-2 text-[var(--text-secondary)]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={item.status} />
                    <span>#{item.index}</span>
                  </div>
                  {"observationId" in item && item.observationId ? (
                    <span className="break-all">observation: {item.observationId}</span>
                  ) : null}
                  {item.status === "accepted" ? (
                    <span className="break-all text-xs">stagingId: {item.stagingId}</span>
                  ) : null}
                  {item.status === "duplicate" ? (
                    <span className="break-all text-xs">existingId: {item.existingId}</span>
                  ) : null}
                  {item.status === "rejected" ? <span className="break-all">{item.reason}</span> : null}
                </li>
              ))}
            </ul>
            {ingestResult.counts.accepted > 0 ? (
              <p className="mt-3 flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
                <Link
                  href="/theall_manager_only/marketing-review"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  제작·검토(아젠다) →
                </Link>
                <Link
                  href="/theall_manager_only/ai-marketing"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  오늘 허브 →
                </Link>
              </p>
            ) : null}
          </AdminCard>
        </div>
      ) : null}

      <AdminCard>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-medium text-[var(--text-primary)]">최근 스테이징</h2>
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="min-h-9 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]"
          >
            새로고침
          </button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">아직 스테이징 항목이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)] text-sm">
            {history.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={row.status} />
                  <span className="font-medium text-[var(--text-primary)]">{row.topic}</span>
                </div>
                <span className="break-all text-[var(--text-secondary)]">
                  {row.trendType} · {row.observationId}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  {row.status === "new"
                    ? `생성 ${row.createdAt ?? row.observedAt} · 내일 09:00 처리 예정`
                    : row.status === "ingested"
                      ? `처리 ${row.ingestedAt ?? row.observedAt}`
                      : `폐기 ${row.discardedAt ?? row.observedAt}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminCard>
    </div>
  );
}
