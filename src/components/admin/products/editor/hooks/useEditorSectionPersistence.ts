import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

export const EDITOR_UI_STATE_KEY = (editingId?: string | null) =>
  `admin-product-editor-ui:${editingId ?? "new"}`;

type Params = {
  storageKey: string;
  openSections: Record<string, boolean>;
  setOpenSections: Dispatch<SetStateAction<Record<string, boolean>>>;
  activeSectionId: string | null;
  setActiveSectionId: (v: string) => void;
};

/**
 * 섹션 아코디언 열림 상태 + scroll spy activeSectionId를 sessionStorage에 보관/복원한다.
 * 로드 직후 첫 저장이 기본값으로 덮어쓰지 않도록 한 틱 스킵한다.
 */
export function useEditorSectionPersistence({
  storageKey,
  openSections,
  setOpenSections,
  activeSectionId,
  setActiveSectionId,
}: Params) {
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    skipNextSaveRef.current = true;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) {
        queueMicrotask(() => {
          skipNextSaveRef.current = false;
        });
        return;
      }

      const parsed = JSON.parse(raw) as {
        openSections?: Record<string, boolean>;
        activeSectionId?: string;
      };

      if (parsed.openSections && typeof parsed.openSections === "object") {
        setOpenSections(parsed.openSections);
      }

      if (parsed.activeSectionId && typeof parsed.activeSectionId === "string") {
        setActiveSectionId(parsed.activeSectionId);
      }
    } catch {
      // ignore
    }
    queueMicrotask(() => {
      skipNextSaveRef.current = false;
    });
  }, [storageKey, setOpenSections, setActiveSectionId]);

  useEffect(() => {
    if (skipNextSaveRef.current) return;
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          openSections,
          activeSectionId,
        }),
      );
    } catch {
      // ignore
    }
  }, [storageKey, openSections, activeSectionId]);
}
