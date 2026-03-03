"use client";

import { Card } from "@/components/ui/Card";
import { OptionGroup } from "@/components/products/OptionGroup";
import { sortOptionGroups } from "@/lib/pricing/calcQuote";
import type { ProductOptions, SelectedOptions } from "@/types/product";

export type OptionPanelProps = {
  options: ProductOptions;
  selected: SelectedOptions;
  onSelectionChange: (groupKey: string, itemValue: string) => void;
};

/**
 * 옵션 패널: Card 안에 정렬된 OptionGroup 목록.
 * options.groups 기준으로 렌더, requiredGroups로 필수 표시.
 */
export function OptionPanel({ options, selected, onSelectionChange }: OptionPanelProps) {
  const sorted = sortOptionGroups(options);
  const requiredSet = new Set(options.requiredGroups ?? []);

  return (
    <Card variant="default" className="border-[var(--border)] bg-[var(--surface)] p-5 md:p-6">
      <h3 className="mb-4 text-lg font-bold text-[#0f172a]">옵션 선택</h3>
      <div className="grid gap-6 md:grid-cols-2">
        {sorted.map((group) => (
          <OptionGroup
            key={group.key}
            group={group}
            value={selected[group.key] ?? ""}
            isRequired={requiredSet.has(group.key)}
            onChange={(itemValue) => onSelectionChange(group.key, itemValue)}
          />
        ))}
      </div>
    </Card>
  );
}
