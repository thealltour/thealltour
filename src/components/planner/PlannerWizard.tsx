"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Camera,
  Coffee,
  Landmark,
  MoonStar,
  ShoppingBag,
  Trees,
  Utensils,
  Waves,
} from "lucide-react";
import AlertCard from "@/components/ui/AlertCard";
import { Button } from "@/components/ui/Button";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { FilterChip } from "@/components/ui/FilterChip";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PlannerGenerationView } from "@/components/planner/PlannerGenerationView";
import { PlannerWizardProgress } from "@/components/planner/PlannerWizardProgress";
import { TravelerCounter } from "@/components/planner/TravelerCounter";
import { dateToYmd } from "@/lib/datePickerUtils";
import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";
import {
  appendPlannerQuickRequest,
  createEmptyPlannerDraftInput,
  PLANNER_BUDGET_SCOPE_OPTIONS,
  PLANNER_BUDGET_SLIDER_MAX,
  PLANNER_BUDGET_SLIDER_MIN,
  PLANNER_BUDGET_SLIDER_STEP,
  PLANNER_BUDGET_STYLE_OPTIONS,
  PLANNER_COMPANION_OPTIONS,
  PLANNER_DURATION_DAYS_MAX,
  PLANNER_DURATION_DAYS_MIN,
  PLANNER_DURATION_QUICK_OPTIONS,
  PLANNER_INTEREST_OPTIONS,
  PLANNER_PACE_OPTIONS,
  PLANNER_POPULAR_DESTINATIONS,
  PLANNER_QUICK_REQUESTS,
  PLANNER_WIZARD_STEP_COUNT,
  PLANNER_WIZARD_TITLES,
} from "@/lib/planner/constants";
import {
  computeDurationDays,
  formatPlannerDatesSummary,
} from "@/lib/planner/dates";
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
  PlannerBudgetStyle,
  PlannerCompanionType,
  PlannerDraftInput,
  PlannerInterest,
  PlannerPace,
  PlannerSummaryEditSection,
  PlannerWizardStep,
} from "@/types/planner";
import { cn } from "@/lib/cn";

const INTEREST_ICONS: Record<
  PlannerInterest,
  ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  food: Utensils,
  sightseeing: Camera,
  shopping: ShoppingBag,
  relaxation: Coffee,
  nature: Trees,
  culture: Landmark,
  activity: Waves,
  night_view: MoonStar,
};

function formatWonDisplay(amount: number | null): string {
  if (amount == null) return "";
  return new Intl.NumberFormat("ko-KR").format(amount);
}

function parseWonInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

