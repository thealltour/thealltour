"use client";

import Link from "next/link";
import { buildAdminLandingEditHref } from "@/components/admin/landings/adminLandings.constants";
import type { LandingGenerationCandidate } from "@/types/adminLanding";

type Props = {
  items: LandingGenerationCandidate[];
  selectedKeys: Set<string>;
  onToggle: (key: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
};

function candidateKey(item: LandingGenerationCandidate): string {
  return `${item.taxonomyType}:${item.taxonomyId}`;
}

export default function AdminLandingGenerationTable({ items, selectedKeys, onToggle, onToggleAll }: Props) {
  const selectableItems = items.filter((item) => !item.isAlreadyGenerated);
  const allSelected =
    selectableItems.length > 0 && selectableItems.every((item) => selectedKeys.has(candidateKey(item)));

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <table className="min-w-full divide-y divide-[var(--border)] text-sm">
        <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)]">
          <tr>
            <th className="px-3 py-2 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onToggleAll(e.target.checked)}
                aria-label="전체 선택"
              />
            </th>
            <th className="px-3 py-2 text-left">구분</th>
            <th className="px-3 py-2 text-left">taxonomy</th>
            <th className="px-3 py-2 text-left">slug</th>
            <th className="px-3 py-2 text-right">연결 상품 수</th>
            <th className="px-3 py-2 text-left">제안 랜딩 제목</th>
            <th className="px-3 py-2 text-left">제안 slug</th>
            <th className="px-3 py-2 text-left">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
          {items.map((item) => {
            const key = candidateKey(item);
            return (
              <tr key={key}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(key)}
                    disabled={item.isAlreadyGenerated}
                    onChange={(e) => onToggle(key, e.target.checked)}
                    aria-label={`${item.taxonomyName} 선택`}
                  />
                </td>
                <td className="px-3 py-2">{item.taxonomyType === "destination" ? "지역" : "테마"}</td>
                <td className="px-3 py-2">{item.taxonomyName}</td>
                <td className="px-3 py-2 font-mono text-xs">{item.taxonomySlug}</td>
                <td className="px-3 py-2 text-right">{item.productCount}</td>
                <td className="px-3 py-2">{item.suggestedTitle}</td>
                <td className="px-3 py-2 font-mono text-xs">{item.suggestedSlug}</td>
                <td className="px-3 py-2">
                  {item.isAlreadyGenerated ? (
                    item.existingLandingId ? (
                      <Link
                        href={buildAdminLandingEditHref(item.existingLandingId)}
                        className="text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
                      >
                        기존 랜딩 있음
                      </Link>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">이미 생성됨</span>
                    )
                  ) : (
                    <span className="text-xs text-emerald-600">생성 가능</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
