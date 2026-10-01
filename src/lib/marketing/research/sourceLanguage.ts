import type { ResearchSourceSemantics } from "@/lib/marketing/research/types/sourceSemantics";

/** Registry definition (`semantics`) or persisted row (`metadata.semantics`). */
export type ResearchSourceLanguagesCarrier =
  | { semantics: ResearchSourceSemantics }
  | { metadata?: Record<string, unknown> | null }
  | null
  | undefined;

/** Signal language when neither the item nor the source resolves one. */
export const UNRESOLVED_SIGNAL_LANGUAGE = "en";

/** Missing or malformed `languages.primary` resolves to null, which never produces a fallback. */
export function resolveSourcePrimaryLanguage(source: ResearchSourceLanguagesCarrier): string | null {
  if (!source) return null;
  const semantics: unknown = "semantics" in source ? source.semantics : source.metadata?.semantics;
  if (!semantics || typeof semantics !== "object") return null;
  const languages = (semantics as { languages?: unknown }).languages;
  if (!languages || typeof languages !== "object") return null;
  const primary = (languages as { primary?: unknown }).primary;
  return typeof primary === "string" && primary.trim().length >= 2 ? primary : null;
}

/**
 * Legacy `language` (source row column and compatibility collector config) for a registry
 * definition. Declared only as `semantics.languages.primary`; passed through without validation.
 */
export function deriveLegacySourceLanguage(source: { semantics: ResearchSourceSemantics }): string {
  return source.semantics.languages.primary;
}

export type ResolvedSignalLanguage = { language: string; languageFallbackApplied: boolean };

/**
 * Terminal language fallback. Any language the item or its collector supplied wins; only an
 * unresolved (null/undefined) language takes the source's `languages.primary`. Locale is not
 * derived here.
 */
export function resolveSignalLanguage(
  language: string | null | undefined,
  source: ResearchSourceLanguagesCarrier,
): ResolvedSignalLanguage {
  if (language !== null && language !== undefined) return { language, languageFallbackApplied: false };
  const primary = resolveSourcePrimaryLanguage(source);
  if (primary === null) return { language: UNRESOLVED_SIGNAL_LANGUAGE, languageFallbackApplied: false };
  return { language: primary, languageFallbackApplied: true };
}