function companionLabel(value: PlannerCompanionType): string {
  return PLANNER_COMPANION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function interestLabels(values: PlannerInterest[]): string {
  return values
    .map((v) => PLANNER_INTEREST_OPTIONS.find((o) => o.value === v)?.label ?? v)
    .join(", ");
}

function paceLabel(value: PlannerPace): string {
  return PLANNER_PACE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

function budgetSummary(draft: PlannerDraftInput): string {
  const styleLabel =
    draft.budget.style == null
      ? null
      : PLANNER_BUDGET_STYLE_OPTIONS.find((o) => o.value === draft.budget.style)?.label;
  const amountLabel =
    draft.budget.amount == null
      ? null
      : `${formatWonDisplay(draft.budget.amount)}원 (${
          draft.budget.scope === "per_person" ? "1인" : "전체"
        })`;
  if (!styleLabel && !amountLabel) return "미정";
  return [styleLabel, amountLabel].filter(Boolean).join(" · ");
}

function summarySectionToStep(section: PlannerSummaryEditSection): PlannerWizardStep {
  switch (section) {
    case "destination":
      return 1;
    case "dates":
      return 2;
    case "companions":
      return 3;
    case "themes":
      return 4;
    case "budget":
      return 5;
    case "request":
      return 6;
  }
}

type BudgetUiMode = "undecided" | PlannerBudgetStyle | "custom";

export function PlannerWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceProductIdRaw = searchParams.get("sourceProductId");
  const sourceProductId =
    sourceProductIdRaw && /^[0-9a-f-]{36}$/i.test(sourceProductIdRaw.trim())
      ? sourceProductIdRaw.trim()
      : null;

  const destinationId = useId();
  const budgetId = useId();
  const budgetSliderId = useId();
  const requestId = useId();
  const themeRequestId = useId();
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

  useEffect(() => {
    trackPlannerLandingView();
  }, []);

  function patchDraft(patch: Partial<PlannerDraftInput>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  async function persistDraft(nextDraft: PlannerDraftInput, finalize = false): Promise<boolean> {
    if (!sessionId || !anonymousKey) return false;
    const res = await fetch(`/api/planner/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousKey,
        input: nextDraft,
        finalize,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.");
      return false;
    }
    return true;
  }

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const stepError = validatePlannerStep(1, draft);
    if (stepError) {
      setError(stepError);
      return;
    }

    startTransition(async () => {
      try {
        const key = anonymousKey || getOrCreatePlannerAnonymousKey();

        const res = await fetch("/api/planner/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            anonymousKey: key,
            destination: draft.destination.text,
            sourceProductId,
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          session?: {
            id: string;
            destination?: string;
            sourceProductId?: string | null;
            input?: PlannerDraftInput;
          };
        } | null;

        if (!res.ok || !data?.session?.id) {
          setError(data?.message ?? "여행을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.");
          return;
        }

        const nextDraft = data.session.input ?? {
          ...draft,
          destination: { text: data.session.destination ?? draft.destination.text },
        };
        setDraft(nextDraft);
        setSessionId(data.session.id);
        setResolvedSourceProductId(data.session.sourceProductId ?? sourceProductId);
        trackPlannerStarted({
          sessionId: data.session.id,
          destination: nextDraft.destination.text,
          sourceProductId: data.session.sourceProductId ?? sourceProductId,
        });
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
    trackPlannerGenerationStarted({
      sessionId: activeSessionId,
      input: activeDraft,
      sourceProductId: resolvedSourceProductId,
    });
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
        trackPlannerGenerationFailed({
          sessionId: activeSessionId,
          input: activeDraft,
          sourceProductId: resolvedSourceProductId,
          failureCategory:
            data?.failureCategory ??
            (!res.ok ? undefined : "result_navigation_failed"),
        });
        setError(
          data?.message ??
            "여행 플랜을 만드는 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.",
        );
        setPhase("failed");
        return;
      }

      const days = data.session.plan.days ?? [];
      const totalItemCount = days.reduce((sum, d) => sum + (d.items?.length ?? 0), 0);
      trackPlannerPlanGenerated({
        sessionId: activeSessionId,
        input: activeDraft,
        sourceProductId: resolvedSourceProductId,
        dayCount: days.length,
        totalItemCount,
      });
      router.push(`/planner/${encodeURIComponent(activeSessionId)}`);
    } catch {
      trackPlannerGenerationFailed({
        sessionId: activeSessionId,
        input: activeDraft,
        sourceProductId: resolvedSourceProductId,
        failureCategory: "result_navigation_failed",
      });
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
      trackPlannerInputCompleted({
        sessionId,
        input: draft,
        sourceProductId: resolvedSourceProductId,
      });
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
    if (sessionId) {
      trackPlannerSummaryEditClicked({ sessionId, section });
    }
    setEditingFromSummary(true);
    setError(null);
    setStep(summarySectionToStep(section));
  }

  function toggleInterest(value: PlannerInterest) {
    setDraft((prev) => {
      const has = prev.interests.includes(value);
      return {
        ...prev,
        interests: has ? prev.interests.filter((i) => i !== value) : [...prev.interests, value],
      };
    });
  }

  function setDateMode(mode: "fixed" | "flexible") {
    setDraft((prev) => {
      if (mode === "flexible") {
        return {
          ...prev,
          dates: {
            mode: "flexible",
            startDate: null,
            endDate: null,
            durationDays: Math.min(
              PLANNER_DURATION_DAYS_MAX,
              Math.max(PLANNER_DURATION_DAYS_MIN, prev.dates.durationDays || 3),
            ),
          },
        };
      }
      return {
        ...prev,
        dates: {
          mode: "fixed",
          startDate: prev.dates.startDate,
          endDate: prev.dates.endDate,
          durationDays: prev.dates.durationDays || 3,
        },
      };
    });
    setCustomDurationOpen(false);
  }

  function applyFixedRange(from: string, to: string) {
    const duration = computeDurationDays(from || null, to || null);
    patchDraft({
      dates: {
        mode: "fixed",
        startDate: from || null,
        endDate: to || null,
        durationDays: duration ?? (draft.dates.durationDays || 3),
      },
    });
  }

  function setBudgetMode(mode: BudgetUiMode) {
    setBudgetUiMode(mode);
    if (mode === "undecided") {
      patchDraft({
        budget: { ...draft.budget, style: null, amount: null, currency: "KRW" },
      });
      return;
    }
    if (mode === "custom") {
      patchDraft({
        budget: {
          ...draft.budget,
          style: null,
          amount: draft.budget.amount ?? PLANNER_BUDGET_SLIDER_MIN,
          currency: "KRW",
        },
      });
      return;
    }
    patchDraft({
      budget: { ...draft.budget, style: mode, amount: null, currency: "KRW" },
    });
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
      ? "다음"
      : "이제 내 여행 플랜 만들기";

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 pb-28 pt-6 sm:px-0 sm:pb-12 sm:pt-10">
      {step === 1 && !editingFromSummary ? (
        <header className="space-y-3 text-center sm:text-left">
          <h1 className="heading-display type-h1 text-[var(--foreground)]">
            여행은 자유롭게.
            <br />
            준비까지 힘들 필요는 없으니까.
          </h1>
          <p className="type-body leading-relaxed text-[var(--text-muted)]">
            가고 싶은 곳과 여행 조건을 알려주시면 더올투어가 자유여행 계획을 함께
            만들어드립니다.
          </p>
        </header>
      ) : (
        <header className="space-y-3">
          <PlannerWizardProgress step={step} />
          <h1 className="heading-display type-h2 text-[var(--foreground)]">
            {PLANNER_WIZARD_TITLES[step]}
          </h1>
        </header>
      )}

      {error ? (
        <p className="type-caption text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <form
          onSubmit={(e) => {
            if (sessionId && editingFromSummary) {
              e.preventDefault();
              handleNext();
              return;
            }
            if (sessionId) {
              e.preventDefault();
              handleNext();
              return;
            }
            handleStart(e);
          }}
          className="space-y-4"
          noValidate
        >
          <FormField
            id={destinationId}
            label={PLANNER_WIZARD_TITLES[1]}
            required
            error={error ?? undefined}
          >
            <Input
              id={destinationId}
              name="destination"
              value={draft.destination.text}
              onChange={(ev) => {
                patchDraft({ destination: { text: ev.target.value } });
                if (error) setError(null);
              }}
              placeholder="오사카, 다낭, 파리..."
              autoComplete="off"
              maxLength={120}
              error={Boolean(error)}
              disabled={isPending}
            />
          </FormField>
          <div className="space-y-2">
            <p className="type-small font-medium text-[var(--text-secondary)]">인기 여행지</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="인기 여행지">
              {PLANNER_POPULAR_DESTINATIONS.map((dest) => {
                const selected = draft.destination.text === dest.label;
                return (
                  <FilterChip
                    key={dest.label}
                    variant={selected ? "selected" : "default"}
                    aria-pressed={selected}
                    disabled={isPending}
                    onClick={() => patchDraft({ destination: { text: dest.label } })}
                  >
                    <span aria-hidden="true">{dest.emoji}</span> {dest.label}
                  </FilterChip>
                );
              })}
            </div>
          </div>
          {!sessionId ? (
            <Button type="submit" variant="primary" size="lg" className="w-full" loading={isPending}>
              여행 계획 시작하기
            </Button>
          ) : null}
        </form>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="날짜 확정 여부">
            <FilterChip
              variant={draft.dates.mode === "fixed" ? "selected" : "default"}
              aria-pressed={draft.dates.mode === "fixed"}
              disabled={isPending}
              onClick={() => setDateMode("fixed")}
            >
              날짜를 정했어요
            </FilterChip>
            <FilterChip
              variant={draft.dates.mode === "flexible" ? "selected" : "default"}
              aria-pressed={draft.dates.mode === "flexible"}
              disabled={isPending}
              onClick={() => setDateMode("flexible")}
            >
              아직 날짜를 정하지 않았어요
            </FilterChip>
          </div>

          {draft.dates.mode === "fixed" ? (
            <div className="space-y-2">
              <DateRangePicker
                from={draft.dates.startDate ?? ""}
                to={draft.dates.endDate ?? ""}
                min={todayYmd}
                keepOpenAfterStart
                onChange={applyFixedRange}
                placeholder="출발일 ~ 귀국일"
                aria-label="여행 기간"
                disabled={isPending}
              />
              {draft.dates.startDate && draft.dates.endDate ? (
                <p className="type-small text-[var(--text-secondary)]">
                  {formatPlannerDatesSummary(draft.dates)}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="type-small font-medium text-[var(--text-secondary)]">
                몇 일 정도 여행하시나요?
              </p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="여행 일수">
                {PLANNER_DURATION_QUICK_OPTIONS.map((days) => {
                  const selected =
                    draft.dates.durationDays === days && !customDurationOpen;
                  return (
                    <FilterChip
                      key={days}
                      variant={selected ? "selected" : "default"}
                      aria-pressed={selected}
                      disabled={isPending}
                      onClick={() => {
                        setCustomDurationOpen(false);
                        patchDraft({
                          dates: {
                            mode: "flexible",
                            startDate: null,
                            endDate: null,
                            durationDays: days,
                          },
                        });
                      }}
                    >
                      {days}일
                    </FilterChip>
                  );
                })}
                <FilterChip
                  variant={
                    customDurationOpen || draft.dates.durationDays > 7 ? "selected" : "default"
                  }
                  aria-pressed={customDurationOpen || draft.dates.durationDays > 7}
                  disabled={isPending}
                  onClick={() => setCustomDurationOpen(true)}
                >
                  8일 이상
                </FilterChip>
              </div>
              {customDurationOpen || draft.dates.durationDays > 7 ? (
                <FormField
                  id={durationCustomId}
                  label="여행 일수"
                  helper={`${PLANNER_DURATION_DAYS_MIN}~${PLANNER_DURATION_DAYS_MAX}일`}
                >
                  <Input
                    id={durationCustomId}
                    inputMode="numeric"
                    value={String(draft.dates.durationDays)}
                    disabled={isPending}
                    onChange={(ev) => {
                      const n = Number(ev.target.value.replace(/[^\d]/g, ""));
                      if (!Number.isFinite(n)) return;
                      patchDraft({
                        dates: {
                          mode: "flexible",
                          startDate: null,
                          endDate: null,
                          durationDays: Math.min(
                            PLANNER_DURATION_DAYS_MAX,
                            Math.max(PLANNER_DURATION_DAYS_MIN, n),
                          ),
                        },
                      });
                    }}
                  />
                </FormField>
              ) : null}
              <p className="type-small text-[var(--text-secondary)]">
                {formatPlannerDatesSummary(draft.dates)}
              </p>
            </div>
          )}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-4">
          <TravelerCounter
            label="성인"
            value={draft.travelers.adults}
            min={1}
            max={20}
            disabled={isPending}
            onChange={(adults) =>
              patchDraft({ travelers: { ...draft.travelers, adults } })
            }
          />
          <TravelerCounter
            label="아이"
            value={draft.travelers.children}
            min={0}
            max={20}
            disabled={isPending}
            onChange={(children) =>
              patchDraft({ travelers: { ...draft.travelers, children } })
            }
          />
          <div>
            <p className="mb-2 type-small font-medium text-[var(--text-secondary)]">동행 유형</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="동행 유형">
              {PLANNER_COMPANION_OPTIONS.map((opt) => {
                const selected = draft.companionType === opt.value;
                return (
                  <FilterChip
                    key={opt.value}
                    variant={selected ? "selected" : "default"}
                    aria-pressed={selected}
                    disabled={isPending}
                    onClick={() => patchDraft({ companionType: opt.value })}
                  >
                    {opt.label}
                  </FilterChip>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="여행 취향">
            {PLANNER_INTEREST_OPTIONS.map((opt) => {
              const selected = draft.interests.includes(opt.value);
              const Icon = INTEREST_ICONS[opt.value];
              return (
                <FilterChip
                  key={opt.value}
                  variant={selected ? "selected" : "default"}
                  aria-pressed={selected}
                  disabled={isPending}
                  onClick={() => toggleInterest(opt.value)}
                  className="gap-1.5"
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden={true} />
                  {opt.label}
                </FilterChip>
              );
            })}
          </div>
          <FormField
            id={themeRequestId}
            label="원하는 여행 분위기가 더 있나요?"
            helper="선택 사항입니다. 스타일·분위기 위주로 적어 주세요."
          >
            <Textarea
              id={themeRequestId}
              rows={3}
              maxLength={1000}
              value={draft.themeRequest}
              disabled={isPending}
              placeholder="예: 유명 관광지는 조금만 보고 현지 맛집 위주로 다니고 싶어요."
              onChange={(ev) => patchDraft({ themeRequest: ev.target.value })}
            />
          </FormField>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-5">
          <div className="space-y-2" role="radiogroup" aria-label="여행 속도">
            {PLANNER_PACE_OPTIONS.map((opt) => {
              const selected = draft.pace === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={isPending}
                  onClick={() => patchDraft({ pace: opt.value })}
                  className={cn(
                    "flex w-full flex-col items-start rounded-xl border px-4 py-3 text-left transition",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
                    selected
                      ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]",
                  )}
                >
                  <span className="type-body font-semibold text-[var(--foreground)]">{opt.label}</span>
                  <span className="type-caption text-[var(--text-muted)]">{opt.description}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <p className="type-small font-medium text-[var(--text-secondary)]">
              예산은 어느 정도 생각하고 계세요?
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="예산 스타일">
              {PLANNER_BUDGET_STYLE_OPTIONS.map((opt) => {
                const selected = budgetUiMode === opt.value;
                return (
                  <FilterChip
                    key={opt.value}
                    variant={selected ? "selected" : "default"}
                    aria-pressed={selected}
                    disabled={isPending}
                    onClick={() => setBudgetMode(opt.value)}
                  >
                    {opt.label}
                  </FilterChip>
                );
              })}
            </div>

            {budgetUiMode === "custom" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2" role="group" aria-label="예산 기준">
                  {PLANNER_BUDGET_SCOPE_OPTIONS.map((opt) => {
                    const selected = draft.budget.scope === opt.value;
                    return (
                      <FilterChip
                        key={opt.value}
                        variant={selected ? "selected" : "default"}
                        aria-pressed={selected}
                        disabled={isPending}
                        onClick={() =>
                          patchDraft({
                            budget: { ...draft.budget, scope: opt.value, currency: "KRW" },
                          })
                        }
                      >
                        {opt.label}
                      </FilterChip>
                    );
                  })}
                </div>
                <FormField id={budgetId} label="예산 (원)" helper="숫자 입력과 슬라이더가 함께 반영됩니다.">
                  <Input
                    id={budgetId}
                    inputMode="numeric"
                    value={formatWonDisplay(draft.budget.amount)}
                    disabled={isPending}
                    placeholder="예: 1,500,000"
                    onChange={(ev) => {
                      const amount = parseWonInput(ev.target.value);
                      patchDraft({
                        budget: { ...draft.budget, style: null, amount, currency: "KRW" },
                      });
                    }}
                  />
                </FormField>
                <div className="space-y-1">
                  <label
                    htmlFor={budgetSliderId}
                    className="type-caption text-[var(--text-muted)]"
                  >
                    예산 슬라이더
                  </label>
                  <input
                    id={budgetSliderId}
                    type="range"
                    min={PLANNER_BUDGET_SLIDER_MIN}
                    max={PLANNER_BUDGET_SLIDER_MAX}
                    step={PLANNER_BUDGET_SLIDER_STEP}
                    value={Math.min(
                      PLANNER_BUDGET_SLIDER_MAX,
                      Math.max(
                        PLANNER_BUDGET_SLIDER_MIN,
                        draft.budget.amount ?? PLANNER_BUDGET_SLIDER_MIN,
                      ),
                    )}
                    disabled={isPending}
                    onChange={(ev) => {
                      const amount = Number(ev.target.value);
                      patchDraft({
                        budget: {
                          ...draft.budget,
                          style: null,
                          amount: Number.isFinite(amount) ? amount : null,
                          currency: "KRW",
                        },
                      });
                    }}
                    className="w-full accent-[var(--primary)]"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 6 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="빠른 요청">
            {PLANNER_QUICK_REQUESTS.map((chip) => {
              const inserted = draft.additionalRequest.includes(chip.insertText);
              return (
                <FilterChip
                  key={chip.id}
                  variant={inserted ? "selected" : "default"}
                  aria-pressed={inserted}
                  disabled={isPending}
                  onClick={() =>
                    patchDraft({
                      additionalRequest: appendPlannerQuickRequest(
                        draft.additionalRequest,
                        chip.insertText,
                      ),
                    })
                  }
                >
                  {chip.label}
                </FilterChip>
              );
            })}
          </div>
          <FormField id={requestId} label="자유 요청사항" helper="최대 1000자">
            <Textarea
              id={requestId}
              rows={5}
              maxLength={1000}
              value={draft.additionalRequest}
              disabled={isPending}
              placeholder={
                "부모님이 많이 걷는 건 힘들어하세요.\n숙소는 좋은 곳이면 좋겠어요."
              }
              onChange={(ev) => patchDraft({ additionalRequest: ev.target.value })}
            />
          </FormField>
        </div>
      ) : null}

      {step === 7 ? (
        <div className="space-y-4">
          <p className="type-small leading-relaxed text-[var(--text-muted)]">
            준비는 여기까지. 이제 일정은 더올투어가 만들어드릴게요.
          </p>
          <dl className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <SummaryEditRow
              label="여행지"
              value={draft.destination.text}
              onEdit={() => openSummaryEdit("destination")}
              disabled={isPending}
            />
            <SummaryEditRow
              label="여행일"
              value={formatPlannerDatesSummary(draft.dates)}
              onEdit={() => openSummaryEdit("dates")}
              disabled={isPending}
            />
            <SummaryEditRow
              label="동행"
              value={`성인 ${draft.travelers.adults} · 아이 ${draft.travelers.children} · ${companionLabel(draft.companionType)}`}
              onEdit={() => openSummaryEdit("companions")}
              disabled={isPending}
            />
            <SummaryEditRow
              label="여행테마"
              value={[
                interestLabels(draft.interests),
                draft.themeRequest.trim() || null,
              ]
                .filter(Boolean)
                .join(" · ")}
              onEdit={() => openSummaryEdit("themes")}
              disabled={isPending}
            />
            <SummaryEditRow
              label="속도/예산"
              value={`${paceLabel(draft.pace)} · ${budgetSummary(draft)}`}
              onEdit={() => openSummaryEdit("budget")}
              disabled={isPending}
            />
            <SummaryEditRow
              label="추가 요청"
              value={draft.additionalRequest.trim() || "없음"}
              onEdit={() => openSummaryEdit("request")}
              disabled={isPending}
            />
          </dl>
        </div>
      ) : null}

      {step > 1 || (step === 1 && sessionId) ? (
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
              disabled={isPending || (step <= 2 && !editingFromSummary && !sessionId)}
              onClick={handleBack}
            >
              {editingFromSummary ? "취소" : "이전"}
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-[2]"
              loading={isPending}
              disabled={isPending}
              onClick={() => {
                if (step === 1 && !sessionId) return;
                if (step < 7 || editingFromSummary) {
                  if (step === 1 && sessionId) {
                    handleNext();
                    return;
                  }
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
      ) : null}
    </div>
  );
}

function SummaryEditRow({
  label,
  value,
  onEdit,
  disabled,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-3 type-small">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <dt className="font-medium text-[var(--text-muted)]">{label}</dt>
          <button
            type="button"
            className="shrink-0 type-caption font-semibold text-[var(--primary)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
            onClick={onEdit}
            disabled={disabled}
            aria-label={`${label} 수정`}
          >
            수정
          </button>
        </div>
        <dd className="mt-1 whitespace-pre-wrap break-words text-[var(--foreground)]">{value}</dd>
      </div>
    </div>
  );
}
