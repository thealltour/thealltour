"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AdminKakaoMomentCsvUpload } from "@/components/admin/landings/AdminKakaoMomentCsvUpload";
import { AdminKakaoMomentEfficiencySection } from "@/components/admin/landings/AdminKakaoMomentEfficiencySection";
import {
  formatKakaoSyncRate,
  parseKakaoSyncAnalyticsRangeParam,
  type KakaoSyncAnalyticsRange,
  type KakaoSyncAnalyticsResponse,
} from "@/lib/adminLandings/kakaoSyncAnalyticsModels";

const TrendChart = dynamic(
  () => import("@/components/admin/landings/AdminKakaoSyncAnalyticsTrendChart"),
  {
    loading: () => (
      <div className="h-[280px] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
    ),
  },
);

function emptyData(): KakaoSyncAnalyticsResponse {
  return {
    summary: {
      landingViews: 0,
      ctaClicks: 0,
      ctr: 0,
      oauthStarts: 0,
      newSignups: 0,
      welcomeGrants: 0,
      channelAdded: 0,
      channelKnown: 0,
      channelAddRate: 0,
      productClicks: 0,
      bizboardLeads: 0,
      oauthToSignupRate: 0,
      viewToSignupRate: 0,
    },
    trend: [],
    campaigns: [],
    moment: null,
  };
}

export default function AdminKakaoSyncAnalyticsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = parseKakaoSyncAnalyticsRangeParam(searchParams.get("range"));

  const [data, setData] = useState<KakaoSyncAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("range")) return;
    const p = new URLSearchParams(searchParams.toString());
    p.set("range", "30d");
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      p.set("range", range);
      const res = await fetch(`/api/admin/landings/kakao-sync/analytics?${p.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json()) as KakaoSyncAnalyticsResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "카카오싱크 성과를 불러오지 못했습니다.");
      setData({
        summary: json.summary ?? emptyData().summary,
        trend: Array.isArray(json.trend) ? json.trend : [],
        campaigns: Array.isArray(json.campaigns) ? json.campaigns : [],
        moment: json.moment ?? null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "카카오싱크 성과를 불러오지 못했습니다.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  function setRange(next: KakaoSyncAnalyticsRange) {
    const p = new URLSearchParams(searchParams.toString());
    p.set("range", next);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }

  const summary = data?.summary ?? emptyData().summary;

  const cards: { label: string; value: string; hint?: string }[] = [
    { label: "랜딩 조회", value: summary.landingViews.toLocaleString("ko-KR") },
    { label: "CTA 클릭", value: summary.ctaClicks.toLocaleString("ko-KR") },
    { label: "CTR", value: formatKakaoSyncRate(summary.ctr), hint: "CTA ÷ 조회" },
    { label: "OAuth 시작", value: summary.oauthStarts.toLocaleString("ko-KR") },
    { label: "신규 가입", value: summary.newSignups.toLocaleString("ko-KR") },
    {
      label: "조회→가입",
      value: formatKakaoSyncRate(summary.viewToSignupRate),
      hint: "신규 가입 ÷ 조회",
    },
    { label: "웰컴 30,000P", value: summary.welcomeGrants.toLocaleString("ko-KR") },
    {
      label: "채널 추가율",
      value: formatKakaoSyncRate(summary.channelAddRate),
      hint: `${summary.channelAdded.toLocaleString("ko-KR")} / ${summary.channelKnown.toLocaleString("ko-KR")}`,
    },
    { label: "상품 클릭", value: summary.productClicks.toLocaleString("ko-KR") },
    { label: "비즈보드 리드", value: summary.bizboardLeads.toLocaleString("ko-KR"), hint: "utm kakao/bizboard 문의" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {(["7d", "30d", "all"] as KakaoSyncAnalyticsRange[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
              range === r
                ? "bg-[var(--accent)] text-[var(--on-accent)]"
                : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
            }`}
          >
            {r === "7d" ? "7일" : r === "30d" ? "30일" : "전체"}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      <AdminKakaoMomentEfficiencySection moment={data?.moment ?? null} />
      <AdminKakaoMomentCsvUpload onApplied={() => void load()} />

      {loading && !data ? (
        <div className="grid animate-pulse gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
          ))}
        </div>
      ) : (
        <>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">온사이트 퍼널</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {cards.map((c) => (
                <div
                  key={c.label}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3"
                >
                  <p className="text-xs text-[var(--text-muted)]">{c.label}</p>
                  <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{c.value}</p>
                  {c.hint ? <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{c.hint}</p> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">퍼널 전환</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              조회 {summary.landingViews.toLocaleString("ko-KR")} → CTA {summary.ctaClicks.toLocaleString("ko-KR")} (
              {formatKakaoSyncRate(summary.ctr)}) → OAuth {summary.oauthStarts.toLocaleString("ko-KR")} → 가입{" "}
              {summary.newSignups.toLocaleString("ko-KR")} ({formatKakaoSyncRate(summary.oauthToSignupRate)} OAuth→가입)
            </p>
          </div>

          <TrendChart trend={data?.trend ?? []} />

          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">캠페인 / 랜딩</th>
                  <th className="px-4 py-3 font-semibold">유형</th>
                  <th className="px-4 py-3 text-right font-semibold">조회</th>
                  <th className="px-4 py-3 text-right font-semibold">CTA</th>
                  <th className="px-4 py-3 text-right font-semibold">CTR</th>
                  <th className="px-4 py-3 text-right font-semibold">가입</th>
                </tr>
              </thead>
              <tbody>
                {(data?.campaigns ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                      선택한 기간에 캠페인별 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  (data?.campaigns ?? []).map((row) => (
                    <tr key={row.key} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.label}</td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{row.templateType}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.views.toLocaleString("ko-KR")}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.clicks.toLocaleString("ko-KR")}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{formatKakaoSyncRate(row.ctr)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.signups.toLocaleString("ko-KR")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
