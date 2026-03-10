"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import type { ProductTaxonomyWithUsage } from "@/types/productTaxonomy";
import { fetchAdminProductTaxonomy } from "@/components/admin/products/api/adminProductTaxonomy.client";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import { parseHomeRegionCardIds } from "@/lib/siteSettings";
import type { SiteSettings } from "@/lib/siteSettings";
import { cn } from "@/lib/cn";

const FALLBACK_IMAGE = "https://picsum.photos/seed/thealltour-card/400/250";
const MAX_HOME_CARDS = 8;

export default function AdminHomeRegionCardsManager() {
  const [destinations, setDestinations] = useState<ProductTaxonomyWithUsage[]>([]);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [addSelectValue, setAddSelectValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { showToast } = useAdminToast();

  const loadData = useCallback(async () => {
    setErrorMessage("");
    setIsLoading(true);
    try {
      const [destList, settingsRes] = await Promise.all([
        fetchAdminProductTaxonomy({ taxonomy_type: "destination" }),
        fetch("/api/admin/site-settings", { cache: "no-store" }),
      ]);
      const activeDest = (destList ?? []).filter((d) => d.is_active);
      setDestinations(activeDest);

      const settingsData = (await settingsRes.json()) as Record<string, string> | { message?: string };
      if (settingsRes.ok && settingsData && !("message" in settingsData)) {
        const settings = { home_region_card_ids: (settingsData as Record<string, string>).home_region_card_ids ?? "[]" } as Pick<SiteSettings, "home_region_card_ids">;
        const ids = parseHomeRegionCardIds(settings);
        setOrderedIds(ids.slice(0, MAX_HOME_CARDS));
      } else {
        setOrderedIds([]);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "데이터를 불러오는 중 오류가 발생했습니다.");
      setDestinations([]);
      setOrderedIds([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const move = (index: number, dir: "up" | "down") => {
    const next = [...orderedIds];
    const target = dir === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrderedIds(next);
  };

  const remove = (index: number) => {
    setOrderedIds((prev) => prev.filter((_, i) => i !== index));
    setAddSelectValue("");
  };

  const addId = (id: string) => {
    if (!id || orderedIds.includes(id) || orderedIds.length >= MAX_HOME_CARDS) return;
    setOrderedIds((prev) => [...prev, id]);
    setAddSelectValue("");
  };

  const save = async () => {
    setIsSaving(true);
    setErrorMessage("");
    try {
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ home_region_card_ids: JSON.stringify(orderedIds) }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        throw new Error(data?.message ?? "저장에 실패했습니다.");
      }
      showToast("success", "메인 지역카드가 저장되었습니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "저장에 실패했습니다.";
      setErrorMessage(msg);
      showToast("error", msg);
    } finally {
      setIsSaving(false);
    }
  };

  const idToDest = new Map(destinations.map((d) => [d.id, d]));
  const selectedSet = new Set(orderedIds);
  const availableToAdd = destinations.filter((d) => !selectedSet.has(d.id));
  const canAdd = orderedIds.length < MAX_HOME_CARDS && availableToAdd.length > 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center gap-2 text-[var(--text-muted)]">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>지역 목록을 불러오는 중...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">메인 홈 지역카드 (최대 8개)</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          메인 페이지 &quot;어디로 떠나고 싶으신가요?&quot; 섹션에 노출할 지역을 카테고리/테마 관리에 등록된 지역 중에서 선택해 추가하고, 순서를 조정하거나 삭제할 수 있습니다. 최대 8개까지 노출됩니다.
        </p>
      </div>

      {errorMessage ? (
        <p className="rounded-lg bg-[var(--danger)]/10 px-4 py-2 text-sm text-[var(--danger)]">
          {errorMessage}
        </p>
      ) : null}

      {/* 추가: 카테고리/테마 관리 지역 중 선택 */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <span className="text-sm font-medium text-[var(--text-primary)]">지역 추가</span>
        <select
          value={addSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            setAddSelectValue(v);
            if (v) addId(v);
          }}
          disabled={!canAdd}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)] disabled:opacity-50"
          aria-label="노출할 지역 선택"
        >
          <option value="">
            {orderedIds.length >= MAX_HOME_CARDS
              ? "최대 8개까지 추가 가능"
              : availableToAdd.length === 0
                ? "추가 가능한 지역 없음"
                : "선택하세요"}
          </option>
          {availableToAdd.map((d) => (
            <option key={d.id} value={d.id}>
              {d.card_title?.trim() || d.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-[var(--text-muted)]">
          카테고리/테마 관리에 등록된 지역만 선택할 수 있습니다. ({orderedIds.length}/{MAX_HOME_CARDS})
        </p>
      </div>

      {/* 메인 노출 목록: 최대 8개, 순서 변경·삭제 */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">메인 지역카드에 노출할 지역</h3>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {orderedIds.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <p className="text-sm text-[var(--text-muted)]">아직 선택된 지역이 없습니다.</p>
              <p className="text-xs text-[var(--text-muted)]">위에서 지역을 선택해 추가하세요. 비워두면 메인에 허브 노출 지역이 기본 순서로 표시됩니다.</p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {orderedIds.map((id, index) => {
                const dest = idToDest.get(id);
                if (!dest) return null;
                const imageUrl = dest.card_image_url?.trim() || FALLBACK_IMAGE;
                const title = dest.card_title?.trim() || dest.name;
                return (
                  <li
                    key={dest.id}
                    className="flex items-center gap-4 p-4"
                  >
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => move(index, "up")}
                        disabled={index === 0}
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
                        aria-label="위로"
                      >
                        <ChevronUp className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, "down")}
                        disabled={index === orderedIds.length - 1}
                        className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:opacity-40"
                        aria-label="아래로"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </div>
                    <span className="w-8 shrink-0 text-sm font-medium text-[var(--text-muted)]">
                      {index + 1}
                    </span>
                    <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-muted)]">
                      <Image
                        src={imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="96px"
                        unoptimized={imageUrl.startsWith("data:") || imageUrl.includes("picsum")}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[var(--text-primary)]">{title}</p>
                      {dest.slug ? (
                        <p className="truncate text-xs text-[var(--text-muted)]">/{dest.slug}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                      aria-label="메인 노출에서 제거"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={isSaving}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition",
            "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 disabled:opacity-50",
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            "저장"
          )}
        </button>
        <p className="text-sm text-[var(--text-muted)]">
          저장 후 메인 페이지에 반영됩니다. 카드 이미지·제목은 카테고리/테마 관리에서 수정하세요.
        </p>
      </div>
    </div>
  );
}
