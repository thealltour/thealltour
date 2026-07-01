import type { ProductOptionGroup, SelectedOptions } from "@/types/product";

export function getGroupSelectedValues(
  group: ProductOptionGroup,
  selected: SelectedOptions,
): string[] {
  const raw = selected[group.key];
  if (group.type === "multi") {
    if (Array.isArray(raw)) return raw.filter((v) => typeof v === "string" && v.trim() !== "");
    if (typeof raw === "string" && raw.trim() !== "") return [raw];
    return [];
  }
  if (typeof raw === "string" && raw.trim() !== "") return [raw];
  return [];
}

export function isOptionItemSelected(
  group: ProductOptionGroup,
  itemValue: string,
  selected: SelectedOptions,
): boolean {
  return getGroupSelectedValues(group, selected).includes(itemValue);
}

export function setSingleOptionSelection(
  groupKey: string,
  itemValue: string,
  selected: SelectedOptions,
): SelectedOptions {
  return { ...selected, [groupKey]: itemValue };
}

export function toggleMultiOption(
  groupKey: string,
  itemValue: string,
  selected: SelectedOptions,
): SelectedOptions {
  const current = selected[groupKey];
  const values = Array.isArray(current)
    ? [...current]
    : typeof current === "string" && current.trim() !== ""
      ? [current]
      : [];

  const next = values.includes(itemValue)
    ? values.filter((v) => v !== itemValue)
    : [...values, itemValue];

  const updated = { ...selected };
  if (next.length === 0) {
    delete updated[groupKey];
  } else {
    updated[groupKey] = next;
  }
  return updated;
}

export function isGroupSelectionMissing(
  group: ProductOptionGroup,
  selected: SelectedOptions,
  isRequired: boolean,
): boolean {
  if (!isRequired) return false;
  return getGroupSelectedValues(group, selected).length === 0;
}

export function hasAnyOptionSelection(selected: SelectedOptions): boolean {
  return Object.values(selected).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return typeof value === "string" && value.trim() !== "";
  });
}

export function optionsSelectionHasMultiGroup(groups: ProductOptionGroup[]): boolean {
  return groups.some((group) => group.type === "multi");
}
