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
      oauthSuccess: 0,
      oauthFailed: 0,
      loginReturning: 0,
      oauthNeedsLink: 0,
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
    oauthFailureBreakdown: [],
    oauthFailureRecent: [],
    moment: null,
  };
}

function formatFailureOccurredAt(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
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
        oauthFailureBreakdown: Array.isArray(json.oauthFailureBreakdown)
          ? json.oauthFailureBreakdown
          : [],
        oauthFailureRecent: Array.isArray(json.oauthFailureRecent) ? json.oauthFailureRecent : [],
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
    {
      label: "OAuth 성공",
      value: summary.oauthSuccess.toLocaleString("ko-KR"),
      hint: "콜백 완료(신규·기존·계정연결)",
    },
    {
      label: "OAuth 실패",
      value: summary.oauthFailed.toLocaleString("ko-KR"),
      hint: "동의 취소·오류 콜백",
    },
    {
      label: "기존 로그인",
      value: summary.loginReturning.toLocaleString("ko-KR"),
      hint: "이미 가입된 회원 OAuth 완료",
    },
    {
      label: "계정 연결 대기",
      value: summary.oauthNeedsLink.toLocaleString("ko-KR"),
      hint: "로컬 계정 링크 필요",
    },
    {
      label: "신규 가입",
      value: summary.newSignups.toLocaleString("ko-KR"),
      hint: "신규만 집계 (기존 로그인 제외)",
    },
    {
      label: "조회→가입",
      value: formatKakaoSyncRate(summary.viewToSignupRate),
      hint: "신규 가입 ÷ 조회",
    },
    { label: "웰컴 50,000P", value: summary.welcomeGrants.toLocaleString("ko-KR") },
    {
      label: "채널 추가율",
      value: formatKakaoSyncRate(summary.channelAddRate),
      hint: `${summary.channelAdded.toLocaleString("ko-KR")} / ${summary.channelKnown.toLocaleString("ko-KR")}`,
    },
    { label: "상품 클릭", value: summary.productClicks.toLocaleString("ko-KR") },
    { label: "비즈보드 리드", value: summary.bizboardLeads.toLocaleString("ko-KR"), hint: "utm kakao/bizboard 문의" },
  ];

  const oauthAbandoned = Math.max(
    0,
    summary.oauthStarts - summary.oauthSuccess - summary.oauthFailed,
  );

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
          {Array.from({ length: 14 }).map((_, i) => (
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
              {formatKakaoSyncRate(summary.ctr)}) → OAuth {summary.oauthStarts.toLocaleString("ko-KR")} → 신규 가입{" "}
              {summary.newSignups.toLocaleString("ko-KR")} ({formatKakaoSyncRate(summary.oauthToSignupRate)}{" "}
              OAuth→신규가입)
            </p>
            <p className="mt-2 text-xs text-[var(--text-secondary)]">
              OAuth 결과: 성공 {summary.oauthSuccess.toLocaleString("ko-KR")} · 기존 로그인{" "}
              {summary.loginReturning.toLocaleString("ko-KR")} · 계정연결{" "}
              {summary.oauthNeedsLink.toLocaleString("ko-KR")} · 실패{" "}
              {summary.oauthFailed.toLocaleString("ko-KR")} · 콜백 미도달(추정){" "}
              {oauthAbandoned.toLocaleString("ko-KR")}
            </p>
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">
              가입 = 신규만 집계합니다. 기존 회원이 OAuth를 완료하면 &quot;기존 로그인&quot;으로만 잡히며 신규 가입은
              오르지 않습니다. 콜백 미도달은 동의 화면에서 창을 닫아 사이트로 돌아오지 않은 경우입니다.
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

          <div>
            <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">OAuth 실패 원인</h2>
            <p className="mb-3 text-xs text-[var(--text-muted)]">
              reason · oauthError 기준 집계입니다. 동의 취소(access_denied)와 KOE 코드 등을 구분합니다.
            </p>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">reason</th>
                    <th className="px-4 py-3 font-semibold">oauthError</th>
                    <th className="px-4 py-3 text-right font-semibold">건수</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.oauthFailureBreakdown ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-[var(--text-muted)]">
                        선택한 기간에 OAuth 실패가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    (data?.oauthFailureBreakdown ?? []).map((row) => (
                      <tr key={row.key} className="border-t border-[var(--border)]">
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.reason}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{row.oauthError ?? "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.count.toLocaleString("ko-KR")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="mb-1 text-sm font-semibold text-[var(--text-primary)]">최근 OAuth 실패</h2>
            <p className="mb-3 text-xs text-[var(--text-muted)]">최신순 최대 30건 샘플입니다.</p>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">시각</th>
                    <th className="px-4 py-3 font-semibold">reason</th>
                    <th className="px-4 py-3 font-semibold">oauthError</th>
                    <th className="px-4 py-3 font-semibold">설명 / 메시지</th>
                    <th className="px-4 py-3 font-semibold">랜딩</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.oauthFailureRecent ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">
                        선택한 기간에 OAuth 실패가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    (data?.oauthFailureRecent ?? []).map((row, i) => {
                      const detail =
                        row.oauthErrorDescription || row.message || null;
                      return (
                        <tr
                          key={`${row.occurredAt}-${row.reason}-${i}`}
                          className="border-t border-[var(--border)]"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                            {formatFailureOccurredAt(row.occurredAt)}
                          </td>
                          <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{row.reason}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{row.oauthError ?? "—"}</td>
                          <td className="max-w-[280px] truncate px-4 py-3 text-[var(--text-secondary)]" title={detail ?? undefined}>
                            {detail ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">
                            {row.landingSlug ?? row.sourcePath ?? "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
