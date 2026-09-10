import { MARKETING_ATTR } from "@/lib/marketing/observability/attributes";

/** Fixture marker written by OBS smoke helpers (not in MARKETING_ATTR constants). */
export const MARKETING_FIXTURE_ATTR = "marketing.fixture";
export const MARKETING_FIXTURE_KIND_ATTR = "marketing.fixture.kind";

export function attributesIndicateFixture(
  attributes: Record<string, unknown> | null | undefined,
): boolean {
  if (!attributes || typeof attributes !== "object") return false;
  if (MARKETING_FIXTURE_ATTR in attributes) return true;
  if (MARKETING_FIXTURE_KIND_ATTR in attributes) return true;
  // Defensive: some fixtures may only set kind under MARKETING_ATTR namespace later
  if ("marketing.fixture" in attributes) return true;
  void MARKETING_ATTR;
  return false;
}
