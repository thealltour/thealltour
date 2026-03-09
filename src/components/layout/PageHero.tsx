import React from "react";
import { cn } from "@/lib/cn";

type PageHeroProps = {
  kicker?: string;
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  /** lg: 기본 높이(280px), sm: 슬림(120px). 콘텐츠 페이지는 sm 권장 */
  size?: "lg" | "sm";
};

export function PageHero({ kicker, title, subtitle, rightSlot, size = "lg" }: PageHeroProps) {
  return (
    <section
      className={cn(
        "page-hero flex flex-col gap-4 rounded-3xl md:flex-row md:items-center md:justify-between",
        size === "lg" ? "min-h-[280px]" : "min-h-[120px]",
        size === "sm" && "py-6 md:py-6",
      )}
    >
      <div className="space-y-2">
        {kicker ? (
          <p className="section-label text-white/80">{kicker}</p>
        ) : null}
        <h1 className="section-title type-h2 md:text-[32px] md:leading-[1.2] text-white">
          {title}
        </h1>
        {subtitle ? (
          <p className="type-small text-white/90">{subtitle}</p>
        ) : null}
      </div>
      {rightSlot ? <div className="mt-4 md:mt-0">{rightSlot}</div> : null}
    </section>
  );
}

