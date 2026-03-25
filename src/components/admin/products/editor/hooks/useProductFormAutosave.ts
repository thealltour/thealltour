import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProductFormState } from "@/types/adminProductForm";
import { getStableFormFingerprint } from "@/components/admin/products/editor/adminProductForm.compare";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type UseProductFormAutosaveParams = {
  enabled: boolean;
  form: ProductFormState;
  storageKey: string | null;
  saveDraft: (form: ProductFormState) => void;
  initialSnapshot: ProductFormState | null;
  debounceMs?: number;
  pause?: boolean;
};

export type UseProductFormAutosaveResult = {
  isDirty: boolean;
  autosaveStatus: AutosaveStatus;
  lastSavedAt: number | null;
  resetBaseSnapshot: (next: ProductFormState) => void;
  markSavedNow: (next?: ProductFormState) => void;
};

export function useProductFormAutosave({
  enabled,
  form,
  storageKey,
  saveDraft,
  initialSnapshot,
  debounceMs = 1500,
  pause = false,
}: UseProductFormAutosaveParams): UseProductFormAutosaveResult {
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [baseEpoch, setBaseEpoch] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 로드·복원·베이스 리셋 직후 한 번은 타이머를 돌리지 않음 (불필요한 즉시 저장 방지) */
  const skipAutosaveOnceRef = useRef(true);
  const baseSnapshotRef = useRef<ProductFormState | null>(null);
  const lastSavedAtRef = useRef<number | null>(null);

  useEffect(() => {
    baseSnapshotRef.current =
      initialSnapshot != null ? structuredClone(initialSnapshot) : null;
    skipAutosaveOnceRef.current = true;
    setBaseEpoch((e) => e + 1);
  }, [initialSnapshot]);

  const isDirty = useMemo(() => {
    if (!enabled) return false;
    const base = baseSnapshotRef.current;
    if (!base) return false;
    return getStableFormFingerprint(form) !== getStableFormFingerprint(base);
  }, [enabled, form, baseEpoch]);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  const resetBaseSnapshot = useCallback((next: ProductFormState) => {
    baseSnapshotRef.current = structuredClone(next);
    setAutosaveStatus("idle");
    skipAutosaveOnceRef.current = true;
    setBaseEpoch((e) => e + 1);
  }, []);

  const markSavedNow = useCallback(
    (next?: ProductFormState) => {
      baseSnapshotRef.current = structuredClone(next ?? form);
      const now = Date.now();
      lastSavedAtRef.current = now;
      setLastSavedAt(now);
      setAutosaveStatus("saved");
      setBaseEpoch((e) => e + 1);
    },
    [form],
  );

  useEffect(() => {
    if (!enabled || !storageKey) {
      clearTimer();
      setAutosaveStatus("idle");
      return;
    }

    if (pause) {
      clearTimer();
      return;
    }

    if (skipAutosaveOnceRef.current) {
      skipAutosaveOnceRef.current = false;
      clearTimer();
      if (baseSnapshotRef.current && !isDirty) {
        setAutosaveStatus((prev) => {
          if (prev === "saving") return prev;
          return lastSavedAtRef.current ? "saved" : "idle";
        });
      }
      return;
    }

    if (!baseSnapshotRef.current) {
      clearTimer();
      return;
    }

    if (!isDirty) {
      clearTimer();
      setAutosaveStatus((prev) => {
        if (prev === "saving") return prev;
        return lastSavedAtRef.current ? "saved" : "idle";
      });
      return;
    }

    setAutosaveStatus("dirty");
    clearTimer();

    timerRef.current = setTimeout(() => {
      try {
        setAutosaveStatus("saving");
        saveDraft(form);
        baseSnapshotRef.current = structuredClone(form);
        const now = Date.now();
        lastSavedAtRef.current = now;
        setLastSavedAt(now);
        setAutosaveStatus("saved");
        setBaseEpoch((e) => e + 1);
      } catch {
        setAutosaveStatus("error");
      } finally {
        timerRef.current = null;
      }
    }, debounceMs);

    return clearTimer;
  }, [enabled, storageKey, pause, isDirty, form, debounceMs, saveDraft]);

  useEffect(() => () => clearTimer(), []);

  return {
    isDirty,
    autosaveStatus,
    lastSavedAt,
    resetBaseSnapshot,
    markSavedNow,
  };
}
