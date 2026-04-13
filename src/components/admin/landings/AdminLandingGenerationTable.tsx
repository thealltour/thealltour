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

function taxonomyTypeLabel(type: LandingGenerationCandidate["taxonomyType"]): string {
  if (type === "destination") return "지역";
  if (type === "theme") return "테마";
  return "상품군";
}

function eligibilityLabel(item: LandingGenerationCandidate): { text: string; className: string } {
  if (item.isPreseedCandidate) {
    return {
      text: "상품 없음(사전 생성 가능)",
      className: "rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200",
    };
  }
  return {
    text: "상품 연결됨",
    className: "rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 ring-1 ring-emerald-200",
  };
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
            <th className="px-3 py-2 text-left">생성 가능 사유</th>
            <th className="px-3 py-2 text-right">연결 상품 수</th>
            <th className="px-3 py-2 text-left">제안 랜딩 제목</th>
            <th className="px-3 py-2 text-left">제안 slug</th>
            <th className="px-3 py-2 text-left">상태</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
          {items.map((item) => {
            const key = candidateKey(item);
            const elig = eligibilityLabel(item);
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
                <td className="px-3 py-2">{taxonomyTypeLabel(item.taxonomyType)}</td>
                <td className="px-3 py-2">{item.taxonomyName}</td>
                <td className="px-3 py-2 font-mono text-xs">{item.taxonomySlug}</td>
                <td className="px-3 py-2">
                  <span className={elig.className}>{elig.text}</span>
                </td>
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
