export type TabLike = {
  id?: number;
  index?: number;
  openerTabId?: number;
};

/**
 * openerTabId 우선, 동일 창에서 현재 탭 왼쪽(낮은 index) 탭 순으로 부모 후보 ID 반환
 */
export function resolveParentTabCandidates(
  childTab: TabLike,
  siblingTabs: TabLike[],
  mappedParentId?: number | null,
): number[] {
  const childId = childTab.id;
  const ids: number[] = [];

  if (mappedParentId && mappedParentId > 0) ids.push(mappedParentId);
  if (childTab.openerTabId && childTab.openerTabId > 0) ids.push(childTab.openerTabId);

  const childIndex = childTab.index ?? 0;
  const leftTabs = siblingTabs
    .filter((t) => t.id != null && t.id !== childId && (t.index ?? 0) < childIndex)
    .sort((a, b) => (b.index ?? 0) - (a.index ?? 0));

  for (const tab of leftTabs) {
    if (tab.id != null) ids.push(tab.id);
  }

  return [...new Set(ids)];
}

export function isHanatourSearchPageUrl(url: string): boolean {
  const href = url.toLowerCase();
  if (href.includes("/all-search")) return true;
  if (href.includes("allsearchtab=package")) return true;
  if (href.includes("/search")) return true;
  if (/chpc0pkg\d+m\d+/i.test(href) && !href.includes("/trp/pkg/")) return true;
  return false;
}

export function isHanatourDetailPageUrl(url: string): boolean {
  const href = url.toLowerCase();
  if (href.includes("/trp/pkg/")) return true;
  try {
    const params = new URL(href, "https://www.hanatour.com").searchParams;
    const pkgCd = params.get("pkgcd") || params.get("pkgCd");
    const depDay = params.get("depday") || params.get("depDay");
    return Boolean(pkgCd && depDay);
  } catch {
    return false;
  }
}
