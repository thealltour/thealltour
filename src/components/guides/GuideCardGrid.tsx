import type { Guide } from "@/types/guide";
import { GuideCard } from "@/components/guides/GuideCard";

export type GuideCardGridProps = {
  guides: Guide[];
  className?: string;
  gridCols?: "2" | "3" | "4";
};

/** 가이드 카드 그리드. 홈/랜딩/가이드 상세 관련 가이드에서 사용 */
export function GuideCardGrid({
  guides,
  className,
  gridCols = "4",
}: GuideCardGridProps) {
  if (guides.length === 0) return null;
  const gridClass =
    gridCols === "2"
      ? "grid-cols-1 sm:grid-cols-2"
      : gridCols === "3"
        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";

  return (
    <ul
      className={`grid gap-4 ${gridClass} ${className ?? ""}`.trim()}
      aria-label="여행 가이드"
    >
      {guides.map((guide) => (
        <li key={guide.id}>
          <GuideCard guide={guide} />
        </li>
      ))}
    </ul>
  );
}
