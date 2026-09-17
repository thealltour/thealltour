"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AlertCard from "@/components/ui/AlertCard";
import { Button } from "@/components/ui/Button";
import { PlannerConversationShell } from "@/components/planner/conversation/PlannerConversationShell";
import {
  budgetUiModeFromDraft,
  PlannerConversationStep1,
  PlannerConversationStep2,
  PlannerConversationStep3,
  PlannerConversationStep4,
  PlannerConversationStep5,
  PlannerConversationStep6,
  PlannerConversationSummary,
  summarySectionToStep,
  type BudgetUiMode,
} from "@/components/planner/conversation/PlannerConversationSteps";
import { PlannerGenerationView } from "@/components/planner/PlannerGenerationView";
import { PlannerQaPanel } from "@/components/planner/PlannerQaPanel";
import { dateToYmd } from "@/lib/datePickerUtils";
import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";
import {
  createEmptyPlannerDraftInput,
  PLANNER_WIZARD_STEP_COUNT,
} from "@/lib/planner/constants";
import {
  getPlannerQaPreset,
  type PlannerQaPresetId,
} from "@/lib/planner/qaPresets";
import { canArriveAtPlannerStep } from "@/lib/planner/qaStepSafety";
import { validatePlannerStep } from "@/lib/planner/schemas";
import {
  trackPlannerGenerationFailed,
  trackPlannerGenerationStarted,
  trackPlannerInputCompleted,
  trackPlannerLandingView,
  trackPlannerPlanGenerated,
  trackPlannerStarted,
  trackPlannerSummaryEditClicked,
} from "@/lib/analytics/trackPlannerEvents";
import type {
  PlannerDraftInput,
  PlannerSummaryEditSection,
  PlannerWizardStep,
} from "@/types/planner";
import { cn } from "@/lib/cn";

