import { normalizeNullablePriceNumber } from "@/lib/products/seasonalPriceBands";
import type {
  ProductOptionGroup,
  ProductOptionItem,
  ProductOptions,
} from "@/types/product";

export const DEFAULT_SURCHARGE_GROUP_KEY = "surcharges";
export const DEFAULT_SURCHARGE_GROUP_TITLE = "추가 옵션·할증";

const GROUP_TYPES = new Set<ProductOptionGroup["type"]>(["radio", "select", "stepper", "multi"]);

export type ParseProductOptionsResult =
  | { ok: true; options: ProductOptions | null }
  | { ok: false; error: string };

function parseItem(raw: unknown, fallbackValue: string): ProductOptionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const value =
    typeof o.value === "string" && o.value.trim() ? o.value.trim() : fallbackValue;
  const label = typeof o.label === "string" ? o.label : "";
  const item: ProductOptionItem = { value, label };
  const meta = typeof o.meta === "string" ? o.meta.trim() : "";
  if (meta) item.meta = meta;
  const priceDelta = normalizeNullablePriceNumber(o.priceDelta);
  if (priceDelta != null) item.priceDelta = priceDelta;
  if (o.isDefault === true) item.isDefault = true;
  return item;
}

function parseGroup(raw: unknown, groupIndex: number): ProductOptionGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key =
    typeof o.key === "string" && o.key.trim() ? o.key.trim() : `group-${groupIndex}`;
  const title = typeof o.title === "string" && o.title.trim() ? o.title.trim() : key;
  const type = GROUP_TYPES.has(o.type as ProductOptionGroup["type"])
    ? (o.type as ProductOptionGroup["type"])
    : "multi";
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const items = itemsRaw
    .map((item, itemIndex) => parseItem(item, `${key}-${itemIndex}`))
    .filter((item): item is ProductOptionItem => item != null);
  return { key, title, type, items };
}

export function parseProductOptionsJson(jsonText: string): ParseProductOptionsResult {
  const raw = jsonText.trim();
  if (!raw) return { ok: true, options: null };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, error: "옵션 JSON 형식이 올바르지 않습니다." };
    }
    const o = parsed as Record<string, unknown>;
    if (!Array.isArray(o.groups)) {
      return { ok: false, error: "옵션 JSON에 groups 배열이 없습니다." };
    }
    const groups = o.groups
      .map((group, index) => parseGroup(group, index))
      .filter((group): group is ProductOptionGroup => group != null);
    const basePrice = normalizeNullablePriceNumber(o.basePrice) ?? 0;
    const requiredGroups = Array.isArray(o.requiredGroups)
      ? o.requiredGroups.filter((key): key is string => typeof key === "string" && Boolean(key.trim()))
      : undefined;
    const options: ProductOptions = {
      basePrice,
      currency: "KRW",
      groups,
    };
    if (requiredGroups?.length) options.requiredGroups = requiredGroups;
    return { ok: true, options };
  } catch {
    return { ok: false, error: "옵션 JSON을 해석할 수 없습니다." };
  }
}

function compactItem(item: ProductOptionItem): ProductOptionItem {
  const next: ProductOptionItem = {
    value: item.value,
    label: item.label,
  };
  if (item.meta?.trim()) next.meta = item.meta.trim();
  if (item.priceDelta != null && item.priceDelta > 0) next.priceDelta = item.priceDelta;
  if (item.isDefault) next.isDefault = true;
  return next;
}

export function stringifyProductOptionsJson(options: ProductOptions | null | undefined): string {
  if (!options?.groups?.length) return "";
  const groups = options.groups
    .map((group) => ({
      ...group,
      title: group.title.trim() || group.key,
      items: group.items.map(compactItem),
    }))
    .filter((group) => group.items.length > 0);
  if (groups.length === 0) return "";
  const payload: ProductOptions = {
    basePrice: options.basePrice ?? 0,
    currency: "KRW",
    groups,
  };
  if (options.requiredGroups?.length) payload.requiredGroups = options.requiredGroups;
  return JSON.stringify(payload, null, 2);
}

export function parsePriceDeltaInput(raw: string): number | undefined {
  return normalizeNullablePriceNumber(raw) ?? undefined;
}

function nextSurchargeValue(options: ProductOptions): string {
  let max = -1;
  for (const group of options.groups) {
    for (const item of group.items) {
      const match = item.value.match(/^surcharge-(\d+)$/);
      if (match) max = Math.max(max, Number(match[1]));
    }
  }
  return `surcharge-${max + 1}`;
}

function emptyItem(value: string): ProductOptionItem {
  return { value, label: "" };
}

export function addProductOptionItem(
  options: ProductOptions | null,
  basePrice: number,
): ProductOptions {
  if (!options?.groups.length) {
    return {
      basePrice,
      currency: "KRW",
      groups: [
        {
          key: DEFAULT_SURCHARGE_GROUP_KEY,
          title: DEFAULT_SURCHARGE_GROUP_TITLE,
          type: "multi",
          items: [emptyItem("surcharge-0")],
        },
      ],
    };
  }
  const groupIndex = Math.max(
    0,
    options.groups.findIndex((group) => group.key === DEFAULT_SURCHARGE_GROUP_KEY),
  );
  const value = nextSurchargeValue(options);
  return {
    ...options,
    groups: options.groups.map((group, index) =>
      index === groupIndex ? { ...group, items: [...group.items, emptyItem(value)] } : group,
    ),
  };
}

export function patchProductOptionItem(
  options: ProductOptions,
  groupIndex: number,
  itemIndex: number,
  patch: Partial<Pick<ProductOptionItem, "label" | "meta" | "priceDelta">>,
): ProductOptions {
  return {
    ...options,
    groups: options.groups.map((group, gIndex) => {
      if (gIndex !== groupIndex) return group;
      return {
        ...group,
        items: group.items.map((item, iIndex) => {
          if (iIndex !== itemIndex) return item;
          const next: ProductOptionItem = { ...item, ...patch };
          if ("priceDelta" in patch && patch.priceDelta == null) {
            delete next.priceDelta;
          }
          if ("meta" in patch && !patch.meta?.trim()) {
            delete next.meta;
          }
          return next;
        }),
      };
    }),
  };
}

export function patchProductOptionGroupTitle(
  options: ProductOptions,
  groupIndex: number,
  title: string,
): ProductOptions {
  return {
    ...options,
    groups: options.groups.map((group, index) =>
      index === groupIndex ? { ...group, title } : group,
    ),
  };
}

export function removeProductOptionItem(
  options: ProductOptions,
  groupIndex: number,
  itemIndex: number,
): ProductOptions | null {
  const groups = options.groups
    .map((group, gIndex) =>
      gIndex === groupIndex
        ? { ...group, items: group.items.filter((_, iIndex) => iIndex !== itemIndex) }
        : group,
    )
    .filter((group) => group.items.length > 0);
  if (groups.length === 0) return null;
  return { ...options, groups };
}

export function parseFormBasePrice(priceText: string): number {
  return normalizeNullablePriceNumber(priceText) ?? 0;
}
