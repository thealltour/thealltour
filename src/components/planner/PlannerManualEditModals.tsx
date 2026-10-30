"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { PLANNER_ITEM_TYPES, type PlannerPlanItem } from "@/lib/planner/planSchemas";

const ITEM_TYPE_LABEL: Record<PlannerPlanItem["type"], string> = {
  attraction: "관광",
  food: "식사",
  cafe: "카페",
  shopping: "쇼핑",
  activity: "액티비티",
  rest: "휴식",
  transport: "이동",
  other: "기타",
};

type ConflictBannerProps = {
  show: boolean;
  onReload: () => void;
};

function ConflictBanner({ show, onReload }: ConflictBannerProps) {
  if (!show) return null;
  return (
    <div className="space-y-2 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning-bg)] p-3" role="alert">
      <p className="type-small font-semibold text-[var(--foreground)]">일정이 변경되었어요.</p>
      <p className="type-caption text-[var(--text-secondary)]">
        다른 창이나 작업에서 이 플랜이 먼저 수정되었습니다. 최신 일정을 불러온 뒤 다시 수정해 주세요.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onReload}>
        최신 일정 불러오기
      </Button>
    </div>
  );
}

type DayTitleModalProps = {
  open: boolean;
  initialTitle: string;
  busy: boolean;
  error: string | null;
  conflict: boolean;
  onClose: () => void;
  onSave: (title: string) => void;
  onReload: () => void;
};

