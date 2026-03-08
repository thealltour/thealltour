import { SectionBlock } from "@/components/layout/SectionBlock";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { LandingSubnodeCard } from "@/components/landing/LandingSubnodeCard";
import type { LandingSubnode } from "@/types/landingSubnode";
import { cn } from "@/lib/cn";

export type LandingSubCardsSectionProps = {
  /** 상세 랜딩 제목(맥락 표시용) */
  contextTitle: string;
  /** PR-6 하위 탐색 카드. 있으면 카드 그리드 렌더, 없으면 placeholder */
  nodes?: LandingSubnode[];
  /** 레거시: children으로 직접 넣을 수도 있음 */
  children?: React.ReactNode;
  className?: string;
};

/**
 * 상세 랜딩 내 "하위 탐색 카드" 섹션.
 * nodes가 있으면 카드 그리드, 없으면 placeholder.
 */
export function LandingSubCardsSection({
  contextTitle,
  nodes,
  children,
  className,
}: LandingSubCardsSectionProps) {
  const hasNodes = nodes && nodes.length > 0;

  return (
    <SectionBlock surface="none" padding="md" className={cn(className)}>
      <SectionHeader
        eyebrow="더 구체적으로 탐색"
        title={`${contextTitle} 세부 탐색`}
        description={
          hasNodes
            ? "도시·소지역·스타일·관광 포인트별로 더 좁은 상품을 찾아보세요."
            : "도시·소지역·스타일·관광 포인트별로 더 좁은 상품을 찾아보세요. (준비 중)"
        }
        align="left"
      />
      {hasNodes ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {nodes!.map((node) => (
            <LandingSubnodeCard key={node.id} node={node} />
          ))}
        </div>
      ) : children ? (
        <div className="mt-6">{children}</div>
      ) : (
        <div
          className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 py-8 text-center type-small text-[var(--text-muted)]"
          aria-hidden
        >
          하위 탐색 카드는 추후 데이터 연동 시 노출됩니다.
        </div>
      )}
    </SectionBlock>
  );
}
