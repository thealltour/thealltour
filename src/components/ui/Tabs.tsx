import * as React from "react";
import { cn } from "@/lib/cn";

export type TabsValue = string;

export type TabsProps = {
  value: TabsValue;
  onChange?: (value: TabsValue) => void;
  className?: string;
  children: React.ReactNode;
};

export function Tabs({ value, onChange, className, children }: TabsProps) {
  return (
    <div
      className={cn(
        "flex w-full max-w-full flex-wrap items-center gap-1 rounded-full bg-[var(--surface-muted)] p-1",
        className,
      )}
      data-value={value}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        if (child.type !== TabsTrigger) return child;

        const triggerElement = child as React.ReactElement<TabsTriggerBaseProps>;
        const childValue = triggerElement.props.value;
        const selected = childValue === value;

        return React.cloneElement(triggerElement as React.ReactElement<TabsTriggerInnerProps>, {
          selected,
          onSelect: () => onChange?.(childValue),
        });
      })}
    </div>
  );
}

type TabsTriggerBaseProps = {
  value: TabsValue;
  children: React.ReactNode;
  className?: string;
};

type TabsTriggerInnerProps = TabsTriggerBaseProps & {
  selected?: boolean;
  onSelect?: () => void;
};

export function TabsTrigger({
  value: _,
  selected,
  onSelect,
  children,
  className,
}: TabsTriggerInnerProps) {
  return (
    <button
      type="button"
      className={cn(
        "min-h-[44px] shrink-0 rounded-full px-3 py-2 text-xs font-semibold leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-muted)] sm:px-4 sm:text-sm",
        selected
          ? "bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)]"
          : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
        className,
      )}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

