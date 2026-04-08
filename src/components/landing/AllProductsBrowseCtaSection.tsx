import Link from "next/link";
import { cn } from "@/lib/cn";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";

export type AllProductsBrowseCtaSectionProps = {
  /** `/products?region=…`, `/products?theme=…` 등 전체 목록으로 이동할 URL */
  href: string;
  className?: string;
};

/**
 * 허브 `/destinations`·`/themes` 하단과 동일 톤: 전체 상품 조회 카드 + Primary CTA.
 */
export function AllProductsBrowseCtaSection({ href, className }: AllProductsBrowseCtaSectionProps) {
  return (
    <section
      id="all-products"
      aria-labelledby="all-products-heading"
      className={cn("mt-16 scroll-mt-28", className)}
    >
      <SectionBlock surface="muted" padding="lg">
        <SectionHeader
          titleId="all-products-heading"
          title="전체 상품 조회"
          description="전체 상품을 지역·테마 별로 정렬하여 탐색할 수 있습니다."
          align="center"
        />
        <div className="mt-6 flex justify-center">
          <Link
            href={href}
            className={cn(
              "type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-5 py-2.5 font-semibold text-[var(--on-primary)] transition hover:opacity-90",
              solidButtonShadowClasses,
            )}
          >
            전체 상품 보기
          </Link>
        </div>
      </SectionBlock>
    </section>
  );
}
