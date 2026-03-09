import Link from "next/link";
import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { GuideCard } from "@/components/home/GuideCard";
import type { Guide } from "@/types/guide";

export type HomeGuideSectionProps = {
  guides: Guide[];
  className?: string;
};

/**
 * 홈 여행 가이드 섹션. TRAVEL GUIDE / 여행 준비에 도움이 되는 가이드 + 카드 4개.
 */
export function HomeGuideSection({ guides, className }: HomeGuideSectionProps) {
  if (guides.length === 0) return null;

  return (
    <SectionBlock surface="none" padding="md" className={className}>
      <SectionHeader
        eyebrow="TRAVEL GUIDE"
        title="여행 준비에 도움이 되는 가이드"
        description="지역별·테마별 꿀팁과 가이드를 만나보세요."
        align="left"
      />
      <ul
        className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="여행 가이드"
      >
        {guides.map((guide) => (
          <li key={guide.id}>
            <GuideCard guide={guide} />
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Link
          href="/guides"
          className="type-btn inline-flex rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-5 py-2.5 text-[var(--primary)] transition hover:bg-[var(--primary-soft)]"
        >
          가이드 전체 보기
        </Link>
      </div>
    </SectionBlock>
  );
}
