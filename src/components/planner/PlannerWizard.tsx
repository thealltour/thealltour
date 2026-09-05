"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import AlertCard from "@/components/ui/AlertCard";
import { Button } from "@/components/ui/Button";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { FilterChip } from "@/components/ui/FilterChip";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PlannerWizardProgress } from "@/components/planner/PlannerWizardProgress";
import { TravelerCounter } from "@/components/planner/TravelerCounter";
import { dateToYmd } from "@/lib/datePickerUtils";
import { getOrCreatePlannerAnonymousKey } from "@/lib/planner/anonymousKey";
import {
  PLANNER_BUDGET_SCOPE_OPTIONS,
  PLANNER_COMPANION_OPTIONS,
  PLANNER_INTEREST_OPTIONS,
  PLANNER_PACE_OPTIONS,
  PLANNER_WIZARD_STEP_COUNT,
  PLANNER_WIZARD_TITLES,
  createEmptyPlannerDraftInput,
} from "@/lib/planner/constants";
import { validatePlannerStep } from "@/lib/planner/schemas";
import {
  trackPlannerInputCompleted,
  trackPlannerLandingView,
  trackPlannerStarted,
} from "@/lib/analytics/trackPlannerEvents";
import type {
  PlannerCompanionType,
  PlannerDraftInput,
  PlannerInterest,
  PlannerPace,
  PlannerWizardStep,
} from "@/types/planner";
import { cn } from "@/lib/cn";

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

export function PlannerWizard() {
  const searchParams = useSearchParams();
  const sourceProductIdRaw = searchParams.get("sourceProductId");
  const sourceProductId =
    sourceProductIdRaw && /^[0-9a-f-]{36}$/i.test(sourceProductIdRaw.trim())
      ? sourceProductIdRaw.trim()
      : null;

  const destinationId = useId();
  const budgetId = useId();
  const requestId = useId();

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
  const [completed, setCompleted] = useState(false);
  const [budgetUndecided, setBudgetUndecided] = useState(true);
  const [isPending, startTransition] = useTransition();

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
        setStep(2);
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
      setStep((prev) => Math.min(PLANNER_WIZARD_STEP_COUNT, prev + 1) as PlannerWizardStep);
    });
  }

  function handleBack() {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1) as PlannerWizardStep);
  }

  function handleFinalize() {
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
      setCompleted(true);
    });
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

  if (completed) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8 sm:px-0 sm:py-12">
        <AlertCard variant="info" title="여행 조건이 저장되었습니다">
          <p className="type-body text-[var(--text-secondary)]">
            여행 플랜 생성 기능은 다음 단계에서 연결됩니다.
          </p>
        </AlertCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 pb-28 pt-6 sm:px-0 sm:pb-12 sm:pt-10">
      {step === 1 ? (
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
        <form onSubmit={handleStart} className="space-y-4" noValidate>
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
          <Button type="submit" variant="primary" size="lg" className="w-full" loading={isPending}>
            여행 계획 시작하기
          </Button>
        </form>
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <DateRangePicker
            from={draft.dates.startDate}
            to={draft.dates.endDate}
            min={todayYmd}
            onChange={(from, to) => patchDraft({ dates: { startDate: from, endDate: to } })}
            placeholder="출발일 ~ 귀국일"
            aria-label="여행 기간"
            disabled={isPending}
          />
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
        <div className="flex flex-wrap gap-2" role="group" aria-label="여행 취향">
          {PLANNER_INTEREST_OPTIONS.map((opt) => {
            const selected = draft.interests.includes(opt.value);
            return (
              <FilterChip
                key={opt.value}
                variant={selected ? "selected" : "default"}
                aria-pressed={selected}
                disabled={isPending}
                onClick={() => toggleInterest(opt.value)}
              >
                {opt.label}
              </FilterChip>
            );
          })}
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
            <div className="flex flex-wrap gap-2" role="group" aria-label="예산 기준">
              {PLANNER_BUDGET_SCOPE_OPTIONS.map((opt) => {
                const selected = draft.budget.scope === opt.value;
                return (
                  <FilterChip
                    key={opt.value}
                    variant={selected ? "selected" : "default"}
                    aria-pressed={selected}
                    disabled={isPending || budgetUndecided}
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
            <FormField id={budgetId} label="예산 (원)" helper="선택 사항입니다.">
              <Input
                id={budgetId}
                inputMode="numeric"
                value={formatWonDisplay(draft.budget.amount)}
                disabled={isPending || budgetUndecided}
                placeholder="예: 1,500,000"
                onChange={(ev) => {
                  const amount = parseWonInput(ev.target.value);
                  setBudgetUndecided(false);
                  patchDraft({
                    budget: { ...draft.budget, amount, currency: "KRW" },
                  });
                }}
              />
            </FormField>
            <FilterChip
              variant={budgetUndecided ? "selected" : "default"}
              aria-pressed={budgetUndecided}
              disabled={isPending}
              onClick={() => {
                setBudgetUndecided(true);
                patchDraft({
                  budget: { ...draft.budget, amount: null, currency: "KRW" },
                });
              }}
            >
              아직 정하지 않았어요
            </FilterChip>
          </div>
        </div>
      ) : null}

      {step === 6 ? (
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
      ) : null}

      {step === 7 ? (
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <SummaryRow label="목적지" value={draft.destination.text} />
          <SummaryRow
            label="기간"
            value={`${draft.dates.startDate} ~ ${draft.dates.endDate}`}
          />
          <SummaryRow
            label="인원"
            value={`성인 ${draft.travelers.adults} · 아이 ${draft.travelers.children}`}
          />
          <SummaryRow label="동행" value={companionLabel(draft.companionType)} />
          <SummaryRow label="취향" value={interestLabels(draft.interests)} />
          <SummaryRow label="속도" value={paceLabel(draft.pace)} />
          <SummaryRow
            label="예산"
            value={
              draft.budget.amount == null
                ? "미정"
                : `${formatWonDisplay(draft.budget.amount)}원 (${
                    draft.budget.scope === "per_person" ? "1인" : "전체"
                  })`
            }
          />
          <SummaryRow
            label="요청"
            value={draft.additionalRequest.trim() || "없음"}
          />
        </div>
      ) : null}

      {step > 1 ? (
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
              disabled={isPending || step <= 2}
              onClick={handleBack}
            >
              이전
            </Button>
            {step < 7 ? (
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="flex-[2]"
                loading={isPending}
                onClick={handleNext}
              >
                다음
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="flex-[2]"
                loading={isPending}
                onClick={handleFinalize}
              >
                이 조건으로 여행 플랜 만들기
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 type-small">
      <dt className="w-14 shrink-0 font-medium text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}
