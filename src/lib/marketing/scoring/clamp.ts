export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function weightsSumToOne(weights: Record<string, number>, epsilon = 1e-9): boolean {
  const sum = Object.values(weights).reduce((acc, weight) => acc + weight, 0);
  return Math.abs(sum - 1) <= epsilon;
}
