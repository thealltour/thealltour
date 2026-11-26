/**
 * 해시만 바꾼 history 항목은 App Router의 상세→뒤로가기와 어긋날 수 있다.
 * 같은 페이지 스크롤은 history를 늘리지 않고, 상세 이동 전에는 해시를 제거한다.
 */

export function scrollToElementId(
  elementId: string,
  behavior: ScrollBehavior = "smooth",
): boolean {
  if (typeof document === "undefined") return false;
  const id = elementId.replace(/^#/, "").trim();
  if (!id) return false;
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior, block: "start" });
  return true;
}

/** `#section` → section. 해시가 아니면 null */
export function elementIdFromHashHref(href: string | null | undefined): string | null {
  const raw = href?.trim() ?? "";
  if (!raw.startsWith("#")) return null;
  const id = raw.slice(1).trim();
  return id || null;
}

/**
 * 현재 주소의 해시만 제거하고 history 항목은 교체(replace)한다.
 * 달력 등에서 `/products/[id]`로 나가기 직전에 호출한다.
 */
export function stripLocationHashFromHistory(): void {
  if (typeof window === "undefined") return;
  if (!window.location.hash) return;
  const { pathname, search } = window.location;
  window.history.replaceState(window.history.state, "", `${pathname}${search}`);
}
