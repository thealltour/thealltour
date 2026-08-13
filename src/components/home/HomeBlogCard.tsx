"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";
import { GUIDE_CARD_FALLBACK_IMAGE } from "@/lib/guides/imageUrl";
import type { RssPost } from "@/lib/rss.types";

const CARD_LINK_CLASS =
  "group grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)] transition hover:shadow-[var(--shadow-soft-strong)] hover:ring-1 hover:ring-[var(--border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:rounded-3xl";

export type HomeBlogCardProps = {
  post: RssPost;
  className?: string;
};

function sourceLabel(source: RssPost["source"]) {
  if (source === "naver") return "NAVER BLOG";
  if (source === "tistory") return "TISTORY";
  return "BLOG";
}

export function HomeBlogCard({ post, className }: HomeBlogCardProps) {
  const wrapperClass = cn(
    CARD_LINK_CLASS,
    "h-full min-h-[240px] min-w-0 max-w-full sm:min-h-[260px]",
    className,
  );

  return (
    <a
      href={post.link}
      target="_blank"
      rel="noopener noreferrer"
      className={wrapperClass}
    >
      <div className="relative min-h-0 w-full overflow-hidden bg-[var(--surface-muted)]">
        {post.thumbnail ? (
          <Image
            src={post.thumbnail}
            alt=""
            fill
            sizes="(max-width: 640px) 58vw, 272px"
            className="object-cover transition duration-200 group-hover:scale-[1.02]"
            onError={(event) => {
              const img = event.currentTarget;
              if (img.src.endsWith(GUIDE_CARD_FALLBACK_IMAGE)) return;
              img.srcset = "";
              img.src = GUIDE_CARD_FALLBACK_IMAGE;
              img.style.objectFit = "contain";
              img.style.objectPosition = "center";
              img.style.backgroundColor = "#ffffff";
              img.style.padding = "8px";
            }}
          />
        ) : (
          <div className="flex h-full min-h-[5.5rem] items-center justify-center type-caption text-[var(--text-muted)]">
            블로그
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden p-4 sm:p-5">
        <p className="section-label uppercase tracking-wide text-[#B8962E]">
          {sourceLabel(post.source)}
        </p>
        <h3 className="font-card-title mt-1 line-clamp-2 type-small font-semibold text-[var(--foreground)]">
          {post.title}
        </h3>
        {post.summary ? (
          <p className="mt-1 line-clamp-2 type-caption text-[var(--text-muted)]">
            {post.summary}
          </p>
        ) : null}
        <span className="mt-auto inline-flex items-center pt-3 section-label text-[var(--primary)]">
          원문 읽기
          <span className="ml-1" aria-hidden>
            →
          </span>
        </span>
      </div>
    </a>
  );
}
