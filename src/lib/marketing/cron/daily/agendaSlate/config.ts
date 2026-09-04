export const DEFAULT_AGENDA_SLATE_SIZE = 6;
export const MIN_AGENDA_SLATE_SIZE = 5;
export const MAX_AGENDA_SLATE_SIZE = 8;

/** Clamp slate size to the safe 5–8 review window (default 6). */
export function resolveAgendaSlateTargetSize(raw?: number | null): number {
  if (raw == null || !Number.isFinite(raw)) return DEFAULT_AGENDA_SLATE_SIZE;
  const n = Math.trunc(raw);
  if (n < MIN_AGENDA_SLATE_SIZE) return MIN_AGENDA_SLATE_SIZE;
  if (n > MAX_AGENDA_SLATE_SIZE) return MAX_AGENDA_SLATE_SIZE;
  return n;
}
