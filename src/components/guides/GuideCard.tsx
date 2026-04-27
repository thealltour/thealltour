"use client";

import Link from "next/link";
import Image from "next/image";
import type { Guide } from "@/types/guide";
import { getGuideHref } from "@/lib/guides";
import { cn } from "@/lib/cn";

const GUIDE_IMAGE_FALLBACK_SRC = "/thealltour-logo.png";

export type GuideCardProps = {
  guide: Guide;
  className?: string;
  /** 요약/태그 표시 줄 수 등 조정용. 기본은 카드형 */
  variant?: "default" | "compact";
};

/** 이미지:텍스트 = 5:5(50%:50%). 행 높이는 카드 전체(h-full) 기준으로 균일. */
const CARD_LINK_CLASS =
  "group grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-soft-strong)] hover:ring-1 hover:ring-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:rounded-3xl";

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

function pickGuideCardImage(guide: Guide) {
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

/**
 * 단일 가이드 카드. 썸네일, 제목, 요약, 카테고리/태그 일부.
 * 클릭 시 /guides/[slug] 브리지(또는 slug 없으면 landing /blog)로 이동. 노션은 브리지에서 연다.
 */
export function GuideCard({
  guide,
  className,
  variant = "default",
}: GuideCardProps) {
  const href = getGuideHref(guide);
  const thumbUrl = pickGuideCardImage(guide);
  const title = guide.title_override?.trim() || guide.title;
  const hasCategoryOrTags = guide.category || (guide.tags?.length ?? 0) > 0;
  const hasTaxonomyNames = guide.destination_name || guide.theme_name;
  const showMeta = variant === "default" && (hasCategoryOrTags || !!hasTaxonomyNames);

  /** h-full: 레일·그리드에서 행 높이 맞춤. min-h: 비율 그리드가 쓸 최소 카드 높이. */
  const wrapperClass = cn(
    CARD_LINK_CLASS,
    "h-full min-h-[240px] min-w-0 max-w-full sm:min-h-[260px]",
    className,
  );

  const inner = (
    <>
      <div className="relative min-h-0 w-full overflow-hidden bg-[var(--surface-muted)]">
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-200 group-hover:scale-[1.02]"
            onError={(event) => {
              const img = event.currentTarget;
              if (img.src.endsWith(GUIDE_IMAGE_FALLBACK_SRC)) return;
              img.srcset = "";
              img.src = GUIDE_IMAGE_FALLBACK_SRC;
            }}
          />
        ) : (
          <div className="flex h-full min-h-[5.5rem] items-center justify-center type-caption text-[var(--text-muted)]">
            가이드
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden p-4 sm:p-5">
        {showMeta ? (
          <div className="flex flex-wrap items-center gap-1.5 section-label text-[var(--text-muted)]">
            {guide.category ? (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                {guide.category}
              </span>
            ) : null}
            {guide.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption"
              >
                {tag}
              </span>
            ))}
            {!hasCategoryOrTags && guide.destination_name ? (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                {guide.destination_name}
              </span>
            ) : null}
            {!hasCategoryOrTags && guide.theme_name ? (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 type-caption">
                {guide.theme_name}
              </span>
            ) : null}
          </div>
        ) : null}
        <h3 className="font-card-title mt-1 line-clamp-2 type-small font-semibold text-[var(--foreground)]">
          {title}
        </h3>
        {variant === "default" && guide.summary ? (
          <p className="mt-1 line-clamp-2 type-caption text-[var(--text-muted)]">
            {guide.summary}
          </p>
        ) : null}
        <span className="mt-auto inline-flex items-center pt-3 section-label text-[var(--primary)]">
          보기
          <span className="ml-1" aria-hidden>→</span>
        </span>
      </div>
    </>
  );

  return (
    <Link href={href} className={wrapperClass}>
      {inner}
    </Link>
  );
}
