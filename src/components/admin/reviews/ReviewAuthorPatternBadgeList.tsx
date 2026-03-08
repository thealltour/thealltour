"use client";

type ReviewAuthorPatternBadgeListProps = {
  signals: string[];
};

const SIGNAL_LABELS: Record<string, string> = {
  "극단 평점(1/5점) 비율이 높습니다.": "극단 평점 편향",
  "유사/반복 문구 비율이 높습니다.": "중복 문구",
  "최근 3일 내 다수 리뷰 작성.": "버스트 작성",
  "최근 7일 내 리뷰 집중 작성.": "집중 작성",
  "짧은 리뷰 비율이 높습니다.": "저품질",
  "저신뢰 리뷰 비율이 높습니다.": "저신뢰",
};

function getLabel(signal: string): string {
  return SIGNAL_LABELS[signal] ?? signal;
}

export function ReviewAuthorPatternBadgeList({ signals }: ReviewAuthorPatternBadgeListProps) {
  if (signals.length === 0) {
    return <span className="text-xs text-[var(--text-muted)]">패턴 없음</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {signals.map((s) => (
        <span
          key={s}
          className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
        >
          {getLabel(s)}
        </span>
      ))}
    </div>
  );
}