export function PlannerWizard({ qaEnabled = false }: { qaEnabled?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceProductIdRaw = searchParams.get("sourceProductId");
  const sourceProductId =
    sourceProductIdRaw && /^[0-9a-f-]{36}$/i.test(sourceProductIdRaw.trim())
      ? sourceProductIdRaw.trim()
      : null;
  const showQaPanel = qaEnabled && searchParams.get("qa") === "1";

  const originId = useId();
  const destinationId = useId();
  const budgetId = useId();
  const budgetSliderId = useId();
  const requestId = useId();
  const durationCustomId = useId();

  const todayYmd = useMemo(() => dateToYmd(new Date()), []);

  const [step, setStep] = useState<PlannerWizardStep>(1);
  const [draft, setDraft] = useState<PlannerDraftInput>(() => createEmptyPlannerDraftInput());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [anonymousKey] = useState(() =>
    typeof window === "undefined" ? "" : getOrCreatePlannerAnonymousKey(),
  );
  const [resolvedSourceProductId, setResolvedSourceProductId] = useState<string | null>(
    sourceProductId,
  );
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"wizard" | "generating" | "failed">("wizard");
  const [budgetUiMode, setBudgetUiMode] = useState<BudgetUiMode>("undecided");
  const [editingFromSummary, setEditingFromSummary] = useState(false);
  const [customDurationOpen, setCustomDurationOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const generateLockRef = useRef(false);
  const [qaPresetId, setQaPresetId] = useState<PlannerQaPresetId>("osaka-fixed");
  const [qaError, setQaError] = useState<string | null>(null);
  const [qaBusy, setQaBusy] = useState(false);

  useEffect(() => {
    if (showQaPanel) return;
    trackPlannerLandingView();
  }, [showQaPanel]);

  function patchDraft(patch: Partial<PlannerDraftInput>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function applyDraftLocal(nextDraft: PlannerDraftInput) {
    setDraft(nextDraft);
    setBudgetUiMode(budgetUiModeFromDraft(nextDraft));
    setCustomDurationOpen(
      nextDraft.dates.mode === "flexible" && nextDraft.dates.durationDays > 7,
    );
    setEditingFromSummary(false);
  }

  async function persistDraftToSession(
    activeSessionId: string,
    nextDraft: PlannerDraftInput,
    finalize = false,
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    const key = anonymousKey || getOrCreatePlannerAnonymousKey();
    const res = await fetch(`/api/planner/sessions/${encodeURIComponent(activeSessionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousKey: key,
        input: nextDraft,
        finalize,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      return {
        ok: false,
        message: data?.message ?? "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      };
    }
    return { ok: true };
  }

  async function persistDraft(nextDraft: PlannerDraftInput, finalize = false): Promise<boolean> {
    if (!sessionId || !anonymousKey) return false;
    const result = await persistDraftToSession(sessionId, nextDraft, finalize);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    return true;
  }

  async function createSessionWithDraft(
    nextDraft: PlannerDraftInput,
  ): Promise<{ id: string; draft: PlannerDraftInput } | { error: string }> {
    const key = anonymousKey || getOrCreatePlannerAnonymousKey();
    const res = await fetch("/api/planner/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousKey: key,
        origin: nextDraft.origin.text,
        destination: nextDraft.destination.text,
        sourceProductId,
      }),
    });
    const data = (await res.json().catch(() => null)) as {
      message?: string;
      session?: {
        id: string;
        origin?: string;
        destination?: string;
        sourceProductId?: string | null;
        input?: PlannerDraftInput;
      };
    } | null;

    if (!res.ok || !data?.session?.id) {
      return {
        error: data?.message ?? "여행을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      };
    }

    const merged: PlannerDraftInput = {
      ...nextDraft,
      origin: nextDraft.origin,
      destination: nextDraft.destination,
    };

    setSessionId(data.session.id);
    setResolvedSourceProductId(data.session.sourceProductId ?? sourceProductId);
    applyDraftLocal(merged);

    if (!showQaPanel) {
      trackPlannerStarted({
        sessionId: data.session.id,
        destination: merged.destination.text,
        sourceProductId: data.session.sourceProductId ?? sourceProductId,
      });
    }

    const patched = await persistDraftToSession(data.session.id, merged, false);
    if (!patched.ok) return { error: patched.message };
    return { id: data.session.id, draft: merged };
  }

  function handleStart() {
    setError(null);
    const stepError = validatePlannerStep(1, draft);
    if (stepError) {
      setError(stepError);
      return;
    }

    startTransition(async () => {
      try {
        const created = await createSessionWithDraft(draft);
        if ("error" in created) {
          setError(created.error);
          return;
        }
        if (editingFromSummary) {
          setEditingFromSummary(false);
          setStep(7);
        } else {
          setStep(2);
        }
      } catch {
        setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      }
    });
  }

  function handleNext() {
    setError(null);
    const stepError = validatePlannerStep(step, draft);
    if (stepError) {
      setError(stepError);
      return;
    }

    if (step === 1 && !sessionId) {
      handleStart();
      return;
    }

    startTransition(async () => {
      const ok = await persistDraft(draft, false);
      if (!ok) return;
      if (editingFromSummary) {
        setEditingFromSummary(false);
        setStep(7);
        return;
      }
      setStep((prev) => Math.min(PLANNER_WIZARD_STEP_COUNT, prev + 1) as PlannerWizardStep);
    });
  }

  function handleBack() {
    setError(null);
    if (editingFromSummary) {
      setEditingFromSummary(false);
      setStep(7);
      return;
    }
    setStep((prev) => Math.max(1, prev - 1) as PlannerWizardStep);
  }

  async function runGenerate(activeSessionId: string, activeDraft: PlannerDraftInput) {
    if (generateLockRef.current) return;
    generateLockRef.current = true;

    const key = anonymousKey || getOrCreatePlannerAnonymousKey();
    if (!showQaPanel) {
      trackPlannerGenerationStarted({
        sessionId: activeSessionId,
        input: activeDraft,
        sourceProductId: resolvedSourceProductId,
      });
    }
    setPhase("generating");
    setError(null);

    try {
      const res = await fetch(
        `/api/planner/sessions/${encodeURIComponent(activeSessionId)}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonymousKey: key }),
        },
      );
      const data = (await res.json().catch(() => null)) as {
        message?: string;
        failureCategory?: string;
        session?: { plan?: { days?: Array<{ items?: unknown[] }> } | null };
      } | null;

      if (!res.ok || !data?.session?.plan) {
        if (!showQaPanel) {
          trackPlannerGenerationFailed({
            sessionId: activeSessionId,
            input: activeDraft,
            sourceProductId: resolvedSourceProductId,
            failureCategory:
              data?.failureCategory ??
              (!res.ok ? undefined : "result_navigation_failed"),
          });
        }
        setError(
          data?.message ??
            "여행 플랜을 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        );
        setPhase("failed");
        return;
      }

      const days = data.session.plan.days ?? [];
      const totalItemCount = days.reduce((sum, d) => sum + (d.items?.length ?? 0), 0);
      if (!showQaPanel) {
        trackPlannerPlanGenerated({
          sessionId: activeSessionId,
          input: activeDraft,
          sourceProductId: resolvedSourceProductId,
          dayCount: days.length,
          totalItemCount,
        });
      }
      router.push(`/planner/${encodeURIComponent(activeSessionId)}`);
    } catch {
      if (!showQaPanel) {
        trackPlannerGenerationFailed({
          sessionId: activeSessionId,
          input: activeDraft,
          sourceProductId: resolvedSourceProductId,
          failureCategory: "result_navigation_failed",
        });
      }
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
      setPhase("failed");
    } finally {
      generateLockRef.current = false;
    }
  }

  function handleFinalize() {
    if (generateLockRef.current || isPending || phase === "generating") return;
    setError(null);
    const stepError = validatePlannerStep(7, draft);
    if (stepError) {
      setError(stepError);
      return;
    }

    startTransition(async () => {
      const ok = await persistDraft(draft, true);
      if (!ok || !sessionId) return;
      if (!showQaPanel) {
        trackPlannerInputCompleted({
          sessionId,
          input: draft,
          sourceProductId: resolvedSourceProductId,
        });
      }
      await runGenerate(sessionId, draft);
    });
  }

  function handleRetryGenerate() {
    if (!sessionId || generateLockRef.current) return;
    startTransition(async () => {
      await runGenerate(sessionId, draft);
    });
  }

  function openSummaryEdit(section: PlannerSummaryEditSection) {
    if (sessionId && !showQaPanel) {
      trackPlannerSummaryEditClicked({ sessionId, section });
    }
    setEditingFromSummary(true);
    setError(null);
    setStep(summarySectionToStep(section));
  }

  function openHistoryEdit(target: PlannerWizardStep) {
    const sectionMap: Record<1 | 2 | 3 | 4 | 5 | 6, PlannerSummaryEditSection> = {
      1: "destination",
      2: "dates",
      3: "companions",
      4: "themes",
      5: "budget",
      6: "request",
    };
    if (target >= 1 && target <= 6) {
      openSummaryEdit(sectionMap[target as 1 | 2 | 3 | 4 | 5 | 6]);
    }
  }

  async function ensureSessionForQaDraft(
    nextDraft: PlannerDraftInput,
  ): Promise<{ id: string; draft: PlannerDraftInput } | { error: string }> {
    if (sessionId) {
      const patched = await persistDraftToSession(sessionId, nextDraft, false);
      if (!patched.ok) {
        return { error: `QA draft 저장 실패: ${patched.message}` };
      }
      applyDraftLocal(nextDraft);
      return { id: sessionId, draft: nextDraft };
    }
    const created = await createSessionWithDraft(nextDraft);
    if ("error" in created) {
      return { error: `QA 세션 생성 실패: ${created.error}` };
    }
    return created;
  }

  function qaApplyPreset() {
    setQaError(null);
    const preset = getPlannerQaPreset(qaPresetId);
    applyDraftLocal(preset.draft);
    if (!sessionId) return;
    setQaBusy(true);
    startTransition(async () => {
      try {
        const patched = await persistDraftToSession(sessionId, preset.draft, false);
        if (!patched.ok) {
          setQaError(`QA draft 저장 실패: ${patched.message}`);
        }
      } catch {
        setQaError("QA draft 저장 실패: 네트워크 오류");
      } finally {
        setQaBusy(false);
      }
    });
  }

  function qaCreateSession() {
    setQaError(null);
    setQaBusy(true);
    const preset = getPlannerQaPreset(qaPresetId);
    startTransition(async () => {
      try {
        applyDraftLocal(preset.draft);
        const ensured = await ensureSessionForQaDraft(preset.draft);
        if ("error" in ensured) {
          setQaError(ensured.error);
          return;
        }
        setStep(1);
      } catch {
        setQaError("QA 세션 생성 실패: 네트워크 오류");
      } finally {
        setQaBusy(false);
      }
    });
  }

  function qaJumpToStep(target: PlannerWizardStep) {
    setQaError(null);
    setQaBusy(true);
    startTransition(async () => {
      try {
        let nextDraft = draft;
        if (!canArriveAtPlannerStep(nextDraft, target)) {
          nextDraft = getPlannerQaPreset(qaPresetId).draft;
          applyDraftLocal(nextDraft);
        }
        if (target > 1 || sessionId) {
          if (!canArriveAtPlannerStep(nextDraft, target)) {
            setQaError("QA step 이동 실패: preset draft가 target step 요건을 만족하지 않습니다.");
            return;
          }
          if (target > 1 && !sessionId) {
            const ensured = await ensureSessionForQaDraft(nextDraft);
            if ("error" in ensured) {
              setQaError(ensured.error);
              return;
            }
            nextDraft = ensured.draft;
          } else if (sessionId) {
            const patched = await persistDraftToSession(sessionId, nextDraft, false);
            if (!patched.ok) {
              setQaError(`QA draft 저장 실패: ${patched.message}`);
              return;
            }
          }
        }
        setEditingFromSummary(false);
        setPhase("wizard");
        setStep(target);
      } catch {
        setQaError("QA step 이동 실패: 네트워크 오류");
      } finally {
        setQaBusy(false);
      }
    });
  }

  function qaReadySummary() {
    setQaError(null);
    setQaBusy(true);
    const preset = getPlannerQaPreset(qaPresetId);
    startTransition(async () => {
      try {
        applyDraftLocal(preset.draft);
        if (!canArriveAtPlannerStep(preset.draft, 7)) {
          setQaError("QA 완성 직전 실패: preset이 step 7 valid가 아닙니다.");
          return;
        }
        const ensured = await ensureSessionForQaDraft(preset.draft);
        if ("error" in ensured) {
          setQaError(ensured.error);
          return;
        }
        setEditingFromSummary(false);
        setPhase("wizard");
        setStep(7);
      } catch {
        setQaError("QA 완성 직전 실패: 네트워크 오류");
      } finally {
        setQaBusy(false);
      }
    });
  }

  function qaGenerateNow() {
    if (generateLockRef.current) return;
    setQaError(null);
    setQaBusy(true);
    const preset = getPlannerQaPreset(qaPresetId);
    startTransition(async () => {
      try {
        applyDraftLocal(preset.draft);
        if (validatePlannerStep(7, preset.draft) != null) {
          setQaError("QA generate 실패: preset이 finalize valid가 아닙니다.");
          return;
        }
        const ensured = await ensureSessionForQaDraft(preset.draft);
        if ("error" in ensured) {
          setQaError(ensured.error);
          return;
        }
        const finalized = await persistDraftToSession(ensured.id, ensured.draft, true);
        if (!finalized.ok) {
          setQaError(`QA generate 실패: ${finalized.message}`);
          return;
        }
        await runGenerate(ensured.id, ensured.draft);
      } catch {
        setQaError("QA generate 실패: 네트워크 오류");
      } finally {
        setQaBusy(false);
      }
    });
  }

  function qaReset() {
    setQaError(null);
    setStep(1);
    applyDraftLocal(createEmptyPlannerDraftInput());
    setSessionId(null);
    setPhase("wizard");
    setError(null);
    setEditingFromSummary(false);
    setBudgetUiMode("undecided");
    setCustomDurationOpen(false);
    setResolvedSourceProductId(sourceProductId);
  }

  if (phase === "generating") {
    return <PlannerGenerationView destination={draft.destination.text} />;
  }

  if (phase === "failed") {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 px-4 py-10 sm:px-0">
        <AlertCard variant="warning" title="플랜 생성에 실패했습니다">
          <p className="type-body text-[var(--text-secondary)]">
            {error ??
              "여행 플랜을 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요."}
          </p>
        </AlertCard>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="w-full"
          loading={isPending}
          onClick={handleRetryGenerate}
        >
          다시 시도하기
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          disabled={isPending}
          onClick={() => {
            setPhase("wizard");
            setError(null);
            setStep(7);
            setEditingFromSummary(false);
          }}
        >
          여행 조건 수정하기
        </Button>
      </div>
    );
  }

  const primaryCtaLabel = editingFromSummary
    ? "수정 완료"
    : step < 7
      ? step === 4 || step === 6
        ? "선택 완료"
        : "다음"
      : "이 조건으로 여행 만들기";

  const showActions = step > 1 || Boolean(sessionId) || editingFromSummary;

  const stepBody =
    step === 1 ? (
      <PlannerConversationStep1
        draft={draft}
        disabled={isPending}
        patchDraft={patchDraft}
        onClearError={() => {
          if (error) setError(null);
        }}
        originId={originId}
        destinationId={destinationId}
      />
    ) : step === 2 ? (
      <PlannerConversationStep2
        draft={draft}
        disabled={isPending}
        patchDraft={patchDraft}
        todayYmd={todayYmd}
        customDurationOpen={customDurationOpen}
        setCustomDurationOpen={setCustomDurationOpen}
        durationCustomId={durationCustomId}
      />
    ) : step === 3 ? (
      <PlannerConversationStep3 draft={draft} disabled={isPending} patchDraft={patchDraft} />
    ) : step === 4 ? (
      <PlannerConversationStep4 draft={draft} disabled={isPending} patchDraft={patchDraft} />
    ) : step === 5 ? (
      <PlannerConversationStep5
        draft={draft}
        disabled={isPending}
        patchDraft={patchDraft}
        budgetUiMode={budgetUiMode}
        setBudgetUiMode={setBudgetUiMode}
        budgetId={budgetId}
        budgetSliderId={budgetSliderId}
      />
    ) : step === 6 ? (
      <PlannerConversationStep6
        draft={draft}
        disabled={isPending}
        patchDraft={patchDraft}
        requestId={requestId}
      />
    ) : (
      <PlannerConversationSummary
        draft={draft}
        disabled={isPending}
        onEditSection={openSummaryEdit}
      />
    );

  const actions = showActions ? (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur",
        "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none",
      )}
    >
      <div className="mx-auto flex w-full max-w-lg gap-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-w-24 flex-1 sm:flex-none"
          disabled={isPending || (step <= 1 && !editingFromSummary && !sessionId)}
          onClick={handleBack}
        >
          {editingFromSummary ? "취소" : "이전 질문"}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="flex-[2]"
          loading={isPending}
          disabled={isPending}
          onClick={() => {
            if (step < 7 || editingFromSummary) {
              handleNext();
              return;
            }
            handleFinalize();
          }}
        >
          {primaryCtaLabel}
        </Button>
      </div>
    </div>
  ) : step === 1 && !sessionId ? (
    <Button
      type="button"
      variant="primary"
      size="lg"
      className="w-full"
      loading={isPending}
      onClick={handleStart}
    >
      다음
    </Button>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 pb-28 pt-6 sm:px-0 sm:pb-12 sm:pt-10">
      {showQaPanel ? (
        <PlannerQaPanel
          step={step}
          sessionId={sessionId}
          phase={phase}
          draft={draft}
          presetId={qaPresetId}
          busy={qaBusy || isPending}
          error={qaError}
          onPresetIdChange={setQaPresetId}
          onApplyPreset={qaApplyPreset}
          onCreateSession={qaCreateSession}
          onJumpStep={qaJumpToStep}
          onReadySummary={qaReadySummary}
          onGenerate={qaGenerateNow}
          onReset={qaReset}
        />
      ) : null}

      <PlannerConversationShell
        step={step}
        draft={draft}
        editingFromSummary={editingFromSummary}
        disabled={isPending}
        error={error}
        onEditCompletedStep={openHistoryEdit}
        actions={actions}
      >
        {stepBody}
      </PlannerConversationShell>
    </div>
  );
}
