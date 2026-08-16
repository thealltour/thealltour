"use client";

import type { KakaoMomentAnalyticsBlock } from "@/lib/adminLandings/kakaoMomentModels";
import { formatMomentRate, formatWon } from "@/lib/adminLandings/kakaoMomentModels";

type Props = {
  moment: KakaoMomentAnalyticsBlock | null;
};

export function AdminKakaoMomentEfficiencySection({ moment }: Props) {
  if (!moment) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] px-4 py-5 text-sm text-[var(--text-muted)]">
        아직 업로드된 Moment CSV가 없습니다. 아래에서 월간 소재 리포트를 올리면 비용·CPC·CPA가 표시됩니다.
      </div>
    );
  }

  const s = moment.summary;
  const cards: { label: string; value: string; hint?: string }[] = [
    { label: "광고비", value: formatWon(s.cost) },
    { label: "노출", value: s.impressions.toLocaleString("ko-KR") },
    { label: "클릭", value: s.clicks.toLocaleString("ko-KR") },
    { label: "CTR", value: formatMomentRate(s.ctr), hint: "클릭 ÷ 노출" },
    { label: "CPC", value: formatWon(s.cpc), hint: "비용 ÷ 클릭" },
    {
      label: "리드 CPA",
      value: s.cpaLead != null ? formatWon(s.cpaLead) : "—",
      hint: `비즈보드 리드 ${s.bizboardLeadsInPeriod.toLocaleString("ko-KR")}건`,
    },
    {
      label: "가입 CPA",
      value: s.cpaSignup != null ? formatWon(s.cpaSignup) : "—",
      hint: `신규 가입 ${s.newSignupsInPeriod.toLocaleString("ko-KR")}건`,
    },
  ];

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">월간 광고 효율 (Moment)</h2>
        <p className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--text-secondary)]">
          광고 기간: {moment.periodStart} ~ {moment.periodEnd}
          {moment.filename ? ` · ${moment.filename}` : ""}. 위 온사이트 7일/30일과 기간이 다를 수 있습니다. CPA는
          광고 기간의 비즈보드 리드·카카오싱크 가입 기준입니다.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
          >
            <p className="text-xs text-[var(--text-muted)]">{c.label}</p>
            <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{c.value}</p>
            {c.hint ? <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{c.hint}</p> : null}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">캠페인</th>
              <th className="px-4 py-3 text-right font-semibold">비용</th>
              <th className="px-4 py-3 text-right font-semibold">노출</th>
              <th className="px-4 py-3 text-right font-semibold">클릭</th>
              <th className="px-4 py-3 text-right font-semibold">CTR</th>
              <th className="px-4 py-3 text-right font-semibold">CPC</th>
            </tr>
          </thead>
          <tbody>
            {moment.campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-[var(--text-muted)]">
                  캠페인 데이터가 없습니다.
                </td>
              </tr>
            ) : (
              moment.campaigns.map((row) => (
                <tr key={row.key} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatWon(row.cost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.impressions.toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{row.clicks.toLocaleString("ko-KR")}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatMomentRate(row.ctr)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatWon(row.cpc)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
            <tr>
              <th className="px-4 py-3 font-semibold">소재</th>
              <th className="px-4 py-3 font-semibold">캠페인</th>
              <th className="px-4 py-3 text-right font-semibold">비용</th>
              <th className="px-4 py-3 text-right font-semibold">클릭</th>
              <th className="px-4 py-3 text-right font-semibold">CTR</th>
              <th className="px-4 py-3 text-right font-semibold">CPC</th>
            </tr>
          </thead>
          <tbody>
            {moment.creatives.map((row) => (
              <tr key={row.key} className="border-t border-[var(--border)]">
                <td className="max-w-[16rem] truncate px-4 py-3 font-medium text-[var(--text-primary)]">
                  {row.creativeName}
                </td>
                <td className="max-w-[12rem] truncate px-4 py-3 text-[var(--text-secondary)]">
                  {row.campaignName}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatWon(row.cost)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{row.clicks.toLocaleString("ko-KR")}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatMomentRate(row.ctr)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatWon(row.cpc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
