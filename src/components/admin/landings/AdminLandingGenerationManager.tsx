"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLandingGenerationFilters from "@/components/admin/landings/AdminLandingGenerationFilters";
import AdminLandingGenerationTable from "@/components/admin/landings/AdminLandingGenerationTable";
import {
  generateLandingsFromTaxonomyClient,
  listLandingGenerationCandidatesClient,
} from "@/components/admin/landings/api/adminLandings.client";
import {
  ADMIN_LANDINGS_ROUTE,
  buildAdminLandingEditHref,
} from "@/components/admin/landings/adminLandings.constants";
import type { LandingGenerationCandidate, LandingGenerationResult } from "@/types/adminLanding";

function candidateKey(item: LandingGenerationCandidate): string {
  return `${item.taxonomyType}:${item.taxonomyId}`;
}

export default function AdminLandingGenerationManager() {
  const router = useRouter();
  const [taxonomyType, setTaxonomyType] = useState<"all" | "destination" | "theme">("all");
  const [onlyNotGenerated, setOnlyNotGenerated] = useState(true);
  const [items, setItems] = useState<LandingGenerationCandidate[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LandingGenerationResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await listLandingGenerationCandidatesClient({
        taxonomyType,
        alreadyGenerated: onlyNotGenerated ? false : undefined,
      });
      setItems(response.items);
      setSelectedKeys(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "후보 목록을 불러오지 못했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [onlyNotGenerated, taxonomyType]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedKeys.has(candidateKey(item)) && !item.isAlreadyGenerated),
    [items, selectedKeys],
  );

  function formatReason(reason?: string) {
    switch (reason) {
      case "ALREADY_EXISTS":
        return "이미 생성된 랜딩이 있어 건너뜀";
      case "SLUG_CONFLICT":
        return "slug 충돌로 건너뜀";
      case "CANDIDATE_NOT_FOUND":
        return "후보를 찾을 수 없음";
      default:
        return reason ?? "오류";
    }
  }

  async function handleGenerate() {
    if (selectedItems.length === 0) return;
    setSubmitting(true);
    setError("");
    try {
      const generationResult = await generateLandingsFromTaxonomyClient(
        selectedItems.map((item) => ({
          taxonomyId: item.taxonomyId,
          taxonomyType: item.taxonomyType,
        })),
      );
      setResult(generationResult);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "초안 생성에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-5">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--text-primary)]">taxonomy 기반 랜딩 초안 생성</p>
        <p className="text-xs text-[var(--text-muted)]">
          상품이 연결된 지역/테마 taxonomy를 기준으로 랜딩 draft를 생성합니다.
        </p>
      </div>

      <AdminLandingGenerationFilters
        taxonomyType={taxonomyType}
        onlyNotGenerated={onlyNotGenerated}
        onTaxonomyTypeChange={setTaxonomyType}
        onOnlyNotGeneratedChange={setOnlyNotGenerated}
        disabled={loading || submitting}
      />

      {loading ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
          후보 taxonomy를 불러오는 중입니다...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
          조건에 맞는 후보가 없습니다.
        </div>
      ) : (
        <AdminLandingGenerationTable
          items={items}
          selectedKeys={selectedKeys}
          onToggle={(key, checked) => {
            setSelectedKeys((prev) => {
              const next = new Set(prev);
              if (checked) next.add(key);
              else next.delete(key);
              return next;
            });
          }}
          onToggleAll={(checked) => {
            if (!checked) {
              setSelectedKeys(new Set());
              return;
            }
            const next = new Set(
              items.filter((item) => !item.isAlreadyGenerated).map((item) => candidateKey(item)),
            );
            setSelectedKeys(next);
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[var(--text-muted)]">
          선택 {selectedItems.length}건 / 전체 {items.length}건
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(ADMIN_LANDINGS_ROUTE)}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          >
            목록으로
          </button>
          <button
            type="button"
            disabled={selectedItems.length === 0 || submitting}
            onClick={() => {
              void handleGenerate();
            }}
            className="rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "생성 중..." : "선택 항목 draft 생성"}
          </button>
        </div>
      </div>

      {result ? (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--text-primary)]">생성 결과</p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
            <span>생성 성공 {result.created.length}건</span>
            <span>건너뜀 {result.skipped.length}건</span>
            <span>실패 {result.failed.length}건</span>
          </div>
          <div className="space-y-1 text-xs text-[var(--text-secondary)]">
            {result.created.map((entry) => (
              <p key={`created-${entry.taxonomyType}-${entry.taxonomyId}`}>
                생성: {entry.taxonomyName}{" "}
                {entry.landingId ? (
                  <Link href={buildAdminLandingEditHref(entry.landingId)} className="text-[var(--primary)] underline">
                    편집으로 이동
                  </Link>
                ) : null}
              </p>
            ))}
            {result.skipped.map((entry) => (
              <p key={`skipped-${entry.taxonomyType}-${entry.taxonomyId}`}>
                건너뜀: {entry.taxonomyName} ({formatReason(entry.reason)})
              </p>
            ))}
            {result.failed.map((entry) => (
              <p key={`failed-${entry.taxonomyType}-${entry.taxonomyId}`} className="text-rose-600">
                실패: {entry.taxonomyName} ({formatReason(entry.reason)})
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
