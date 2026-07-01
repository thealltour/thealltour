"use client";

import { Card } from "@/components/ui/Card";
import { OptionGroup } from "@/components/products/OptionGroup";
import { sortOptionGroups } from "@/lib/pricing/calcQuote";
import {
  setSingleOptionSelection,
  toggleMultiOption,
} from "@/lib/pricing/selectedOptions";
import type { ProductOptions, SelectedOptions } from "@/types/product";

export type OptionPanelProps = {
  options: ProductOptions;
  selected: SelectedOptions;
  onSelectionChange: (groupKey: string, itemValue: string) => void;
  onMultiToggle?: (groupKey: string, itemValue: string) => void;
};

/**
 * 옵션 패널: Card 안에 정렬된 OptionGroup 목록.
 * options.groups 기준으로 렌더, requiredGroups로 필수 표시.
 */
export function OptionPanel({
  options,
  selected,
  onSelectionChange,
  onMultiToggle,
}: OptionPanelProps) {
  const sorted = sortOptionGroups(options);
  const requiredSet = new Set(options.requiredGroups ?? []);

  return (
    <Card variant="default" className="border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
      <h3 className="mb-4 text-lg font-bold text-[#0f172a]">옵션 선택</h3>
      <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
        {sorted.map((group) => (
          <OptionGroup
            key={group.key}
            group={group}
            selected={selected}
            isRequired={requiredSet.has(group.key)}
            onSingleChange={(itemValue) => onSelectionChange(group.key, itemValue)}
            onMultiToggle={(itemValue) => {
              if (onMultiToggle) {
                onMultiToggle(group.key, itemValue);
                return;
              }
              onSelectionChange(group.key, itemValue);
            }}
          />
        ))}
      </div>
    </Card>
  );
}

/** OptionPanel 외부 state 업데이트용 헬퍼 */
export function applyOptionPanelChange(
  group: ProductOptions["groups"][number],
  groupKey: string,
  itemValue: string,
  selected: SelectedOptions,
): SelectedOptions {
  if (group.type === "multi") {
    return toggleMultiOption(groupKey, itemValue, selected);
  }
  return setSingleOptionSelection(groupKey, itemValue, selected);
}
