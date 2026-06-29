import type { ProductSellingPoints } from "@/types/product";

export function normalizeSellingPoints(raw: unknown): ProductSellingPoints | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const pick = (key: keyof ProductSellingPoints) => {
    const v = o[key];
    if (typeof v !== "string") return undefined;
    const trimmed = v.trim();
    return trimmed ? trimmed : undefined;
  };
  const result: ProductSellingPoints = {
    corePoints: pick("corePoints"),
    tourism: pick("tourism"),
    meals: pick("meals"),
    transport: pick("transport"),
    insurance: pick("insurance"),
  };
  const hasAny = Object.values(result).some((v) => v && v.length > 0);
  return hasAny ? result : undefined;
}

export function sellingPointsToJsonColumn(
  points: ProductSellingPoints | null | undefined,
): ProductSellingPoints | null {
  if (!points) return null;
  const out: ProductSellingPoints = {};
  for (const key of ["corePoints", "tourism", "meals", "transport", "insurance"] as const) {
    const v = points[key]?.trim();
    if (v) out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function formStringsToSellingPoints(form: {
  selling_core_points: string;
  selling_tourism: string;
  selling_meals: string;
  selling_transport: string;
  selling_insurance: string;
}): ProductSellingPoints | null {
  return sellingPointsToJsonColumn({
    corePoints: form.selling_core_points.trim() || null,
    tourism: form.selling_tourism.trim() || null,
    meals: form.selling_meals.trim() || null,
    transport: form.selling_transport.trim() || null,
    insurance: form.selling_insurance.trim() || null,
  });
}

export function sellingPointsToFormStrings(
  points: ProductSellingPoints | null | undefined,
): Pick<
  {
    selling_core_points: string;
    selling_tourism: string;
    selling_meals: string;
    selling_transport: string;
    selling_insurance: string;
  },
  "selling_core_points" | "selling_tourism" | "selling_meals" | "selling_transport" | "selling_insurance"
> {
  return {
    selling_core_points: points?.corePoints?.trim() ?? "",
    selling_tourism: points?.tourism?.trim() ?? "",
    selling_meals: points?.meals?.trim() ?? "",
    selling_transport: points?.transport?.trim() ?? "",
    selling_insurance: points?.insurance?.trim() ?? "",
  };
}
