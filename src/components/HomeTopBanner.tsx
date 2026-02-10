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
    () => "relative overflow-hidden rounded-3xl shadow-xl ring-1 ring-[#dbeafe]",
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
          priority
        />
      </div>
      <div className="relative aspect-[4/5] w-full md:hidden">
        <Image
          src={current.mobile_image_url || current.image_url}
          alt={current.title}
          fill
          sizes="100vw"
          className="object-cover"
          priority
        />
      </div>

      {hasMany ? (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/30 px-3 py-1.5">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`${index + 1}번 배너 보기`}
              className={`h-2 w-2 rounded-full transition ${
                index === activeIndex ? "bg-white" : "bg-white/50"
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
