"use client";

import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import type { ProductOptionGroup, ProductOptionItem, SelectedOptions } from "@/types/product";

export type OptionGroupProps = {
  group: ProductOptionGroup;
  value: string;
  isRequired?: boolean;
  onChange: (itemValue: string) => void;
};

/**
 * 단일 옵션 그룹: 제목(필수/선택 구분) + Select 또는 라디오 스타일 선택.
 * key/value 기반 (group.key, item.value).
 */
export function OptionGroup({ group, value, isRequired, onChange }: OptionGroupProps) {
  const items = group.items ?? [];
  const useSelect = items.length > 5;

  if (items.length === 0) return null;

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">{group.title}</legend>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-base font-semibold text-[#0f172a]">{group.title}</span>
        {isRequired ? (
          <span className="text-xs font-medium text-amber-600" aria-hidden>필수</span>
        ) : (
          <span className="text-xs text-slate-500" aria-hidden>선택</span>
        )}
      </div>

      {useSelect ? (
        <Select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[48px] py-3 text-base"
          aria-required={isRequired}
        >
          <option value="">선택하세요</option>
          {items.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
              {typeof opt.priceDelta === "number" && opt.priceDelta !== 0
                ? ` (${opt.priceDelta >= 0 ? "+" : ""}${new Intl.NumberFormat("ko-KR").format(opt.priceDelta)}원)`
                : ""}
              {opt.meta ? ` · ${opt.meta}` : ""}
            </option>
          ))}
        </Select>
      ) : (
        <div className="flex flex-col space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2" role="radiogroup" aria-label={group.title} aria-required={isRequired}>
          {items.map((opt) => (
            <OptionRadioItem
              key={opt.value}
              item={opt}
              groupKey={group.key}
              checked={value === opt.value}
              onSelect={() => onChange(opt.value)}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}

function OptionRadioItem({
  item,
  groupKey,
  checked,
  onSelect,
}: {
  item: ProductOptionItem;
  groupKey: string;
  checked: boolean;
  onSelect: () => void;
}) {
  const priceText =
    typeof item.priceDelta === "number" && item.priceDelta !== 0
      ? ` ${item.priceDelta >= 0 ? "+" : ""}${new Intl.NumberFormat("ko-KR").format(item.priceDelta)}원`
      : "";
  const metaText = item.meta ? ` · ${item.meta}` : "";
  return (
    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border-2 bg-white px-4 py-3 transition has-[:checked]:border-[#1E3A8A] has-[:checked]:bg-[#f8fbff] has-[:hover]:border-[#93c5fd]">
      <input
        type="radio"
        name={groupKey}
        value={item.value}
        checked={checked}
        onChange={onSelect}
        className="h-4 w-4 shrink-0 border-slate-300 text-[#1E3A8A] focus:ring-[#1E3A8A]"
      />
      <span className="flex-1 text-base font-medium text-slate-800">
        {item.label}
        {priceText ? <span className="text-sm text-slate-500">{priceText}</span> : null}
        {metaText ? <span className="text-sm text-slate-500">{metaText}</span> : null}
      </span>
    </label>
  );
}
