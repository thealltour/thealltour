"use client";

import { Select } from "@/components/ui/Select";
import {
  getGroupSelectedValues,
  isOptionItemSelected,
} from "@/lib/pricing/selectedOptions";
import type { ProductOptionGroup, ProductOptionItem, SelectedOptions } from "@/types/product";

export type OptionGroupProps = {
  group: ProductOptionGroup;
  selected: SelectedOptions;
  isRequired?: boolean;
  hideTitle?: boolean;
  onSingleChange: (itemValue: string) => void;
  onMultiToggle: (itemValue: string) => void;
};

/**
 * 단일 옵션 그룹: type에 따라 radio / checkbox / select 렌더
 */
export function OptionGroup({
  group,
  selected,
  isRequired,
  hideTitle,
  onSingleChange,
  onMultiToggle,
}: OptionGroupProps) {
  const items = group.items ?? [];
  const useSelect = group.type !== "multi" && items.length > 5;
  const isMulti = group.type === "multi";
  const singleValue = isMulti ? "" : (getGroupSelectedValues(group, selected)[0] ?? "");

  if (items.length === 0) return null;

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">{group.title}</legend>
      {!hideTitle ? (
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-semibold text-[#0f172a]">{group.title}</span>
          {isRequired ? (
            <span className="text-xs font-medium text-[var(--warning)]" aria-hidden>
              필수
            </span>
          ) : (
            <span className="text-xs text-slate-500" aria-hidden>
              {isMulti ? "중복 선택" : "선택"}
            </span>
          )}
        </div>
      ) : null}

      {useSelect ? (
        <Select
          value={singleValue}
          onChange={(e) => onSingleChange(e.target.value)}
          className="min-h-[48px] py-3 text-base"
          aria-required={isRequired}
        >
          <option value="">선택하세요</option>
          {items.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {formatOptionLabel(opt)}
            </option>
          ))}
        </Select>
      ) : isMulti ? (
        <div
          className="flex flex-col space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2"
          role="group"
          aria-label={group.title}
          aria-multiselectable="true"
        >
          {items.map((opt) => (
            <OptionCheckboxItem
              key={opt.value}
              item={opt}
              groupKey={group.key}
              checked={isOptionItemSelected(group, opt.value, selected)}
              onToggle={() => onMultiToggle(opt.value)}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col space-y-2 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-2"
          role="radiogroup"
          aria-label={group.title}
          aria-required={isRequired}
        >
          {items.map((opt) => (
            <OptionRadioItem
              key={opt.value}
              item={opt}
              groupKey={group.key}
              checked={singleValue === opt.value}
              onSelect={() => onSingleChange(opt.value)}
            />
          ))}
        </div>
      )}
    </fieldset>
  );
}

function formatOptionLabel(opt: ProductOptionItem): string {
  const priceText =
    typeof opt.priceDelta === "number" && opt.priceDelta !== 0
      ? ` (${opt.priceDelta >= 0 ? "+" : ""}${new Intl.NumberFormat("ko-KR").format(opt.priceDelta)}원)`
      : "";
  const metaText = opt.meta ? ` · ${opt.meta}` : "";
  return `${opt.label}${priceText}${metaText}`;
}

function optionCardClass(checked: boolean): string {
  return checked
    ? "border-[var(--accent)] bg-[var(--accent-soft)] ring-1 ring-[var(--accent)]"
    : "border-slate-300 bg-slate-50/40 hover:border-slate-400 hover:bg-slate-50";
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
    <label
      className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition ${optionCardClass(checked)}`}
    >
      <input
        type="radio"
        name={groupKey}
        value={item.value}
        checked={checked}
        onChange={onSelect}
        className="h-4 w-4 shrink-0 border-slate-300 accent-[var(--accent)] focus:ring-[var(--accent)]"
      />
      <span className="flex-1 text-base font-medium text-slate-800">
        {item.label}
        {priceText ? <span className="text-sm text-slate-500">{priceText}</span> : null}
        {metaText ? <span className="text-sm text-slate-500">{metaText}</span> : null}
      </span>
    </label>
  );
}

function OptionCheckboxItem({
  item,
  groupKey,
  checked,
  onToggle,
}: {
  item: ProductOptionItem;
  groupKey: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const priceText =
    typeof item.priceDelta === "number" && item.priceDelta !== 0
      ? ` ${item.priceDelta >= 0 ? "+" : ""}${new Intl.NumberFormat("ko-KR").format(item.priceDelta)}원`
      : "";
  const metaText = item.meta ? ` · ${item.meta}` : "";
  return (
    <label
      className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition ${optionCardClass(checked)}`}
    >
      <input
        type="checkbox"
        name={`${groupKey}-${item.value}`}
        value={item.value}
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 shrink-0 rounded border-slate-300 accent-[var(--accent)] focus:ring-[var(--accent)]"
      />
      <span className="flex-1 text-base font-medium text-slate-800">
        {item.label}
        {priceText ? <span className="text-sm text-slate-500">{priceText}</span> : null}
        {metaText ? <span className="text-sm text-slate-500">{metaText}</span> : null}
      </span>
    </label>
  );
}
