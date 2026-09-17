"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { TravelerCounter } from "@/components/planner/TravelerCounter";
import { PlannerAssistantMessage } from "@/components/planner/conversation/PlannerAssistantMessage";
import { PlannerChoiceCard } from "@/components/planner/conversation/PlannerChoiceCard";
import { PlannerChoiceChip } from "@/components/planner/conversation/PlannerChoiceChip";
import { PlannerCustomInput } from "@/components/planner/conversation/PlannerCustomInput";
import {
  BUDGET_STYLE_DESCRIPTIONS,
  BUDGET_STYLE_DISPLAY_LABELS,
  BUDGET_STYLE_ICONS,
  COMPANION_ICONS,
  DATE_MODE_ICONS,
  INTEREST_ICONS,
  PACE_ICONS,
  QUICK_REQUEST_ICONS,
  THEME_MOOD_ICONS,
} from "@/components/planner/conversation/plannerConversationIcons";
import {
  appendPlannerQuickRequest,
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
} from "@/lib/planner/constants";
import {
  PLANNER_ASSISTANT_DESCRIPTIONS,
  PLANNER_ASSISTANT_QUESTIONS,
  PLANNER_BUDGET_QUESTION,
  PLANNER_ORIGIN_SUGGESTIONS,
  PLANNER_THEME_MOOD_CHIPS,
  budgetSummary,
  companionLabel,
  formatWonDisplay,
  getPlannerAcknowledgement,
  interestLabels,
  paceLabel,
  parseWonInput,
} from "@/lib/planner/conversationCopy";
import { computeDurationDays, formatPlannerDatesSummary } from "@/lib/planner/dates";
import type {
  PlannerBudgetStyle,
  PlannerDraftInput,
  PlannerInterest,
  PlannerSummaryEditSection,
  PlannerWizardStep,
} from "@/types/planner";

export type BudgetUiMode = "undecided" | PlannerBudgetStyle | "custom";

export type ConversationStepCommonProps = {
  draft: PlannerDraftInput;
  disabled?: boolean;
  patchDraft: (patch: Partial<PlannerDraftInput>) => void;
  onClearError?: () => void;
};

type Step1Props = ConversationStepCommonProps & {
  originId: string;
  destinationId: string;
};

