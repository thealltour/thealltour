"use client";

import { createRoot } from "react-dom/client";
import { FlyerLongformPreview } from "@/components/admin/products/modals/FlyerLongformPreview";
import type { Product } from "@/types/product";
import type { FlyerDraftState } from "@/lib/flyers/flyer.types";
import { exportFlyerToPng } from "@/lib/flyers/exportFlyerToPng";
import { waitForImages } from "@/lib/flyers/waitForImages";

function flushLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * 화면 미리보기(next/image)와 분리된 클론을 off-screen에 마운트한 뒤 PNG로보냅니다.
 * `exportFlyerToPng`의 selector(`[data-flyer-document]`)는 그대로 사용합니다.
 */
export async function exportFlyerLongformDraftToPng(
  draft: FlyerDraftState,
  fileName: string,
  product?: Product | null,
): Promise<void> {
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.pointerEvents = "none";
  document.body.appendChild(container);

  const root = createRoot(container);
  try {
    root.render(<FlyerLongformPreview draft={draft} product={product ?? null} exportMode />);
    await flushLayout();
    await waitForImages(container);
    if (process.env.NODE_ENV === "development") {
      const imgs = container.querySelectorAll("img");
      console.info("[flyer png export] img count:", imgs.length);
      imgs.forEach((el, i) => {
        if (i < 4) console.info("[flyer png export] img src sample:", el.getAttribute("src")?.slice(0, 140));
      });
    }
    await exportFlyerToPng(container, fileName);
  } finally {
    root.unmount();
    container.remove();
  }
}
