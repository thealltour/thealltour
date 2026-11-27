import Link from "next/link";
import { SectionBlock } from "@/components/layout/SectionBlock";
import {
  SectionHeader,
  HOME_MAIN_SECTION_BLOCK_CLASS,
} from "@/components/layout/SectionHeader";
import { CorporateQuoteCta } from "@/components/corporate/CorporateQuoteCta";
import { cn } from "@/lib/cn";
import {
  CORPORATE_HUB,
  CORPORATE_SEGMENTS,
  getCorporateHubQuoteHref,
} from "@/lib/corporate/content";

/**
 * 홈 기업·기관 단체여행 진입 섹션 (텍스트 중심, 이미지는 PR 3).
 */
export default function HomeCorporateSection({ className }: { className?: string }) {
  const quoteHref = getCorporateHubQuoteHref();

  return (
    <SectionBlock
      surface="none"
      padding="md"
      className={cn(HOME_MAIN_SECTION_BLOCK_CLASS, "md:!px-0", className)}
    >
      <div className="flex flex-col gap-3 sm:gap-3.5">
        <SectionHeader
          title="기업·기관 단체여행"
          description="포상여행부터 직무연수·정책시찰까지"
          action={
            <CorporateQuoteCta
              href={quoteHref}
              className="hidden sm:inline-flex"
            />
          }
        />

        <div className="sm:hidden">
          <CorporateQuoteCta href={quoteHref} className="w-full" />
        </div>

        <ul className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-4">
          {CORPORATE_SEGMENTS.map((segment) => (
            <li key={segment.id} className="min-w-0">
              <Link
                href={segment.path}
                className={cn(
                  "flex h-full min-h-[4.5rem] flex-col justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3",
                  "transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                )}
              >
                <span className="text-sm font-semibold text-[var(--foreground)]">
                  {segment.navLabel}
                </span>
                <span className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                  {segment.id === "business"
                    ? "인센티브·포상·워크숍"
                    : segment.id === "public-enterprises"
                      ? "직무연수·시설 견학"
                      : segment.id === "public-institutions"
                        ? "정책연수·현장 답사"
                        : "위원회 주제 시찰"}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="type-small text-[var(--text-muted)]">
          <Link href={CORPORATE_HUB.path} className="font-medium text-[var(--primary)] hover:underline">
            기업·단체여행 허브 보기
          </Link>
        </p>
      </div>
    </SectionBlock>
  );
}
