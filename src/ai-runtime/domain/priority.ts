export const RUNTIME_PRIORITIES = ["background", "normal", "high", "critical"] as const;

export type RuntimePriority = (typeof RUNTIME_PRIORITIES)[number];

/** Relative weights for a future scheduler — not P0/P1 labels. */
export const PRIORITY_WEIGHT: Record<RuntimePriority, number> = {
  background: 10,
  normal: 50,
  high: 80,
  critical: 100,
};
