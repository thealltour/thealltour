"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/cn";
import type { HomeBanner } from "@/types/homeBanner";

const SLIDE_INTERVAL_MS = 5000;
const HERO_PANORAMA_MAX_WIDTH_PX = 1600;

function bannerSrcForMidViewport(banner: HomeBanner): string {
  const mobile = banner.mobile_image_url?.trim();
  return mobile && mobile.length > 0 ? mobile : banner.image_url;
}

type HeroPanoramaSlideshowClientProps = {
  banners: HomeBanner[];
};

export function HeroPanoramaSlideshowClient({ banners }: HeroPanoramaSlideshowClientProps) {
  const [active, setActive] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (banners.length <= 1 || reducedMotion) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % banners.length);
    }, SLIDE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [banners.length, reducedMotion]);

  const fadeClass = reducedMotion ? "transition-none" : "transition-opacity duration-700 ease-in-out";
  const activeIndex = banners.length > 0 ? active % banners.length : 0;

  function renderStack(
    keyPrefix: string,
    getSrc: (banner: HomeBanner) => string,
    wrapperClass: string,
    objectPositionClass: string,
  ) {
    return (
      <div className={cn("absolute inset-0", wrapperClass)}>
        {banners.map((banner, i) => (
          <div
            key={`${keyPrefix}-${banner.id}`}
            className={cn("absolute inset-0", fadeClass)}
            style={{
              opacity: i === activeIndex ? 1 : 0,
              zIndex: i === activeIndex ? 1 : 0,
            }}
            aria-hidden={i !== activeIndex}
          >
            <Image
              src={getSrc(banner)}
              alt={banner.title}
              fill
              sizes={`(max-width: ${HERO_PANORAMA_MAX_WIDTH_PX}px) 100vw, ${HERO_PANORAMA_MAX_WIDTH_PX}px`}
              priority={i === 0}
              fetchPriority={i === 0 ? "high" : "auto"}
              quality={82}
              className={cn("object-cover", objectPositionClass)}
              loading={i === 0 ? undefined : "lazy"}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {renderStack("mid", bannerSrcForMidViewport, "md:block lg:hidden", "object-center")}
      {renderStack("lg", (banner) => banner.image_url, "hidden lg:block", "object-[right_center]")}
    </>
  );
}
