"use client";

import { Button } from "@/components/ui/Button";
import {
  PLANNER_QA_PRESET_IDS,
  type PlannerQaPresetId,
  getPlannerQaPresets,
} from "@/lib/planner/qaPresets";
import type { PlannerDraftInput, PlannerWizardStep } from "@/types/planner";
import { cn } from "@/lib/cn";

export type PlannerQaPhase = "wizard" | "generating" | "failed";

export type PlannerQaPanelProps = {
  step: PlannerWizardStep;
  sessionId: string | null;
  phase: PlannerQaPhase;
  draft: PlannerDraftInput;
  presetId: PlannerQaPresetId;
  busy: boolean;
  error: string | null;
  onPresetIdChange: (id: PlannerQaPresetId) => void;
  onApplyPreset: () => void;
  onCreateSession: () => void;
  onJumpStep: (step: PlannerWizardStep) => void;
  onReadySummary: () => void;
  onGenerate: () => void;
  onReset: () => void;
};

const STEPS: PlannerWizardStep[] = [1, 2, 3, 4, 5, 6, 7];

export function PlannerQaPanel({
  step,
  sessionId,
  phase,
  draft,
  presetId,
  busy,
  error,
  onPresetIdChange,
  onApplyPreset,
  onCreateSession,
  onJumpStep,
  onReadySummary,
  onGenerate,
  onReset,
}: PlannerQaPanelProps) {
  const presets = getPlannerQaPresets();
  const sessionShort = sessionId ? sessionId.slice(0, 8) : "—";

  return (
    <aside
      className={cn(
        "rounded-xl border border-dashed border-[var(--border-strong)]",
        "bg-[var(--surface-muted)] p-3 text-[var(--foreground)]",
      )}
      data-testid="planner-qa-panel"
      aria-label="Planner QA"
    >
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold tracking-wide text-[var(--accent)]">
          Planner QA
        </p>
        <p className="font-mono text-[0.65rem] text-[var(--text-muted)]">
          step={step} · session={sessionShort} · phase={phase} · dates=
          {draft.dates.mode}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-[0.7rem] font-medium text-[var(--text-muted)]">
          Preset
          <select
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--foreground)]"
            value={presetId}
            disabled={busy}
            onChange={(e) => onPresetIdChange(e.target.value as PlannerQaPresetId)}
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={onApplyPreset}
          >
            프리셋 적용
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onCreateSession}
          >
            세션 만들기
          </Button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {STEPS.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={step === s ? "primary" : "outline"}
            disabled={busy}
            className="min-w-9 px-2"
            onClick={() => onJumpStep(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy}
          onClick={onReadySummary}
        >
          완성 직전으로
        </Button>
        <Button
          type="button"
          size="sm"
          variant="accent"
          disabled={busy}
          onClick={onGenerate}
        >
          바로 생성 테스트
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={onReset}
        >
          QA 초기화
        </Button>
      </div>

      <p className="mt-2 font-mono text-[0.65rem] text-[var(--text-muted)]">
        preset={PLANNER_QA_PRESET_IDS.includes(presetId) ? presetId : "?"} ·{" "}
        {draft.origin.text || "?"} → {draft.destination.text || "?"}
      </p>

      {error ? (
        <p className="mt-2 text-xs text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </aside>
  );
}
