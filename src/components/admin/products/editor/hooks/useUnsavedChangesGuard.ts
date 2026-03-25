import { useCallback, useEffect, useRef } from "react";

const DEFAULT_MESSAGE =
  "저장되지 않은 변경사항이 있습니다. 정말 이동하시겠습니까?";

type RuntimeApi = {
  shouldBlock: () => boolean;
  markSafeNavigation: () => void;
  message: string;
};

let runtime: RuntimeApi | null = null;

/** SubHeader·Sidebar 등에서 router.push 직전에 호출 */
export function confirmAdminProductUnsavedIfNeeded(): boolean {
  if (!runtime) return true;
  if (!runtime.shouldBlock()) return true;
  if (!window.confirm(runtime.message)) return false;
  runtime.markSafeNavigation();
  return true;
}

type Params = {
  enabled: boolean;
  isDirty: boolean;
  message?: string;
};

export function useUnsavedChangesGuard({
  enabled,
  isDirty,
  message = DEFAULT_MESSAGE,
}: Params) {
  const isSafeNavigationRef = useRef(false);
  const enabledRef = useRef(enabled);
  const isDirtyRef = useRef(isDirty);
  const messageRef = useRef(message);

  enabledRef.current = enabled;
  isDirtyRef.current = isDirty;
  messageRef.current = message;

  const markSafeNavigation = useCallback(() => {
    isSafeNavigationRef.current = true;
  }, []);

  const resetSafeNavigation = useCallback(() => {
    isSafeNavigationRef.current = false;
  }, []);

  useEffect(() => {
    runtime = {
      shouldBlock: () => enabledRef.current && isDirtyRef.current,
      markSafeNavigation,
      message: messageRef.current,
    };
    return () => {
      runtime = null;
    };
  }, [enabled, isDirty, markSafeNavigation, message]);

  useEffect(() => {
    if (!enabled) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current || isSafeNavigationRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, isDirty]);

  useEffect(() => {
    if (!enabled) return;

    function handleClick(e: MouseEvent) {
      if (!isDirtyRef.current || isSafeNavigationRef.current) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

      const confirmed = window.confirm(messageRef.current);
      if (!confirmed) {
        e.preventDefault();
        e.stopPropagation();
      } else {
        isSafeNavigationRef.current = true;
      }
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [enabled, isDirty, message]);

  return {
    markSafeNavigation,
    resetSafeNavigation,
  };
}
