"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { HomeBanner } from "@/types/homeBanner";

type HomeTopBannerProps = {
  banners: HomeBanner[];
};

export default function HomeTopBanner({ banners }: HomeTopBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const hasMany = banners.length > 1;
  const current = banners[activeIndex] ?? null;

  useEffect(() => {
    if (!hasMany) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [hasMany, banners.length]);

  const containerClass = useMemo(
    () => "relative overflow-hidden rounded-3xl shadow-xl ring-1 ring-[var(--border)]",
    [],
  );

  if (!current) return null;

  const content = (
    <article className={containerClass}>
      <div className="relative hidden aspect-[3/1] w-full md:block">
        <Image
          src={current.image_url}
          alt={current.title}
          fill
          sizes="(min-width: 768px) 1100px, 100vw"
          className="object-cover"
        />
      </div>
      <div className="relative aspect-[4/5] w-full md:hidden">
        <Image
          src={current.mobile_image_url || current.image_url}
          alt={current.title}
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] bg-gradient-to-t from-black/45 via-black/10 to-transparent p-5 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">THEALL CURATION</p>
        <p className="mt-1 text-lg font-bold md:text-2xl">{current.title}</p>
      </div>

      {hasMany ? (
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1.5">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`${index + 1}번 배너 보기`}
              className={`h-2 w-2 rounded-full transition ${
                index === activeIndex ? "bg-[var(--surface)]" : "bg-[var(--surface)]/50"
              }`}
            />
          ))}
        </div>
      ) : null}
    </article>
  );

  if (!current.link_url) return content;

  return (
    <Link href={current.link_url} className="block">
      {content}
    </Link>
  );
}
