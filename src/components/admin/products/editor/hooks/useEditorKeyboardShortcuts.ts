import { useEffect } from "react";

type Params = {
  /** 편집기 비활성(목록 등)일 때 리스너 미등록 */
  enabled?: boolean;
  onSave: () => void;
  onTempSave: () => void;
  isSaving?: boolean;
  isSavingDraft?: boolean;
};

export function useEditorKeyboardShortcuts({
  enabled = true,
  onSave,
  onTempSave,
  isSaving,
  isSavingDraft,
}: Params) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    function handleKeyDown(e: KeyboardEvent) {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;

      if (!isCmdOrCtrl) return;

      if (e.key.toLowerCase() === "s" && !e.shiftKey) {
        e.preventDefault();
        if (!isSaving) onSave();
      }

      if (e.key.toLowerCase() === "s" && e.shiftKey) {
        e.preventDefault();
        if (!isSavingDraft) onTempSave();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, onSave, onTempSave, isSaving, isSavingDraft]);
}
