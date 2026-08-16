"use client";

import { useCallback, useState } from "react";
import type { KakaoMomentParseResult } from "@/lib/adminLandings/kakaoMomentModels";
import { formatMomentRate, formatWon } from "@/lib/adminLandings/kakaoMomentModels";

type Props = {
  onApplied: () => void;
};

function guessPeriodFromFilename(name: string): { start: string; end: string } | null {
  const m = name.match(/(\d{8}).*?(\d{8})/);
  if (!m) return null;
  const a = m[1]!;
  const b = m[2]!;
  const toYmd = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return { start: toYmd(a), end: toYmd(b) };
}

/**
 * 월 1회용 Moment CSV 업로드 (접이식).
 */
export function AdminKakaoMomentCsvUpload({ onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [filename, setFilename] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [preview, setPreview] = useState<KakaoMomentParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const onFile = useCallback(async (file: File | null) => {
    setError(null);
    setOkMsg(null);
    setPreview(null);
    if (!file) return;
    setFilename(file.name);
    const text = await file.text();
    setCsvText(text);
    const guessed = guessPeriodFromFilename(file.name);
    if (guessed) {
      setPeriodStart(guessed.start);
      setPeriodEnd(guessed.end);
    }
  }, []);

  async function runPreview() {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/admin/landings/kakao-moment/csv-preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      const json = (await res.json()) as KakaoMomentParseResult & { error?: string };
      if (!res.ok) throw new Error(json.error || "미리보기 실패");
      setPreview(json);
    } catch (e) {
      setPreview(null);
      setError(e instanceof Error ? e.message : "미리보기 실패");
    } finally {
      setBusy(false);
    }
  }

  async function runApply() {
    if (!periodStart || !periodEnd) {
      setError("분석 기간(시작·종료일)을 입력하세요.");
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/admin/landings/kakao-moment/csv-apply", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, periodStart, periodEnd, filename }),
      });
      const json = (await res.json()) as { error?: string; summary?: { rowCount: number } };
      if (!res.ok) throw new Error(json.error || "적용 실패");
      setOkMsg(`${json.summary?.rowCount ?? 0}개 소재를 저장했습니다. 같은 기간을 다시 올리면 교체됩니다.`);
      setPreview(null);
      onApplied();
    } catch (e) {
      setError(e instanceof Error ? e.message : "적용 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-[var(--text-primary)]"
      >
        Moment CSV 업로드 (월 1회)
        <span className="text-xs font-normal text-[var(--text-muted)]">{open ? "접기" : "열기"}</span>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-[var(--border)] px-4 py-4 text-sm">
          <p className="text-xs leading-relaxed text-[var(--text-muted)]">
            카카오모먼트 「소재」 리포트를 업로드하세요. 파일명에 기간(YYYYMMDD_YYYYMMDD)이 있으면 자동
            채웁니다. 동일 기간 재업로드 시 기존 데이터를 교체합니다.
          </p>
          <div>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              className="block w-full text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
              기간 시작
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
              기간 종료
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-sm text-[var(--text-primary)]"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !csvText}
              onClick={() => void runPreview()}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              미리보기
            </button>
            <button
              type="button"
              disabled={busy || !csvText || !periodStart || !periodEnd}
              onClick={() => void runApply()}
              className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              저장·적용
            </button>
          </div>
          {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
          {okMsg ? <p className="text-xs text-[var(--success)]">{okMsg}</p> : null}
          {preview ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs">
              <p>
                {preview.summary.rowCount}행 · 비용 {formatWon(preview.summary.totalCost)} · 클릭{" "}
                {preview.summary.totalClicks.toLocaleString("ko-KR")} · CTR{" "}
                {formatMomentRate(preview.summary.avgCtr)} · CPC {formatWon(preview.summary.avgCpc)}
              </p>
              {preview.warnings.length > 0 ? (
                <p className="mt-1 text-[var(--text-muted)]">{preview.warnings.join(" · ")}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
