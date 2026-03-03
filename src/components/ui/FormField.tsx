"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Label, LabelSub } from "./Label";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Select } from "./Select";

type FormFieldProps = {
  label?: React.ReactNode;
  labelSub?: React.ReactNode;
  error?: string;
  helper?: React.ReactNode;
  required?: boolean;
  className?: string;
  /** input id와 연결 시 라벨 htmlFor에 사용 */
  id?: string;
  children: React.ReactNode;
};

/** 라벨 / 인풋(또는 children) / 헬퍼·에러 메시지. helper·에러는 --text-muted / --danger */
export function FormField({
  label,
  labelSub,
  error,
  helper,
  required,
  className,
  id,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label != null && (
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={id}>
            {label}
            {required && <span className="text-[var(--danger)]"> *</span>}
          </Label>
          {labelSub != null && <LabelSub>{labelSub}</LabelSub>}
        </div>
      )}
      {children}
      {helper != null && !error && (
        <p className="type-caption text-[var(--text-muted)]">{helper}</p>
      )}
      {error != null && (
        <p className="type-caption text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputFieldProps = Omit<React.ComponentProps<typeof Input>, "error"> & {
  label?: React.ReactNode;
  labelSub?: React.ReactNode;
  error?: string;
  helper?: React.ReactNode;
  required?: boolean;
  className?: string;
};

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      label,
      labelSub,
      error,
      helper,
      required,
      className,
      id: idProp,
      ...inputProps
    },
    ref,
  ) => {
    const id = React.useId();
    const inputId = idProp ?? id;
    return (
    <FormField
      label={label}
      labelSub={labelSub}
      error={error}
      helper={helper}
      required={required}
      className={className}
      id={inputId}
    >
      <Input ref={ref} id={inputId} error={Boolean(error)} {...inputProps} />
    </FormField>
  );
  },
);
InputField.displayName = "InputField";

type TextareaFieldProps = Omit<React.ComponentProps<typeof Textarea>, "error"> & {
  label?: React.ReactNode;
  labelSub?: React.ReactNode;
  error?: string;
  helper?: React.ReactNode;
  required?: boolean;
  className?: string;
};

export const TextareaField = React.forwardRef<
  HTMLTextAreaElement,
  TextareaFieldProps
>(
  (
    {
      label,
      labelSub,
      error,
      helper,
      required,
      className,
      id: idProp,
      ...textareaProps
    },
    ref,
  ) => {
    const id = React.useId();
    const textareaId = idProp ?? id;
    return (
    <FormField
      label={label}
      labelSub={labelSub}
      error={error}
      helper={helper}
      required={required}
      className={className}
      id={textareaId}
    >
      <Textarea ref={ref} id={textareaId} error={Boolean(error)} {...textareaProps} />
    </FormField>
  );
  },
);
TextareaField.displayName = "TextareaField";

type SelectFieldProps = Omit<React.ComponentProps<typeof Select>, "error"> & {
  label?: React.ReactNode;
  labelSub?: React.ReactNode;
  error?: string;
  helper?: React.ReactNode;
  required?: boolean;
  className?: string;
};

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    {
      label,
      labelSub,
      error,
      helper,
      required,
      className,
      id: idProp,
      children,
      ...selectProps
    },
    ref,
  ) => {
    const id = React.useId();
    const selectId = idProp ?? id;
    return (
    <FormField
      label={label}
      labelSub={labelSub}
      error={error}
      helper={helper}
      required={required}
      className={className}
      id={selectId}
    >
      <Select ref={ref} id={selectId} error={Boolean(error)} {...selectProps}>
        {children}
      </Select>
    </FormField>
  );
  },
);
SelectField.displayName = "SelectField";
