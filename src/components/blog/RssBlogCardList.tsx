"use client";

import Image from "next/image";
import type { RssPost } from "@/lib/rss.types";
import { GUIDE_CARD_FALLBACK_IMAGE } from "@/lib/guides/imageUrl";

type RssBlogCardListProps = {
  posts: RssPost[];
};

export function RssBlogCardList({ posts }: RssBlogCardListProps) {
  if (posts.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 type-small text-content-muted shadow-md ring-1 ring-[#e2e8f0]">
        업데이트된 블로그 소식이 없습니다.
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-3 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
      {posts.map((post) => {
        const sourceLabel =
          post.source === "naver"
            ? "NAVER BLOG"
            : post.source === "tistory"
              ? "TISTORY"
              : "BLOG";

        return (
          <a
            key={post.id}
            href={post.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-[#e2e8f0] transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="relative h-40 w-full overflow-hidden bg-[#eff6ff]">
              {post.thumbnail ? (
                <Image
                  src={post.thumbnail}
                  alt={post.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 30vw"
                  className="object-cover"
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
                <div className="flex h-full items-center justify-center type-caption text-content-muted">
                  THEALL TRAVEL BLOG
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="space-y-1.5">
                <p className="section-label uppercase tracking-wide text-[#B8962E]">
                  {sourceLabel}
                </p>
                <h2 className="font-card-title line-clamp-2 type-body font-semibold text-content-primary md:type-small">
                  {post.title}
                </h2>
              </div>

              {post.summary ? (
                <p className="line-clamp-3 type-small leading-6 text-content-secondary">
                  {post.summary}
                </p>
              ) : null}

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <span className="type-caption text-content-muted">{post.pubDate}</span>
                <span className="section-label flex items-center gap-0.5 text-[var(--primary)]">
                  원문 읽기 <span aria-hidden>→</span>
                </span>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}
