/** Overlay focus trap용 — dependency 없이 Drawer/Modal 공유 */

export const OVERLAY_FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function getOverlayFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(OVERLAY_FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled") && el.getAttribute("aria-hidden") !== "true",
  );
}

/** Tab / Shift+Tab을 root 안에서 순환. 처리했으면 true */
export function trapOverlayTabKey(event: KeyboardEvent, root: HTMLElement): boolean {
  if (event.key !== "Tab") return false;
  const focusables = getOverlayFocusableElements(root);
  if (focusables.length === 0) return false;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (event.shiftKey && (active === first || !root.contains(active))) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (active === last || !root.contains(active))) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function restoreFocus(el: HTMLElement | null | undefined): void {
  if (!el || typeof el.focus !== "function") return;
  try {
    if (!el.isConnected) return;
    el.focus();
  } catch {
    // unmounted / non-focusable — ignore
  }
}
