"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  trackPlannerEditFailed,
  trackPlannerEditStarted,
  trackPlannerEditSucceeded,
} from "@/lib/analytics/trackPlannerEvents";
import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";
import type { PlannerPlan } from "@/lib/planner/planSchemas";
import { PlannerGenerationView } from "@/components/planner/PlannerGenerationView";

const PRESET_CHIPS = [
  "좀 더 여유롭게",
  "맛집을 더 추가",
  "쇼핑 시간을 늘려줘",
  "아이와 편하게",
] as const;

type EditResponse = {
  message?: string;
  session?: {
    plan: PlannerPlan | null;
    status: string;
    isSaved?: boolean;
    updatedAt?: string;
  };
};

type PlannerEditPanelProps = {
  sessionId: string;
  destination: string;
  sourceProductId: string | null;
  status: "generated" | "saved";
  onPlanUpdated: (plan: PlannerPlan) => void;
};

export function PlannerEditPanel({
  sessionId,
  destination,
  sourceProductId,
  status,
  onPlanUpdated,
}: PlannerEditPanelProps) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successHint, setSuccessHint] = useState(false);

  const submit = useCallback(async () => {
    const trimmed = instruction.trim();
    if (trimmed.length < 2 || submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccessHint(false);

    trackPlannerEditStarted({
      sessionId,
      destination,
      sourceProductId,
      instructionLength: trimmed.length,
      status,
    });

    try {
      const anonymousKey = getOrCreatePlannerAnonymousKey();
      const res = await fetch(`/api/planner/sessions/${encodeURIComponent(sessionId)}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ instruction: trimmed, anonymousKey }),
      });
      const data = (await res.json().catch(() => null)) as EditResponse | null;
      if (!res.ok || !data?.session?.plan) {
        trackPlannerEditFailed({
          sessionId,
          destination,
          sourceProductId,
          instructionLength: trimmed.length,
          status,
        });
        setError(data?.message ?? "일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      trackPlannerEditSucceeded({
        sessionId,
        destination,
        sourceProductId,
        instructionLength: trimmed.length,
        status,
        dayCount: data.session.plan.days.length,
      });
      onPlanUpdated(data.session.plan);
      setOpen(false);
      setInstruction("");
      setSuccessHint(true);
      window.setTimeout(() => setSuccessHint(false), 4000);
    } catch {
      trackPlannerEditFailed({
        sessionId,
        destination,
        sourceProductId,
        instructionLength: trimmed.length,
        status,
      });
      setError("일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }, [
    destination,
    instruction,
    onPlanUpdated,
    sessionId,
    sourceProductId,
    status,
    submitting,
  ]);

  return (
    <>
      <div className="space-y-2">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={submitting}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          AI로 일정 수정하기
        </Button>
        {successHint ? (
          <p className="type-small text-[var(--text-secondary)]" role="status">
            요청하신 내용으로 일정을 수정했어요.
          </p>
        ) : null}
      </div>

      {submitting ? (
        <div className="fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-[1px]">
          <PlannerGenerationView destination={destination} mode="edit" />
        </div>
      ) : null}

      <Modal
        isOpen={open && !submitting}
        onClose={() => {
          if (!submitting) setOpen(false);
        }}
        aria-label="AI로 일정 수정"
        className="w-full max-w-md space-y-4"
      >
        <div className="space-y-2">
          <h2 className="type-h3 text-[var(--foreground)]">어떻게 바꿔드릴까요?</h2>
          <p className="type-caption text-[var(--text-muted)]">
            목적지와 여행 날짜 변경은 새 플랜에서 진행해 주세요.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESET_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              className="rounded-full border border-[var(--border)] px-3 py-1 type-caption text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              onClick={() => setInstruction(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="예: 2일차 유니버설은 빼고 온천을 넣어주세요."
          className="w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 type-small text-[var(--foreground)] placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          disabled={submitting}
        />

        {error ? (
          <p className="type-small text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => setOpen(false)}
          >
            취소
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={submitting}
            disabled={instruction.trim().length < 2 || submitting}
            onClick={() => void submit()}
          >
            일정 수정하기
          </Button>
        </div>
      </Modal>
    </>
  );
}