export function PlannerConversationStep1({
  draft,
  disabled,
  patchDraft,
  onClearError,
  originId,
}: Step1Props) {
  const [customOrigin, setCustomOrigin] = useState(
    () =>
      Boolean(draft.origin.text.trim()) &&
      !(PLANNER_ORIGIN_SUGGESTIONS as readonly string[]).includes(draft.origin.text.trim()),
  );
  const [customDest, setCustomDest] = useState(
    () =>
      Boolean(draft.destination.text.trim()) &&
      !PLANNER_POPULAR_DESTINATIONS.some((d) => d.label === draft.destination.text.trim()),
  );

  return (
    <div className="space-y-5">
      <PlannerAssistantMessage>{PLANNER_ASSISTANT_QUESTIONS[1]}</PlannerAssistantMessage>

      <div className="space-y-2">
        <p className="type-small font-medium text-[var(--text-secondary)]">출발지</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="출발지 추천">
          {PLANNER_ORIGIN_SUGGESTIONS.map((city) => {
            const selected = draft.origin.text === city && !customOrigin;
            return (
              <PlannerChoiceChip
                key={city}
                selected={selected}
                disabled={disabled}
                onClick={() => {
                  setCustomOrigin(false);
                  patchDraft({ origin: { text: city } });
                  onClearError?.();
                }}
              >
                {city}
              </PlannerChoiceChip>
            );
          })}
          <PlannerChoiceChip
            selected={customOrigin}
            disabled={disabled}
            onClick={() => setCustomOrigin(true)}
          >
            다른 출발지
          </PlannerChoiceChip>
        </div>
        {customOrigin ? (
          <FormField id={originId} label="출발지" required>
            <Input
              id={originId}
              name="origin"
              value={draft.origin.text}
              onChange={(ev) => {
                patchDraft({ origin: { text: ev.target.value } });
                onClearError?.();
              }}
              placeholder="예: 인천, 광주"
              autoComplete="off"
              maxLength={120}
              disabled={disabled}
            />
          </FormField>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="type-small font-medium text-[var(--text-secondary)]">목적지</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="인기 여행지">
          {PLANNER_POPULAR_DESTINATIONS.map((dest) => {
            const selected = draft.destination.text === dest.label && !customDest;
            return (
              <PlannerChoiceChip
                key={dest.label}
                selected={selected}
                disabled={disabled}
                onClick={() => {
                  setCustomDest(false);
                  patchDraft({ destination: { text: dest.label } });
                  onClearError?.();
                }}
              >
                {dest.label}
              </PlannerChoiceChip>
            );
          })}
          <PlannerChoiceChip
            selected={customDest}
            disabled={disabled}
            onClick={() => setCustomDest(true)}
          >
            다른 여행지
          </PlannerChoiceChip>
        </div>
        <PlannerCustomInput
          label="목적지"
          value={draft.destination.text}
          disabled={disabled}
          maxLength={120}
          placeholder="오사카, 다낭, 파리..."
          defaultOpen={customDest}
          expandLabel="직접 입력하기"
          onChange={(text) => {
            setCustomDest(true);
            patchDraft({ destination: { text } });
            onClearError?.();
          }}
        />
      </div>
    </div>
  );
}

type Step2Props = ConversationStepCommonProps & {
  todayYmd: string;
  customDurationOpen: boolean;
  setCustomDurationOpen: (open: boolean) => void;
  durationCustomId: string;
};

export function PlannerConversationStep2({
  draft,
  disabled,
  patchDraft,
  todayYmd,
  customDurationOpen,
  setCustomDurationOpen,
  durationCustomId,
}: Step2Props) {
  function setDateMode(mode: "fixed" | "flexible") {
    if (mode === "flexible") {
      patchDraft({
        dates: {
          mode: "flexible",
          startDate: null,
          endDate: null,
          durationDays: Math.min(
            PLANNER_DURATION_DAYS_MAX,
            Math.max(PLANNER_DURATION_DAYS_MIN, draft.dates.durationDays || 3),
          ),
        },
      });
      setCustomDurationOpen(false);
      return;
    }
    patchDraft({
      dates: {
        mode: "fixed",
        startDate: draft.dates.startDate,
        endDate: draft.dates.endDate,
        durationDays: draft.dates.durationDays || 3,
      },
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

  return (
    <div className="space-y-4">
      <PlannerAssistantMessage>{PLANNER_ASSISTANT_QUESTIONS[2]}</PlannerAssistantMessage>

      <div className="flex flex-wrap gap-2" role="group" aria-label="날짜 확정 여부">
        <PlannerChoiceChip
          selected={draft.dates.mode === "fixed"}
          disabled={disabled}
          icon={DATE_MODE_ICONS.fixed}
          onClick={() => setDateMode("fixed")}
        >
          날짜를 정했어요
        </PlannerChoiceChip>
        <PlannerChoiceChip
          selected={draft.dates.mode === "flexible"}
          disabled={disabled}
          icon={DATE_MODE_ICONS.flexible}
          onClick={() => setDateMode("flexible")}
        >
          아직 정하지 않았어요
        </PlannerChoiceChip>
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
            disabled={disabled}
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
              const nights = days - 1;
              const selected = draft.dates.durationDays === days && !customDurationOpen;
              return (
                <PlannerChoiceChip
                  key={days}
                  selected={selected}
                  disabled={disabled}
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
                  {nights}박{days}일
                </PlannerChoiceChip>
              );
            })}
            <PlannerChoiceChip
              selected={customDurationOpen || draft.dates.durationDays > 7}
              disabled={disabled}
              onClick={() => setCustomDurationOpen(true)}
            >
              직접 입력
            </PlannerChoiceChip>
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
                disabled={disabled}
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
  );
}

export function PlannerConversationStep3({
  draft,
  disabled,
  patchDraft,
}: ConversationStepCommonProps) {
  const ack = getPlannerAcknowledgement({ step: 3, draft });

  return (
    <div className="space-y-4">
      <PlannerAssistantMessage>{PLANNER_ASSISTANT_QUESTIONS[3]}</PlannerAssistantMessage>

      <div className="flex flex-wrap gap-2" role="group" aria-label="동행 유형">
        {PLANNER_COMPANION_OPTIONS.map((opt) => {
          const selected = draft.companionType === opt.value;
          return (
            <PlannerChoiceChip
              key={opt.value}
              selected={selected}
              disabled={disabled}
              icon={COMPANION_ICONS[opt.value]}
              onClick={() => patchDraft({ companionType: opt.value })}
            >
              {opt.label}
            </PlannerChoiceChip>
          );
        })}
      </div>

      {ack ? <p className="type-small text-[var(--text-muted)]">{ack}</p> : null}

      <TravelerCounter
        label="성인"
        value={draft.travelers.adults}
        min={1}
        max={20}
        disabled={disabled}
        onChange={(adults) => patchDraft({ travelers: { ...draft.travelers, adults } })}
      />
      <TravelerCounter
        label="아이"
        value={draft.travelers.children}
        min={0}
        max={20}
        disabled={disabled}
        onChange={(children) => patchDraft({ travelers: { ...draft.travelers, children } })}
      />
    </div>
  );
}

export function PlannerConversationStep4({
  draft,
  disabled,
  patchDraft,
}: ConversationStepCommonProps) {
  const ack = getPlannerAcknowledgement({ step: 4, draft });

  function toggleInterest(value: PlannerInterest) {
    const has = draft.interests.includes(value);
    patchDraft({
      interests: has ? draft.interests.filter((i) => i !== value) : [...draft.interests, value],
    });
  }

  function applyThemeMood(text: string) {
    const current = draft.themeRequest.trim();
    if (current.includes(text)) return;
    const next = current ? `${current} ${text}` : text;
    patchDraft({ themeRequest: next.slice(0, 1000) });
  }

  return (
    <div className="space-y-4">
      <PlannerAssistantMessage description={PLANNER_ASSISTANT_DESCRIPTIONS[4]}>
        {PLANNER_ASSISTANT_QUESTIONS[4]}
      </PlannerAssistantMessage>

      <div className="flex flex-wrap gap-2" role="group" aria-label="여행 취향">
        {PLANNER_INTEREST_OPTIONS.map((opt) => {
          const selected = draft.interests.includes(opt.value);
          return (
            <PlannerChoiceChip
              key={opt.value}
              selected={selected}
              disabled={disabled}
              icon={INTEREST_ICONS[opt.value]}
              onClick={() => toggleInterest(opt.value)}
            >
              {opt.label}
            </PlannerChoiceChip>
          );
        })}
      </div>

      {ack ? <p className="type-small text-[var(--text-muted)]">{ack}</p> : null}

      <div className="space-y-2">
        <p className="type-small font-medium text-[var(--text-secondary)]">
          원하는 여행 분위기가 있다면 알려주세요
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="여행 분위기">
          {PLANNER_THEME_MOOD_CHIPS.map((chip) => {
            const selected = draft.themeRequest.includes(chip.text);
            return (
              <PlannerChoiceChip
                key={chip.label}
                selected={selected}
                disabled={disabled}
                icon={THEME_MOOD_ICONS[chip.label]}
                onClick={() => applyThemeMood(chip.text)}
              >
                {chip.label}
              </PlannerChoiceChip>
            );
          })}
        </div>
        <PlannerCustomInput
          label="여행 분위기"
          helper="선택 사항입니다. 스타일·분위기 위주로 적어 주세요."
          value={draft.themeRequest}
          disabled={disabled}
          multiline
          rows={3}
          maxLength={1000}
          placeholder="예: 유명 관광지는 조금만 보고 현지 맛집 위주로 다니고 싶어요."
          expandLabel="직접 입력하기"
          expandIcon={Pencil}
          onChange={(themeRequest) => patchDraft({ themeRequest })}
        />
      </div>
    </div>
  );
}

type Step5Props = ConversationStepCommonProps & {
  budgetUiMode: BudgetUiMode;
  setBudgetUiMode: (mode: BudgetUiMode) => void;
  budgetId: string;
  budgetSliderId: string;
};

export function PlannerConversationStep5({
  draft,
  disabled,
  patchDraft,
  budgetUiMode,
  setBudgetUiMode,
  budgetId,
  budgetSliderId,
}: Step5Props) {
  const paceAck = getPlannerAcknowledgement({ step: 5, draft });

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

  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <PlannerAssistantMessage>{PLANNER_ASSISTANT_QUESTIONS[5]}</PlannerAssistantMessage>

        <div className="space-y-2" role="radiogroup" aria-label="여행 속도">
          {PLANNER_PACE_OPTIONS.map((opt) => {
            const description =
              opt.value === "relaxed"
                ? "하루 2~3곳 정도, 휴식 시간을 충분히"
                : opt.value === "balanced"
                  ? "관광과 휴식의 균형"
                  : "가능한 많은 곳을 보고 싶어요";
            return (
              <PlannerChoiceCard
                key={opt.value}
                title={opt.label}
                description={description}
                selected={draft.pace === opt.value}
                disabled={disabled}
                icon={PACE_ICONS[opt.value]}
                onClick={() => patchDraft({ pace: opt.value })}
              />
            );
          })}
        </div>

        {paceAck ? <p className="type-small text-[var(--text-muted)]">{paceAck}</p> : null}
      </div>

      <div className="space-y-3">
        <PlannerAssistantMessage as="p">{PLANNER_BUDGET_QUESTION}</PlannerAssistantMessage>
        <div className="space-y-2" role="radiogroup" aria-label="예산 스타일">
          {PLANNER_BUDGET_STYLE_OPTIONS.map((opt) => {
            const selected = budgetUiMode === opt.value;
            return (
              <PlannerChoiceCard
                key={opt.value}
                title={BUDGET_STYLE_DISPLAY_LABELS[opt.value]}
                description={BUDGET_STYLE_DESCRIPTIONS[opt.value]}
                selected={selected}
                disabled={disabled}
                icon={BUDGET_STYLE_ICONS[opt.value]}
                onClick={() => setBudgetMode(opt.value)}
              />
            );
          })}
        </div>

        {budgetUiMode === "custom" ? (
          <div className="space-y-3 pt-1">
            <div className="flex flex-wrap gap-2" role="group" aria-label="예산 기준">
              {PLANNER_BUDGET_SCOPE_OPTIONS.map((opt) => {
                const selected = draft.budget.scope === opt.value;
                return (
                  <PlannerChoiceChip
                    key={opt.value}
                    selected={selected}
                    disabled={disabled}
                    onClick={() =>
                      patchDraft({
                        budget: { ...draft.budget, scope: opt.value, currency: "KRW" },
                      })
                    }
                  >
                    {opt.label}
                  </PlannerChoiceChip>
                );
              })}
            </div>
            <FormField id={budgetId} label="예산 (원)" helper="숫자 입력과 슬라이더가 함께 반영됩니다.">
              <Input
                id={budgetId}
                inputMode="numeric"
                value={formatWonDisplay(draft.budget.amount)}
                disabled={disabled}
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
              <label htmlFor={budgetSliderId} className="type-caption text-[var(--text-muted)]">
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
                disabled={disabled}
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
  );
}

type Step6Props = ConversationStepCommonProps & {
  requestId: string;
};

export function PlannerConversationStep6({
  draft,
  disabled,
  patchDraft,
  requestId,
}: Step6Props) {
  return (
    <div className="space-y-3">
      <PlannerAssistantMessage>{PLANNER_ASSISTANT_QUESTIONS[6]}</PlannerAssistantMessage>

      <div className="flex flex-wrap gap-2" role="group" aria-label="빠른 요청">
        {PLANNER_QUICK_REQUESTS.map((chip) => {
          const inserted = draft.additionalRequest.includes(chip.insertText);
          return (
            <PlannerChoiceChip
              key={chip.id}
              selected={inserted}
              disabled={disabled}
              icon={QUICK_REQUEST_ICONS[chip.id]}
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
            </PlannerChoiceChip>
          );
        })}
      </div>

      <FormField
        id={requestId}
        label="다른 요청이 있다면 적어주세요"
        helper="최대 1000자"
      >
        <Textarea
          id={requestId}
          rows={3}
          maxLength={1000}
          value={draft.additionalRequest}
          disabled={disabled}
          placeholder={"부모님이 많이 걷는 건 힘들어하세요.\n숙소는 좋은 곳이면 좋겠어요."}
          onChange={(ev) => patchDraft({ additionalRequest: ev.target.value })}
        />
      </FormField>
    </div>
  );
}

type SummaryProps = {
  draft: PlannerDraftInput;
  disabled?: boolean;
  onEditSection: (section: PlannerSummaryEditSection) => void;
};

export function PlannerConversationSummary({ draft, disabled, onEditSection }: SummaryProps) {
  return (
    <div className="space-y-4">
      <PlannerAssistantMessage>{PLANNER_ASSISTANT_QUESTIONS[7]}</PlannerAssistantMessage>
      <p className="type-small leading-relaxed text-[var(--text-muted)]">
        준비는 여기까지. 이제 일정은 더올투어가 만들어드릴게요.
      </p>
      <dl className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <SummaryEditRow
          label="출발·도착"
          value={
            draft.origin.text.trim()
              ? `${draft.origin.text.trim()} → ${draft.destination.text}`
              : draft.destination.text
          }
          onEdit={() => onEditSection("destination")}
          disabled={disabled}
        />
        <SummaryEditRow
          label="여행일"
          value={formatPlannerDatesSummary(draft.dates)}
          onEdit={() => onEditSection("dates")}
          disabled={disabled}
        />
        <SummaryEditRow
          label="동행"
          value={`성인 ${draft.travelers.adults} · 아이 ${draft.travelers.children} · ${companionLabel(draft.companionType)}`}
          onEdit={() => onEditSection("companions")}
          disabled={disabled}
        />
        <SummaryEditRow
          label="여행테마"
          value={[interestLabels(draft.interests), draft.themeRequest.trim() || null]
            .filter(Boolean)
            .join(" · ")}
          onEdit={() => onEditSection("themes")}
          disabled={disabled}
        />
        <SummaryEditRow
          label="속도/예산"
          value={`${paceLabel(draft.pace)} · ${budgetSummary(draft)}`}
          onEdit={() => onEditSection("budget")}
          disabled={disabled}
        />
        <SummaryEditRow
          label="추가 요청"
          value={draft.additionalRequest.trim() || "없음"}
          onEdit={() => onEditSection("request")}
          disabled={disabled}
        />
      </dl>
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

export function summarySectionToStep(section: PlannerSummaryEditSection): PlannerWizardStep {
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

export function budgetUiModeFromDraft(d: PlannerDraftInput): BudgetUiMode {
  if (d.budget.amount != null) return "custom";
  if (d.budget.style) return d.budget.style;
  return "undecided";
}
