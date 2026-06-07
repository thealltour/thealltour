"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminHeader from "@/components/admin/AdminHeader";
import type { GolfLeadsListResponse } from "@/lib/leads/golfLeadStats";

type AdminGolfLeadsPageBodyProps = {
  inquiryCount: number;
  productCount: number;
  memberCount: number;
  reviewCount: number;
  unreadNotificationCount: number;
};

type PeriodRange = "today" | "7d" | "30d" | "all";

const PERIOD_OPTIONS: { value: PeriodRange; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "7d", label: "7일" },
  { value: "30d", label: "30일" },
  { value: "all", label: "전체" },
];

function formatDate(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatRevenue(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(value);
}

function utmSummary(lead: GolfLeadsListResponse["leads"][number]): string {
  const parts = [lead.utm_source, lead.utm_medium, lead.utm_campaign].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "-";
}

function CountList({
  title,
  items,
  emptyLabel = "-",
}: {
  title: string;
  items: { label: string; count: number }[];
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
      <h3 className="text-xs font-semibold text-[var(--text-muted)]">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">{emptyLabel}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={`${title}-${item.label}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{item.label}</span>
              <span className="shrink-0 tabular-nums font-medium">{item.count.toLocaleString("ko-KR")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DailyTrendChart({ items }: { items: GolfLeadsListResponse["summary"]["dailyTrend"] }) {
  const maxCount = useMemo(() => Math.max(1, ...items.map((i) => i.count)), [items]);
  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">선택 기간에 일별 리드가 없습니다.</p>;
  }

  return (
    <div className="flex h-32 items-end gap-1">
      {items.map((item) => {
        const height = Math.max(8, Math.round((item.count / maxCount) * 100));
        return (
          <div key={item.date} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-[var(--brand)]/80 transition-colors group-hover:bg-[var(--brand)]"
              style={{ height: `${height}%` }}
              title={`${item.date}: ${item.count}건`}
            />
            <span className="truncate text-[10px] tabular-nums text-[var(--text-muted)]">
              {item.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminGolfLeadsPageBody({
  inquiryCount,
  productCount,
  memberCount,
  reviewCount,
  unreadNotificationCount,
}: AdminGolfLeadsPageBodyProps) {
  const [period, setPeriod] = useState<PeriodRange>("30d");
  const [data, setData] = useState<GolfLeadsListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadLeads = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const response = await fetch(`/api/admin/golf-leads?range=${period}`, { cache: "no-store" });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "골프 리드 목록을 불러오지 못했습니다.");
      }
      const payload = (await response.json()) as GolfLeadsListResponse;
      setData(payload);
    } catch (e) {
      setData(null);
      setErrorMessage(e instanceof Error ? e.message : "골프 리드 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const summary = data?.summary;
  const leads = data?.leads ?? [];

  return (
    <div className="w-full space-y-6">
      <AdminHeader
        activeTab="inquiries"
        title="골프투어 리드 (UTM)"
        description="문의·랜딩·상품상세·외부 랜딩에서 적재된 골프 리드와 UTM·채널·유입 경로 통계입니다."
        inquiryCount={inquiryCount}
        productCount={productCount}
        memberCount={memberCount}
        reviewCount={reviewCount}
        unreadNotificationCount={unreadNotificationCount}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriod(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                period === opt.value
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void loadLeads()}
          disabled={isLoading}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-muted)] disabled:opacity-60"
        >
          {isLoading ? "불러오는 중…" : "새로고침"}
        </button>
      </div>

      {summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)]">기간 내 리드</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{summary.total.toLocaleString("ko-KR")}</p>
            </div>
            <div className="rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)]">확정 매출 합계</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {formatRevenue(summary.totalActualRevenue)}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)]">평균 인원</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {summary.averageGroupSize != null ? `${summary.averageGroupSize}명` : "-"}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
              <p className="text-xs text-[var(--text-muted)]">채널 수</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{summary.byChannel.length}</p>
            </div>
          </section>

          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)] lg:col-span-2">
              <h3 className="text-xs font-semibold text-[var(--text-muted)]">일별 리드 추이 (KST)</h3>
              <div className="mt-3">
                <DailyTrendChart items={summary.dailyTrend} />
              </div>
            </div>
            <CountList title="유입 경로 유형" items={summary.bySourceKind} />
            <CountList title="획득 채널 (acquisition_channel)" items={summary.byChannel} />
            <CountList title="UTM Source" items={summary.byUtmSource} />
            <CountList title="UTM Campaign" items={summary.byUtmCampaign} />
            <CountList title="상태별" items={summary.byStatus} />
            <CountList title="랜딩/유입 페이지 Top" items={summary.byLandingPage} emptyLabel="기록된 landing_page 없음" />
          </section>
        </>
      ) : null}

      <section className="overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)]">
        <div className="border-b border-[var(--border)] px-4 py-3 md:px-5">
          <h2 className="text-sm font-semibold">리드 목록 (최근 {leads.length}건)</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            문의(/api/inquiries) 골프 dual-write · 외부 POST /api/leads/golf-utm 적재분
          </p>
        </div>

        {errorMessage ? (
          <p className="px-4 py-6 text-sm text-red-600 md:px-5">{errorMessage}</p>
        ) : isLoading && !data ? (
          <p className="px-4 py-6 text-sm text-[var(--text-muted)] md:px-5">불러오는 중…</p>
        ) : leads.length === 0 ? (
          <p className="px-4 py-6 text-sm text-[var(--text-muted)] md:px-5">
            선택 기간에 접수된 골프 리드가 없습니다. 골프 관련 문의·랜딩·외부 API 제출 후 표시됩니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium md:px-5">접수일</th>
                  <th className="px-4 py-3 font-medium md:px-5">참조 ID</th>
                  <th className="px-4 py-3 font-medium md:px-5">고객</th>
                  <th className="px-4 py-3 font-medium md:px-5">연락처</th>
                  <th className="px-4 py-3 font-medium md:px-5">인원</th>
                  <th className="px-4 py-3 font-medium md:px-5">목적지/상품</th>
                  <th className="px-4 py-3 font-medium md:px-5">유입 페이지</th>
                  <th className="px-4 py-3 font-medium md:px-5">채널</th>
                  <th className="px-4 py-3 font-medium md:px-5">UTM</th>
                  <th className="px-4 py-3 font-medium md:px-5">상태</th>
                  <th className="px-4 py-3 font-medium md:px-5">매출</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[var(--surface-muted)]/60">
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums md:px-5">
                      {formatDate(lead.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs md:px-5">
                      {lead.reference_id}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 md:px-5">{lead.customer_name}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums md:px-5">{lead.phone_number}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums md:px-5">
                      {lead.group_size ?? "-"}
                    </td>
                    <td className="max-w-[10rem] truncate px-4 py-3 md:px-5" title={lead.target_destination ?? ""}>
                      {lead.target_destination ?? "-"}
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-3 md:px-5" title={lead.landing_page ?? ""}>
                      {lead.landing_page ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 md:px-5">
                      {lead.acquisition_channel ?? "-"}
                    </td>
                    <td className="max-w-[12rem] truncate px-4 py-3 md:px-5" title={utmSummary(lead)}>
                      {utmSummary(lead)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 md:px-5">{lead.status}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums md:px-5">
                      {formatRevenue(lead.actual_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
