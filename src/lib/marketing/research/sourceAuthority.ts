/** Official status is an explicit declaration, independent of source type or authority tier. */
export function isOfficialResearchSource(source: { isOfficial?: boolean } | null | undefined): boolean {
  return source?.isOfficial === true;
}
