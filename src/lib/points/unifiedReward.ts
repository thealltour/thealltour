import {
  GIFT_WON_VALUE_PER_TRAVELER,
  MAX_TRAVELER_COUNT,
  MIN_TRAVELER_COUNT,
  POINTS_PER_TRAVELER,
} from "@/types/pointsRewardsV2";

export { GIFT_WON_VALUE_PER_TRAVELER, MAX_TRAVELER_COUNT, MIN_TRAVELER_COUNT, POINTS_PER_TRAVELER };

export function calcEarnPointsAmount(travelerCount: number): number {
  return travelerCount * POINTS_PER_TRAVELER;
}

export function calcGiftPackageWonValue(travelerCount: number): number {
  return travelerCount * GIFT_WON_VALUE_PER_TRAVELER;
}

export function parseTravelerCount(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < MIN_TRAVELER_COUNT || n > MAX_TRAVELER_COUNT) return null;
  return n;
}
