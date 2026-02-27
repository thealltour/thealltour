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
        "inline-flex items-center gap-2 rounded-full bg-[color:color-mix(in_oklab,var(--border)_12%,white)] p-1",
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
        "rounded-full px-3.5 py-1.5 type-caption font-semibold transition-colors",
        selected
          ? "bg-[#1E3A8A] text-white shadow-sm"
          : "bg-transparent text-content-secondary hover:bg-[color:color-mix(in_oklab,var(--border)_15%,white)]",
        className,
      )}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}

