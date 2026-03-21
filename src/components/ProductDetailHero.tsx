"use client";

import Tag from "@/components/ui/Tag";
import { useConsultModal } from "@/components/ConsultModal";
import { buttonVariants } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export type DetailHeroProps = {
  title: string;
  tags: { label: string; variant: "accent" | "muted" | "gold" }[];
  shortSummary: string;
  priceFormatted: string | null;
  duration?: string;
  minDeparturePeople?: string;
  productId: string;
  productTitle: string;
  sourcePath: string;
  kakaoHref: string;
};

export default function ProductDetailHero({
  title,
  tags,
  shortSummary,
  priceFormatted,
  duration,
  minDeparturePeople,
  productId,
  productTitle,
  sourcePath,
  kakaoHref,
}: DetailHeroProps) {
  const { openModal } = useConsultModal();
  const metaLines = [duration, minDeparturePeople ? `${minDeparturePeople}명 이상 출발 확정` : null].filter(
    Boolean
  ) as string[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((t) => (
          <Tag key={t.label} variant={t.variant} size="sm">
            {t.label}
          </Tag>
        ))}
      </div>
      <h1 className="font-card-title text-2xl font-bold text-[#0f172a] leading-tight md:text-3xl">
        {title}
      </h1>
      <p className="text-sm leading-[1.75] text-slate-600 md:text-base">
        {shortSummary}
      </p>

      {/* PriceBlock - 카드 형태 강조 */}
      <div className="rounded-2xl border border-[var(--primary-soft)] bg-[var(--primary-soft)] p-5 ring-1 ring-[var(--primary-soft)]">
        {priceFormatted ? (
          <p className="font-price-strong text-xl font-bold text-[var(--primary)] md:text-2xl">
            ₩{priceFormatted}~
          </p>
        ) : (
          <p className="font-price-strong text-xl font-semibold text-slate-600 md:text-2xl">
            상담 후 견적 안내
          </p>
        )}
        {metaLines.length > 0 && (
          <p className="mt-1 text-sm text-slate-500">
            {metaLines.join(" · ")}
          </p>
        )}
        <p className="mt-0.5 text-xs text-slate-500">1인 기준 · 유류할증료는 상담 시 안내</p>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => openModal({ productId, productTitle, sourcePath })}
          className="type-btn inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-5 py-3 text-[var(--on-accent)] shadow-md transition hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] hover:shadow-lg"
        >
          상담 문의하기
        </button>
        <a
          href={kakaoHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            buttonVariants({
              variant: "kakao",
              size: "md",
              className: "w-full px-5 py-3 sm:w-auto",
            }),
          )}
        >
          카톡 상담
        </a>
      </div>
    </div>
  );
}
