"use client";

import AlertCard from "@/components/ui/AlertCard";
import { PlannerDaySection } from "@/components/planner/PlannerDaySection";
import { PlannerEditPanel } from "@/components/planner/PlannerEditPanel";
import { PlannerPlanSummary } from "@/components/planner/PlannerPlanSummary";
import { PlannerSavePanel } from "@/components/planner/PlannerSavePanel";
import type { PlannerPlan } from "@/lib/planner/planSchemas";

type PlannerResultViewProps = {
  plan: PlannerPlan;
  sessionId: string;
  sourceProductId: string | null;
  isSaved: boolean;
  onSaved: () => void;
  onPlanUpdated: (plan: PlannerPlan) => void;
};

export function PlannerResultView({
  plan,
  sessionId,
  sourceProductId,
  isSaved,
  onSaved,
  onPlanUpdated,
}: PlannerResultViewProps) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8 sm:px-0 sm:py-12">
      <PlannerPlanSummary plan={plan} />

      <div className="space-y-3">
        <PlannerSavePanel
          sessionId={sessionId}
          destination={plan.destination.name}
          sourceProductId={sourceProductId}
          isSaved={isSaved}
          onSaved={onSaved}
        />
        <PlannerEditPanel
          sessionId={sessionId}
          destination={plan.destination.name}
          sourceProductId={sourceProductId}
          status={isSaved ? "saved" : "generated"}
          onPlanUpdated={onPlanUpdated}
        />
      </div>

      <AlertCard variant="neutral" title="AI 초안 안내">
        <p className="type-small text-[var(--text-secondary)]">
          AI가 입력하신 여행 조건을 바탕으로 만든 초안입니다. 운영시간·휴무·현지 사정은 여행
          전 다시 확인해 주세요.
        </p>
      </AlertCard>

      <div className="space-y-5">
        <h2 className="type-h3 text-[var(--foreground)]">일자별 일정</h2>
        <p className="type-caption text-[var(--text-muted)]">
          이동시간은 예상치이며 실제 교통상황에 따라 달라질 수 있습니다.
        </p>
        {plan.days.map((day) => (
          <PlannerDaySection key={`${day.day}-${day.date}-${day.title}`} day={day} />
        ))}
      </div>

      <section className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div>
          <h2 className="type-h3 text-[var(--foreground)]">여행 전에 참고하세요</h2>
          <ul className="mt-2 space-y-1.5">
            {plan.preparation.travelTips.map((tip) => (
              <li key={tip} className="type-small text-[var(--text-secondary)]">
                · {tip}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="type-h3 text-[var(--foreground)]">챙기면 좋은 것</h2>
          <ul className="mt-2 space-y-1.5">
            {plan.preparation.packingHints.map((hint) => (
              <li key={hint} className="type-small text-[var(--text-secondary)]">
                · {hint}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
