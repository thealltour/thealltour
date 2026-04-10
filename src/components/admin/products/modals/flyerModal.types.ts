import type { Product } from "@/types/product";
import type { FlyerPersistedBootstrap } from "@/lib/flyers/flyer.types";

export type {
  FlyerSectionKey,
  FlyerSectionToggles,
  FlyerEditableFields,
  FlyerDraftState,
  FlyerOutfitChecklistItem,
  FlyerOutfitDraftState,
  FlyerWeatherDay,
  FlyerWeatherDraftState,
} from "@/lib/flyers/flyer.types";

export { FLYER_SECTION_KEYS, FLYER_SECTION_LABELS } from "@/lib/flyers/flyer.types";

export type FlyerGenerateModalProps = {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  showToast?: (kind: "success" | "error" | "warning", message: string) => void;
  /** /theall_manager_only/flyers/[id] 등에서 저장본으로 열 때 */
  persistedBootstrap?: FlyerPersistedBootstrap | null;
};
