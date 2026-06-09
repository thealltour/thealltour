"use client";

import { useMemo, useState } from "react";
import {
  buildCampaignUrl,
  CHANNEL_UTM_PRESETS,
} from "@/lib/analytics/utmPropagation";

const CHANNEL_OPTIONS = [
  { id: "naver_band", label: "네이버 밴드" },
  { id: "naver_blog", label: "네이버 블로그" },
  { id: "smartstore", label: "네이버 스마트스토어" },
  { id: "kakao_channel", label: "카카오 채널" },
  { id: "instagram", label: "인스타그램" },
  { id: "youtube", label: "유튜브" },
] as const;

type ChannelId = keyof typeof CHANNEL_UTM_PRESETS;

export default function AdminUtmLinkBuilder() {
  const [channel, setChannel] = useState<ChannelId>("naver_band");
  const [campaign, setCampaign] = useState("");
  const [landingSlug, setLandingSlug] = useState("");
  const [basePath, setBasePath] = useState("/quote");
  const [message, setMessage] = useState("");

  const generatedUrl = useMemo(() => {
    if (landingSlug.trim()) {
      return buildCampaignUrl({ basePath, channel, campaign, slug: landingSlug.trim() });
    }
    return buildCampaignUrl({ basePath: basePath.trim() || "/quote", channel, campaign });
  }, [basePath, campaign, channel, landingSlug]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setMessage("URL을 복사했습니다.");
    } catch {
      setMessage("복사에 실패했습니다. URL을 직접 선택해 복사해 주세요.");
    }
  }

  return (
    <section className="space-y-4 rounded-xl bg-[var(--surface)] p-4 ring-1 ring-[var(--border)]">
      <div>
        <h3 className="text-base font-bold text-[var(--text-primary)]">UTM 캠페인 URL 빌더</h3>
        <p className="mt-1 text-xs text-[var(--text-muted)]">
          채널·캠페인·랜딩 slug를 선택하면 마케팅용 URL을 생성합니다.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
          채널
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as ChannelId)}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
          캠페인명 (utm_campaign)
          <input
            type="text"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="예: golf_spring_2026"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
          랜딩 slug (선택)
          <input
            type="text"
            value={landingSlug}
            onChange={(e) => setLandingSlug(e.target.value)}
            placeholder="예: okinawa-golf-package"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[var(--text-secondary)]">
          기본 경로 (slug 없을 때)
          <input
            type="text"
            value={basePath}
            onChange={(e) => setBasePath(e.target.value)}
            placeholder="/quote"
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--card-muted)] p-3">
        <p className="text-xs font-semibold text-[var(--text-muted)]">생성된 URL</p>
        <p className="mt-1 break-all text-sm text-[var(--text-primary)]">{generatedUrl}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-strong)]"
        >
          URL 복사
        </button>
        {message ? <span className="text-xs text-emerald-600">{message}</span> : null}
      </div>
    </section>
  );
}
