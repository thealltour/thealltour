"use client";

import { useState } from "react";
import Image from "next/image";
import RewardExchangeModal, { type CatalogItem } from "./RewardExchangeModal";

type Props = {
  catalog: CatalogItem[];
};

export default function RewardsCatalogClient({ catalog }: Props) {
  const [modalItem, setModalItem] = useState<CatalogItem | null>(null);

  return (
    <>
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">교환 가능 경품</h2>
        {catalog.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">등록된 경품이 없습니다.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((item) => {
              const cost = Number(item.point_cost ?? 0);
              const hasStock = item.stock === null || item.stock > 0;
              return (
                <li
                  key={item.id}
                  className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] overflow-hidden"
                >
                  {item.image_url ? (
                    <div className="relative h-40 w-full bg-[var(--border)]">
                      <Image
                        src={item.image_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                  ) : (
                    <div className="h-24 w-full bg-[var(--border)]" />
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-medium text-[var(--text-primary)]">{item.title}</p>
                    {item.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{item.description}</p>
                    )}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--primary)]">{cost.toLocaleString()}P</span>
                      {item.stock != null && (
                        <span className={`text-xs ${hasStock ? "text-[var(--text-muted)]" : "text-[var(--danger)]"}`}>
                          {hasStock ? `재고 ${item.stock}개` : "재고 없음"}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalItem(item)}
                      disabled={!item.is_active || !hasStock}
                      className="btn-admin-primary mt-3 w-full disabled:opacity-50"
                    >
                      교환 신청
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {modalItem && (
        <RewardExchangeModal
          item={modalItem}
          onClose={() => setModalItem(null)}
          onSuccess={() => {}}
        />
      )}
    </>
  );
}
