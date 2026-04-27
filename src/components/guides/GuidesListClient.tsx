"use client";

import Link from "next/link";
import type { Guide } from "@/types/guide";

export type GuideWithBadges = Guide & { badgeLabels: string[] };

type GuidesListClientProps = {
  guides: GuideWithBadges[];
};

function isLikelySignedNotionImageUrl(value?: string | null) {
  const raw = value?.trim();
  if (!raw) return false;
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const isNotionHost =
      host === "file.notion.so" ||
      host === "prod-files-secure.s3.us-west-2.amazonaws.com" ||
      host.endsWith(".notion.site");
    if (!isNotionHost) return false;
    return (
      url.searchParams.has("X-Amz-Algorithm") ||
      url.searchParams.has("X-Amz-Signature") ||
      url.searchParams.has("x-amz-signature")
    );
  } catch {
    return false;
  }
}

function pickGuideCardImage(guide: GuideWithBadges) {
  const stableCandidates = [guide.thumbnail_url, guide.guide_thumbnail_url, guide.cover_image_url];
  const signedCandidates: Array<string | null | undefined> = [];
  for (const candidate of stableCandidates) {
    const url = candidate?.trim();
    if (!url) continue;
    if (isLikelySignedNotionImageUrl(url)) {
      signedCandidates.push(url);
      continue;
    }
    return url;
  }
  return signedCandidates[0]?.trim() ?? "";
}

function cardInner(guide: GuideWithBadges) {
  const thumbUrl = pickGuideCardImage(guide);

  return (
    <>
      <div className="relative h-40 w-full overflow-hidden bg-slate-200">
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl}
            alt={guide.title_override || guide.title}
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
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
      </div>
    </>
  );
}

const CARD_CLASS =
  "group flex h-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2";

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
        const slug = guide.slug?.trim();
        if (slug) {
          return (
            <Link
              key={guide.id}
              href={`/guides/${encodeURIComponent(slug)}`}
              className={CARD_CLASS}
            >
              {cardInner(guide)}
            </Link>
          );
        }
        return (
          <div key={guide.id} className={`${CARD_CLASS} cursor-not-allowed opacity-75`}>
            {cardInner(guide)}
            <p className="px-4 pb-3 text-xs text-slate-500">slug가 없어 페이지로 이동할 수 없습니다.</p>
          </div>
        );
      })}
    </div>
  );
}
