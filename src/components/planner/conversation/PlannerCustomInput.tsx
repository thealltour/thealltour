"use client";

import { useId, useState, type ComponentType } from "react";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { PlannerChoiceChip } from "@/components/planner/conversation/PlannerChoiceChip";
import type { PlannerVisualTone } from "@/components/planner/conversation/plannerConversationIcons";
import { cn } from "@/lib/cn";

type IconComponent = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

type PlannerCustomInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  /** When true, show input immediately without expand control. */
  defaultOpen?: boolean;
  helper?: string;
  className?: string;
  expandLabel?: string;
  expandIcon?: IconComponent;
  expandIconTone?: PlannerVisualTone;
};

export function PlannerCustomInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  multiline,
  rows = 3,
  maxLength,
  defaultOpen = false,
  helper,
  className,
  expandLabel = "직접 입력하기",
  expandIcon,
  expandIconTone,
}: PlannerCustomInputProps) {
  const id = useId();
  const [opened, setOpened] = useState(false);
  const open = defaultOpen || opened || Boolean(value.trim());

  if (!open) {
    return (
      <div className={cn(className)}>
        <PlannerChoiceChip
          disabled={disabled}
          icon={expandIcon}
          iconTone={expandIconTone}
          onClick={() => setOpened(true)}
          aria-label={expandLabel}
        >
          {expandLabel}
        </PlannerChoiceChip>
      </div>
    );
  }

  return (
    <FormField id={id} label={label} helper={helper} className={className}>
      {multiline ? (
        <Textarea
          id={id}
          rows={rows}
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <Input
          id={id}
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </FormField>
  );
}
