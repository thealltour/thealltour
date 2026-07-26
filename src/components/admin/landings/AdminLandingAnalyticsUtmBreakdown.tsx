"use client";

import type { LandingAnalyticsUtmRow } from "@/lib/adminLandings/landingAnalyticsModels";

type Props = {
  rows: LandingAnalyticsUtmRow[];
};

function formatRate(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  return `${(n * 100).toFixed(1)}%`;
}

/**
 * 성과·UTM: source × medium × campaign 온사이트 퍼널.
 */
export default function AdminLandingAnalyticsUtmBreakdown({ rows }: Props) {
  const top = rows.slice(0, 5);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">UTM 유입 분해</h2>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
          source × medium × campaign 기준 조회·CTA·문의 (메타데이터 UTM). 광고비는 kakao_sync 탭의 Moment
          CSV를 보세요.
        </p>
      </div>

      {top.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {top.map((r) => (
            <div
              key={`top-${r.key}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3"
            >
              <p className="truncate text-xs font-medium text-[var(--text-primary)]" title={r.utmCampaign}>
                {r.utmCampaign}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-[var(--text-muted)]">
                {r.utmSource} / {r.utmMedium}
              </p>
              <p className="mt-2 text-lg font-bold tabular-nums text-[var(--text-primary)]">
                {r.views.toLocaleString("ko-KR")}
              </p>
              <p className="text-[10px] text-[var(--text-muted)]">
                CTA {r.clicks.toLocaleString("ko-KR")} · CTR {formatRate(r.ctr)}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Medium</th>
              <th className="px-4 py-3 font-semibold">Campaign</th>
              <th className="px-4 py-3 text-right font-semibold">조회</th>
              <th className="px-4 py-3 text-right font-semibold">CTA</th>
              <th className="px-4 py-3 text-right font-semibold">문의</th>
              <th className="px-4 py-3 text-right font-semibold">CTR</th>
              <th className="px-4 py-3 text-right font-semibold">CVR</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  UTM이 기록된 이벤트가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.key} className="border-t border-[var(--border)]">
                  <td className="px-4 py-2.5 text-[var(--text-primary)]">{r.utmSource}</td>
                  <td className="px-4 py-2.5 text-[var(--text-secondary)]">{r.utmMedium}</td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 font-medium text-[var(--text-primary)]">
                    {r.utmCampaign}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.views.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.clicks.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.submits.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatRate(r.ctr)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatRate(r.cvr)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
