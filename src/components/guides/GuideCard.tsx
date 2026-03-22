"use client";

import Link from "next/link";
import Image from "next/image";
import type { Guide } from "@/types/guide";
import { getGuideHref, getGuideNotionViewUrl } from "@/lib/guides";
import { cn } from "@/lib/cn";

export type GuideCardProps = {
  guide: Guide;
  className?: string;
  /** 요약/태그 표시 줄 수 등 조정용. 기본은 카드형 */
  variant?: "default" | "compact";
  /**
   * default: 사이트 내 링크(getGuideHref).
   * notion_external: /guides 목록과 동일하게 노션 원문(새 탭). URL 없으면 getGuideHref로 폴백.
   */
  linkBehavior?: "default" | "notion_external";
};

/** 이미지:텍스트 = 5:5(50%:50%). 행 높이는 카드 전체(h-full) 기준으로 균일. */
const CARD_LINK_CLASS =
  "group grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-soft-strong)] hover:ring-1 hover:ring-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:rounded-3xl";

/**
 * 단일 가이드 카드. 썸네일, 제목, 요약, 카테고리/태그 일부.
 * 홈 / destination·theme 랜딩 / 가이드 상세 관련 가이드에서 공통 사용.
 */
export function GuideCard({
  guide,
  className,
  variant = "default",
  linkBehavior = "default",
}: GuideCardProps) {
  const notionUrl = linkBehavior === "notion_external" ? getGuideNotionViewUrl(guide).trim() : "";
  const siteHref = getGuideHref(guide);
  const openNotion = linkBehavior === "notion_external" && notionUrl.length > 0;
  const href = openNotion ? notionUrl : siteHref;
  const thumbUrl =
    guide.cover_image_url ?? guide.thumbnail_url ?? guide.guide_thumbnail_url ?? "";
  const title = guide.title_override?.trim() || guide.title;
  const hasCategoryOrTags = guide.category || (guide.tags?.length ?? 0) > 0;
  const hasTaxonomyNames = guide.destination_name || guide.theme_name;
  const showMeta = variant === "default" && (hasCategoryOrTags || !!hasTaxonomyNames);

  /** h-full: 레일·그리드에서 행 높이 맞춤. min-h: 비율 그리드가 쓸 최소 카드 높이. */
  const wrapperClass = cn(CARD_LINK_CLASS, "h-full min-h-[240px] sm:min-h-[260px]", className);

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

  if (openNotion) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={wrapperClass}
      >
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={wrapperClass}>
      {inner}
    </Link>
  );
}
