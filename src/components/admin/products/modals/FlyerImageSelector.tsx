"use client";

import Image from "next/image";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { Product } from "@/types/product";
import { FLYER_MAX_GALLERY_IMAGES } from "@/lib/flyers/flyer.types";
import { collectFlyerCandidateImageUrls } from "./flyerModal.utils";

function thumbUnoptimized(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:");
}

type FlyerImageSelectorProps = {
  product: Product;
  selected: string[];
  onChange: (urls: string[]) => void;
  disabled?: boolean;
};

export function FlyerImageSelector({ product, selected, onChange, disabled }: FlyerImageSelectorProps) {
  const candidates = collectFlyerCandidateImageUrls(product);

  const toggle = (url: string) => {
    if (disabled) return;
    const i = selected.indexOf(url);
    if (i >= 0) {
      onChange(selected.filter((u) => u !== url));
      return;
    }
    if (selected.length >= FLYER_MAX_GALLERY_IMAGES) return;
    onChange([...selected, url]);
  };

  const move = (index: number, dir: -1 | 1) => {
    if (disabled) return;
    const j = index + dir;
    if (j < 0 || j >= selected.length) return;
    const next = [...selected];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-[var(--text-muted)]">
        최대 {FLYER_MAX_GALLERY_IMAGES}장 · 클릭으로 선택/해제 · 순서는 화살표로 조정
      </p>

      {selected.length > 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/40 p-2">
          <p className="mb-2 text-[10px] font-medium text-[var(--text-muted)]">선택됨 (미리보기 순서)</p>
          <ul className="flex flex-wrap gap-2">
            {selected.map((url, idx) => (
              <li
                key={`${url}-${idx}`}
                className="relative flex w-[4.5rem] flex-col items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] p-1"
              >
                <span className="absolute left-0.5 top-0.5 z-[1] flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[9px] font-bold text-[var(--on-primary)]">
                  {idx + 1}
                </span>
                <div className="relative mt-3 h-12 w-full overflow-hidden rounded bg-neutral-100">
                  <Image
                    src={url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="72px"
                    unoptimized={thumbUnoptimized(url)}
                  />
                </div>
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    disabled={disabled || idx === 0}
                    onClick={() => move(idx, -1)}
                    className="rounded border border-[var(--border)] p-0.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] disabled:opacity-30"
                    aria-label="위로"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || idx >= selected.length - 1}
                    onClick={() => move(idx, 1)}
                    className="rounded border border-[var(--border)] p-0.5 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] disabled:opacity-30"
                    aria-label="아래로"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-4 text-center text-xs text-[var(--text-muted)]">
          선택된 이미지가 없습니다. 아래에서 이미지를 눌러 추가하세요.
        </p>
      )}

      <div>
        <p className="mb-2 text-[10px] font-medium text-[var(--text-muted)]">상품 이미지</p>
        {candidates.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">등록된 이미지가 없습니다.</p>
        ) : (
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {candidates.map((url) => {
              const sel = selected.indexOf(url);
              const on = sel >= 0;
              const atMax = !on && selected.length >= FLYER_MAX_GALLERY_IMAGES;
              return (
                <li key={url}>
                  <button
                    type="button"
                    disabled={disabled || atMax}
                    onClick={() => toggle(url)}
                    className={`group relative block w-full overflow-hidden rounded-lg border-2 transition-colors ${
                      on
                        ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/25"
                        : atMax
                          ? "cursor-not-allowed border-[var(--border)] opacity-50"
                          : "border-transparent ring-1 ring-[var(--border)] hover:border-[var(--primary)]/40"
                    }`}
                  >
                    <div className="relative aspect-square w-full bg-neutral-100">
                      <Image
                        src={url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="80px"
                        unoptimized={thumbUnoptimized(url)}
                      />
                      {on ? (
                        <span className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] shadow">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      ) : null}
                      {on ? (
                        <span className="absolute bottom-0.5 left-0.5 rounded bg-black/55 px-1 py-px text-[9px] font-semibold text-white">
                          {sel + 1}
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
