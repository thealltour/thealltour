"use client";

import AdminBadge from "@/components/admin/ui/AdminBadge";
import { cn } from "@/lib/cn";
import { formatStoryEditorialArchetypeLabel } from "@/components/admin/marketing-review/storyEditorialArchetypeLabel";

export type StoryPassCandidateCardProps = {
  pointId: string;
  /** 0-based display order — Candidate #1 is index 0. */
  index: number;
  sourceLabel: string;
  editorialArchetype: string | null;
  headline: string;
  audienceTension: string | null;
  readerPayoff: string | null;
  genericRisk: string | null;
  whyInteresting: string | null;
  mechanisms: string[];
  researchQuestions: string[];
  researchRejected: boolean;
  /** Human already stamped this point but pipeline has not advanced past Story gate. */
  alreadySelected?: boolean;
  busy?: boolean;
  onSelectStory?: (pointId: string) => void;
};

export function StoryPassCandidateCard({
  pointId,
  index,
  sourceLabel,
  editorialArchetype,
  headline,
  audienceTension,
  readerPayoff,
  genericRisk,
  whyInteresting,
  mechanisms,
  researchQuestions,
  researchRejected,
  alreadySelected = false,
  busy = false,
  onSelectStory,
}: StoryPassCandidateCardProps) {
  const archetypeLabel = formatStoryEditorialArchetypeLabel(editorialArchetype);
  const archetypeBadgeText = archetypeLabel ?? "아키타입 미지정";
  const isRecommended = index === 0;
  const hasDetails =
    Boolean(whyInteresting?.trim()) || mechanisms.length > 0 || researchQuestions.length > 0;

  return (
    <div
      className={cn(
        "rounded border border-[var(--success)]/30 bg-white/60 px-2.5 py-2",
        researchRejected && "opacity-60",
        alreadySelected && "border-[var(--primary)]/50 bg-[var(--primary-soft)]/40",
      )}
      data-testid="story-pass-candidate-card"
      data-candidate-index={index + 1}
      data-recommended={isRecommended ? "true" : "false"}
      data-already-selected={alreadySelected ? "true" : "false"}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <span>
              {`후보 #${index + 1}`}
              {researchRejected ? " · 연구 거부됨" : ""}
              {" · "}
              <span className="font-medium text-[var(--text-primary)]">{sourceLabel}</span>
            </span>
            {isRecommended ? (
              <AdminBadge variant="success" showDot={false} className="px-2 py-0 text-[10px]">
                추천 Story
              </AdminBadge>
            ) : null}
            {alreadySelected ? (
              <AdminBadge variant="success" showDot={false} className="px-2 py-0 text-[10px]">
                선택됨
              </AdminBadge>
            ) : null}
            <span data-testid="story-archetype-badge" className="inline-flex max-w-full">
              <AdminBadge variant="neutral" showDot={false} className="max-w-full px-2 py-0 text-[10px]">
                <span className="truncate" title={editorialArchetype ?? undefined}>
                  {archetypeBadgeText}
                </span>
              </AdminBadge>
            </span>
          </div>
          <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">{headline}</p>
        </div>
        {onSelectStory && !researchRejected ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSelectStory(pointId)}
            className="min-h-11 shrink-0 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
          >
            {alreadySelected ? "이 Story로 재개" : "이 Story로 제작"}
          </button>
        ) : null}
      </div>
      <div className="mt-2 space-y-1 text-[12px] text-[var(--text-secondary)]">
        {audienceTension ? (
          <p>
            <span className="font-medium text-[var(--text-primary)]">긴장 </span>
            {audienceTension}
          </p>
        ) : null}
        {readerPayoff ? (
          <p>
            <span className="font-medium text-[var(--text-primary)]">얻는 것 </span>
            {readerPayoff}
          </p>
        ) : null}
        {genericRisk ? (
          <p className="rounded border border-[var(--warning)]/40 bg-[var(--warning-bg)] px-2 py-1 text-[var(--warning)]">
            <span className="font-medium">주의 </span>
            {genericRisk}
          </p>
        ) : null}
      </div>
      {hasDetails ? (
        <details className="mt-2 text-[11px] text-[var(--text-secondary)]">
          <summary className="cursor-pointer text-[var(--primary)]">상세 보기</summary>
          <dl className="mt-1.5 grid gap-1 sm:grid-cols-2">
            {whyInteresting ? (
              <div className="sm:col-span-2">
                <dt className="inline font-medium text-[var(--text-primary)]">왜 흥미로운가 </dt>
                <dd className="inline">{whyInteresting}</dd>
              </div>
            ) : null}
            {mechanisms.length > 0 ? (
              <div className="sm:col-span-2">
                <dt className="inline font-medium text-[var(--text-primary)]">메커니즘 </dt>
                <dd className="inline">{mechanisms.join(", ")}</dd>
              </div>
            ) : null}
            {researchQuestions.length > 0 ? (
              <div className="sm:col-span-2">
                <dt className="inline font-medium text-[var(--text-primary)]">연구 질문 </dt>
                <dd className="inline">{researchQuestions.join(" · ")}</dd>
              </div>
            ) : null}
          </dl>
        </details>
      ) : null}
    </div>
  );
}
