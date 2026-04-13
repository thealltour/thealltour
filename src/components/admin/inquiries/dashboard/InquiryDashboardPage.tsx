"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import type { InquiryDashboardPayload, InquiryDashboardPeriod } from "./inquiryDashboard.types";
import { INQUIRIES_LIST_PATH } from "./inquiryDashboard.utils";
import { InquiryAssigneeStats } from "./InquiryAssigneeStats";
import { InquiryDashboardKpis } from "./InquiryDashboardKpis";
import { InquiryFunnelChart } from "./InquiryFunnelChart";
import { InquiryRiskLists } from "./InquiryRiskLists";
import { InquirySourceBreakdown } from "./InquirySourceBreakdown";
import { InquiryStatusBreakdown } from "./InquiryStatusBreakdown";
import { InquiryTrendChart } from "./InquiryTrendChart";

export function InquiryDashboardPage() {
  const [period, setPeriod] = useState<InquiryDashboardPeriod>("7d");
  const [data, setData] = useState<InquiryDashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: InquiryDashboardPeriod) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/inquiries/dashboard?period=${p}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? "데이터를 불러오지 못했습니다.");
        setData(null);
        return;
      }
      const json = (await res.json()) as InquiryDashboardPayload;
      setData(json);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  return (
    <PageContainer size="wide" className="flex flex-col gap-6 py-4 md:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] md:text-2xl">문의 운영 대시보드</h1>
          <p className="mt-1 text-xs text-[var(--text-muted)] md:text-sm">
            최근 기간 집계로 현황·병목·우선 처리 대상을 한눈에 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--border)] p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setPeriod("7d")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                period === "7d"
                  ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              최근 7일
            </button>
            <button
              type="button"
              onClick={() => setPeriod("30d")}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                period === "30d"
                  ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              최근 30일
            </button>
          </div>
          <Link
            href={INQUIRIES_LIST_PATH}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface)]"
          >
            문의 목록
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-[var(--text-muted)]">불러오는 중…</p>
      ) : null}

      {data ? (
        <>
          <InquiryDashboardKpis kpis={data.kpis} />
          <div className="grid gap-4 lg:grid-cols-2">
            <InquiryTrendChart trend={data.trend} />
            <InquiryStatusBreakdown breakdown={data.statusBreakdown} />
            <InquirySourceBreakdown rows={data.sourceBreakdown} />
            <InquiryFunnelChart funnel={data.funnel} period={data.period} />
          </div>
          <InquiryAssigneeStats rows={data.assigneeStats} />
          <InquiryRiskLists riskLists={data.riskLists} />
        </>
      ) : null}
    </PageContainer>
  );
}