function DayTitleFields({
  initialTitle,
  busy,
  conflict,
  error,
  onClose,
  onSave,
}: {
  initialTitle: string;
  busy: boolean;
  conflict: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(initialTitle);
  return (
    <>
      <label className="block space-y-1.5">
        <span className="type-caption font-medium text-[var(--text-secondary)]">제목</span>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          disabled={busy || conflict}
          aria-invalid={Boolean(error)}
        />
      </label>
      {error && !conflict ? (
        <p className="type-small text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          취소
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={busy}
          disabled={busy || conflict || title.trim().length < 1}
          onClick={() => onSave(title.trim())}
        >
          저장
        </Button>
      </div>
    </>
  );
}

export function PlannerDayTitleEditModal({
  open,
  initialTitle,
  busy,
  error,
  conflict,
  onClose,
  onSave,
  onReload,
}: DayTitleModalProps) {
  return (
    <Modal isOpen={open} onClose={() => !busy && onClose()} aria-label="Day 제목 수정" className="w-full max-w-md space-y-4">
      <h2 className="type-h3 text-[var(--foreground)]">Day 제목 수정</h2>
      <ConflictBanner show={conflict} onReload={onReload} />
      {open ? (
        <DayTitleFields
          key={initialTitle}
          initialTitle={initialTitle}
          busy={busy}
          conflict={conflict}
          error={error}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Modal>
  );
}

export type ItemEditValues = {
  time: string;
  name: string;
  area: string;
  description: string;
  type: PlannerPlanItem["type"];
  estimatedDurationMinutes: string;
};

type ItemEditModalProps = {
  open: boolean;
  mode: "edit" | "add";
  initial: ItemEditValues;
  busy: boolean;
  error: string | null;
  conflict: boolean;
  onClose: () => void;
  onSave: (values: ItemEditValues) => void;
  onReload: () => void;
};

function ItemEditFields({
  initial,
  mode,
  busy,
  conflict,
  error,
  onClose,
  onSave,
}: {
  initial: ItemEditValues;
  mode: "edit" | "add";
  busy: boolean;
  conflict: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (values: ItemEditValues) => void;
}) {
  const [values, setValues] = useState(initial);
  function patch<K extends keyof ItemEditValues>(key: K, value: ItemEditValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <>
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="type-caption font-medium text-[var(--text-secondary)]">시간</span>
          <Input
            type="time"
            value={values.time}
            onChange={(e) => patch("time", e.target.value)}
            disabled={busy || conflict}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="type-caption font-medium text-[var(--text-secondary)]">
            일정명{mode === "add" ? " *" : ""}
          </span>
          <Input
            value={values.name}
            onChange={(e) => patch("name", e.target.value)}
            maxLength={80}
            disabled={busy || conflict}
            required
          />
        </label>
        <label className="block space-y-1.5">
          <span className="type-caption font-medium text-[var(--text-secondary)]">지역/장소</span>
          <Input
            value={values.area}
            onChange={(e) => patch("area", e.target.value)}
            maxLength={80}
            disabled={busy || conflict}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="type-caption font-medium text-[var(--text-secondary)]">설명</span>
          <Textarea
            value={values.description}
            onChange={(e) => patch("description", e.target.value)}
            maxLength={400}
            rows={3}
            disabled={busy || conflict}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="type-caption font-medium text-[var(--text-secondary)]">분류</span>
          <select
            className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 type-body text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            value={values.type}
            onChange={(e) => patch("type", e.target.value as PlannerPlanItem["type"])}
            disabled={busy || conflict}
          >
            {PLANNER_ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {ITEM_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="type-caption font-medium text-[var(--text-secondary)]">예상 체류시간(분)</span>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={720}
            value={values.estimatedDurationMinutes}
            onChange={(e) => patch("estimatedDurationMinutes", e.target.value)}
            disabled={busy || conflict}
            placeholder="선택"
          />
        </label>
      </div>
      {error && !conflict ? (
        <p className="type-small text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          취소
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={busy}
          disabled={busy || conflict || values.name.trim().length < 1}
          onClick={() => onSave(values)}
        >
          저장
        </Button>
      </div>
    </>
  );
}

export function PlannerItemEditModal({
  open,
  mode,
  initial,
  busy,
  error,
  conflict,
  onClose,
  onSave,
  onReload,
}: ItemEditModalProps) {
  const formKey = `${mode}:${initial.name}:${initial.time}:${initial.type}`;
  return (
    <Modal
      isOpen={open}
      onClose={() => !busy && onClose()}
      aria-label={mode === "add" ? "일정 추가" : "일정 수정"}
      className="w-full max-w-md space-y-4"
    >
      <h2 className="type-h3 text-[var(--foreground)]">{mode === "add" ? "일정 추가" : "일정 수정"}</h2>
      <ConflictBanner show={conflict} onReload={onReload} />
      {open ? (
        <ItemEditFields
          key={formKey}
          initial={initial}
          mode={mode}
          busy={busy}
          conflict={conflict}
          error={error}
          onClose={onClose}
          onSave={onSave}
        />
      ) : null}
    </Modal>
  );
}

type DeleteModalProps = {
  open: boolean;
  itemName: string;
  busy: boolean;
  error: string | null;
  conflict: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onReload: () => void;
};

export function PlannerItemDeleteModal({
  open,
  itemName,
  busy,
  error,
  conflict,
  onClose,
  onConfirm,
  onReload,
}: DeleteModalProps) {
  return (
    <Modal isOpen={open} onClose={() => !busy && onClose()} aria-label="일정 삭제 확인" className="w-full max-w-md space-y-4">
      <h2 className="type-h3 text-[var(--foreground)]">이 일정을 삭제할까요?</h2>
      <p className="type-body text-[var(--text-secondary)]">{itemName}</p>
      <ConflictBanner show={conflict} onReload={onReload} />
      {error && !conflict ? (
        <p className="type-small text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
          취소
        </Button>
        <Button type="button" variant="primary" loading={busy} disabled={busy || conflict} onClick={onConfirm}>
          삭제
        </Button>
      </div>
    </Modal>
  );
}

export function emptyItemEditValues(): ItemEditValues {
  return {
    time: "",
    name: "",
    area: "",
    description: "",
    type: "other",
    estimatedDurationMinutes: "",
  };
}

export function itemToEditValues(item: PlannerPlanItem): ItemEditValues {
  return {
    time: item.time ?? "",
    name: item.name,
    area: item.area ?? "",
    description: item.description,
    type: item.type,
    estimatedDurationMinutes:
      item.estimatedDurationMinutes != null ? String(item.estimatedDurationMinutes) : "",
  };
}
