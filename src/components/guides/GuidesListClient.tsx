"use client";

import type { Guide } from "@/types/guide";
import { getGuideNotionViewUrl } from "@/lib/guides";

export type GuideWithBadges = Guide & { badgeLabels: string[] };

type GuidesListClientProps = {
  guides: GuideWithBadges[];
};

export function GuidesListClient({ guides }: GuidesListClientProps) {
  if (guides.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 type-small text-content-muted shadow-md ring-1 ring-[#e2e8f0]">
        아직 등록된 여행가이드가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {guides.map((guide) => {
        const notionUrl = getGuideNotionViewUrl(guide);
        const hasUrl = notionUrl.length > 0;
        return hasUrl ? (
          <a
            key={guide.id}
            href={notionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2"
          >
            <div className="relative h-40 w-full overflow-hidden bg-slate-200">
              {guide.cover_image_url || guide.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={guide.cover_image_url || guide.thumbnail_url || ""}
                  alt={guide.title_override || guide.title}
                  className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : null}
            </div>
            {/* 뱃지: 이미지 바로 아래, 홈 카드와 동일한 위치/스타일 */}
            {guide.badgeLabels.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-0">
                {guide.badgeLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption text-[var(--text-muted)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-1 flex-col gap-2 p-4 pt-2">
              <p className="section-label text-content-muted">여행가이드</p>
              <h3 className="font-card-title type-h3 text-content-primary">
                {guide.title_override || guide.title}
              </h3>
              {guide.summary ? (
                <p className="type-caption leading-relaxed text-content-secondary">
                  {guide.summary}
                </p>
              ) : null}
            </div>
          </a>
        ) : (
          <div
            key={guide.id}
            className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-md ring-1 ring-[#e2e8f0] opacity-75"
          >
            <div className="relative h-40 w-full overflow-hidden bg-slate-200">
              {guide.cover_image_url || guide.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={guide.cover_image_url || guide.thumbnail_url || ""}
                  alt={guide.title_override || guide.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
            {guide.badgeLabels.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3 pb-0">
                {guide.badgeLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption text-[var(--text-muted)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="flex flex-1 flex-col gap-2 p-4 pt-2">
              <p className="section-label text-content-muted">여행가이드</p>
              <h3 className="font-card-title type-h3 text-content-primary">
                {guide.title_override || guide.title}
              </h3>
              {guide.summary ? (
                <p className="type-caption leading-relaxed text-content-secondary">
                  {guide.summary}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">원문 URL이 없습니다.</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
