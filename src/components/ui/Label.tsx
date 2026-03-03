import * as React from "react";
import { cn } from "@/lib/cn";

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn("type-small font-medium text-[var(--foreground)]", className)}
        {...props}
      />
    );
  },
);

Label.displayName = "Label";

/** 보조 라벨/설명: --text-muted */
export function LabelSub({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("type-caption text-[var(--text-muted)]", className)}
      {...props}
    />
  );
}

