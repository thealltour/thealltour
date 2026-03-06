"use client";

import { setDragData } from "./modetourImageDnd";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

export type UnassignedImagePoolProps = {
  imageUrls: string[];
  title?: string;
  className?: string;
};

export function UnassignedImagePool({
  imageUrls,
  title,
  className = "",
}: UnassignedImagePoolProps) {
  const count = imageUrls.length;

  const handleDragStart = (url: string) => (e: React.DragEvent) => {
    setDragData(e.dataTransfer, { source: "unassigned", url });
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className={`rounded-lg border border-slate-600 bg-slate-900/50 p-4 ${className}`}>
      <h3 className="mb-3 text-sm font-semibold text-slate-200">
        {title ?? `미할당 이미지 (${count}장)`}
      </h3>
      {count === 0 ? (
        <p className="rounded border border-dashed border-slate-600 bg-slate-800/50 px-4 py-8 text-center text-xs text-slate-400">
          미할당 이미지가 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {imageUrls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              draggable
              onDragStart={handleDragStart(url)}
              className="group relative aspect-square cursor-grab overflow-hidden rounded-lg border border-slate-600 bg-slate-800 active:cursor-grabbing hover:border-slate-500 hover:ring-2 hover:ring-[var(--primary)]/40 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              title="드래그하여 이벤트에 배치"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.currentTarget.click();
              }}
            >
              <img
                src={normalizeProductImageUrl(url)}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.background = "var(--surface-muted)";
                }}
              />
              <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                드래그
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
