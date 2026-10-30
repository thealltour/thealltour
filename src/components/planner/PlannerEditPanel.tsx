"use client";

import { useCallback, useState } from "react";
import { Sparkles } from "lucide-react";
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

const AI_EDIT_QUOTA_COPY =
  "오늘의 AI 수정 횟수를 모두 사용했어요.\n직접 수정은 계속 사용할 수 있습니다.";

const AI_EDIT_IN_PROGRESS_COPY =
  "AI가 이미 이 플랜을 수정하고 있어요.\n현재 작업이 끝난 뒤 다시 시도해 주세요.";

type EditResponse = {
  message?: string;
  code?: string;
  session?: {
    plan: PlannerPlan | null;
    status: string;
    isSaved?: boolean;
    updatedAt?: string;
  };
};

export type PlannerPlanUpdatedPayload = {
  plan: PlannerPlan;
  updatedAt: string;
};

type PlannerEditPanelProps = {
  sessionId: string;
  destination: string;
  sourceProductId: string | null;
  status: "generated" | "saved";
  onPlanUpdated: (payload: PlannerPlanUpdatedPayload) => void;
  /** Enter Manual Edit mode (quota exhausted CTA). */
  onRequestManualEdit?: () => void;
  /** Tighter layout for Result action group (behavior unchanged). */
  compact?: boolean;
};

export function PlannerEditPanel({
  sessionId,
  destination,
  sourceProductId,
  status,
  onPlanUpdated,
  onRequestManualEdit,
  compact = false,
}: PlannerEditPanelProps) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [successHint, setSuccessHint] = useState(false);

  const submit = useCallback(async () => {
    const trimmed = instruction.trim();
    if (trimmed.length < 2 || submitting) return;

    setSubmitting(true);
    setError(null);
    setErrorCode(null);
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
        const code = typeof data?.code === "string" ? data.code : null;
        setErrorCode(code);
        if (code === "AI_EDIT_QUOTA_EXCEEDED") {
          setError(AI_EDIT_QUOTA_COPY);
        } else if (code === "AI_EDIT_ALREADY_IN_PROGRESS") {
          setError(AI_EDIT_IN_PROGRESS_COPY);
        } else {
          setError(data?.message ?? "일정을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        }
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
      onPlanUpdated({
        plan: data.session.plan,
        updatedAt: data.session.updatedAt ?? new Date().toISOString(),
      });
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
      setErrorCode(null);
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

  const quotaExceeded = errorCode === "AI_EDIT_QUOTA_EXCEEDED";
  const inProgressBlocked = errorCode === "AI_EDIT_ALREADY_IN_PROGRESS";

  return (
    <>
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={submitting}
          onClick={() => {
            setError(null);
            setErrorCode(null);
            setOpen(true);
          }}
        >
          <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
            {compact ? (
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden={true} />
            ) : null}
            {compact ? "AI로 수정" : "AI로 일정 수정하기"}
          </span>
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

        {!quotaExceeded ? (
          <>
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
          </>
        ) : null}

        {error ? (
          <p
            className="type-small whitespace-pre-line text-[var(--danger)]"
            role="alert"
            data-testid={
              quotaExceeded
                ? "planner-ai-edit-quota-exceeded"
                : inProgressBlocked
                  ? "planner-ai-edit-in-progress"
                  : "planner-ai-edit-error"
            }
          >
            {error}
          </p>
        ) : null}

        {quotaExceeded ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              내일 다시 이용하기
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setOpen(false);
                onRequestManualEdit?.();
              }}
            >
              직접 수정하기
            </Button>
          </div>
        ) : (
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
        )}
      </Modal>
    </>
  );
}
