/**
 * Instagram carousel cardId aliases.
 *
 * SVP / publishable Instagram use `card-01`; some persisted media-briefs still use `card_1`.
 * Renderer lookups must accept both so shared-visual injection is not silently dropped.
 */

export function instagramCardIdAliases(cardId: string): string[] {
  const raw = cardId.trim();
  if (!raw) return [];
  const aliases = new Set<string>([raw]);
  const dash = /^card-(\d+)$/i.exec(raw);
  const under = /^card_(\d+)$/i.exec(raw);
  const n = dash ? Number(dash[1]) : under ? Number(under[1]) : NaN;
  if (!Number.isFinite(n) || n < 1) return [...aliases];
  // Canonical SVP form + legacy media-brief form only.
  aliases.add(`card-${String(n).padStart(2, "0")}`);
  aliases.add(`card_${n}`);
  return [...aliases];
}

export function lookupByInstagramCardIdAlias<T>(
  map: Record<string, T> | null | undefined,
  cardId: string,
): T | undefined {
  if (!map) return undefined;
  for (const key of instagramCardIdAliases(cardId)) {
    if (!Object.prototype.hasOwnProperty.call(map, key)) continue;
    const value = map[key];
    if (value != null && value !== "") return value;
  }
  return undefined;
}
