"use client";

import Link from "next/link";
import Image from "next/image";
import type { Guide } from "@/types/guide";
import { getGuideHref } from "@/lib/guides";

export type GuideCardProps = {
  guide: Guide;
  className?: string;
  /** 요약/태그 표시 줄 수 등 조정용. 기본은 카드형 */
  variant?: "default" | "compact";
};

/**
 * 단일 가이드 카드. 썸네일, 제목, 요약, 카테고리/태그 일부.
 * 홈 / destination·theme 랜딩 / 가이드 상세 관련 가이드에서 공통 사용.
 * 링크: getGuideHref(guide) → /guides/[slug] 우선, 없으면 landing_url, /guides
 */
export function GuideCard({ guide, className, variant = "default" }: GuideCardProps) {
  const href = getGuideHref(guide);
  const thumbUrl =
    guide.cover_image_url ?? guide.thumbnail_url ?? guide.guide_thumbnail_url ?? "";
  const title = guide.title_override?.trim() || guide.title;
  const showMeta = variant === "default" && (guide.category || (guide.tags?.length ?? 0) > 0);

  return (
    <Link
      href={href}
      className={
        className ??
        "group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-soft-strong)] hover:ring-1 hover:ring-[var(--border-strong)] sm:rounded-3xl"
      }
    >
      <div className="relative aspect-[16/10] w-full shrink-0 bg-[var(--surface-muted)]">
        {thumbUrl ? (
          <Image
            src={thumbUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-200 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center type-caption text-[var(--text-muted)]">
            가이드
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
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
        <span className="mt-3 inline-flex items-center section-label text-[var(--primary)]">
          보기
          <span className="ml-1" aria-hidden>→</span>
        </span>
      </div>
    </Link>
  );
}
