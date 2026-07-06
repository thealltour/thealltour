"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminConfirm } from "@/components/admin/AdminConfirmProvider";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import {
  ADMIN_MOBILE_GOLF_ADS_NEW_ROUTE,
  buildAdminMobileGolfAdEditHref,
  buildMobileGolfAdPreviewHref,
  deleteMobileGolfAdClient,
  listMobileGolfAdsClient,
  publishMobileGolfAdClient,
  unpublishMobileGolfAdClient,
} from "@/components/admin/mobile-golf-ads/api/mobileGolfAds.client";
import { buildMobileGolfAdPublicUrl } from "@/lib/adminMobileGolfAds/types";
import type { MobileGolfAdLandingListItem } from "@/lib/adminMobileGolfAds/types";

export default function AdminMobileGolfAdManager() {
  const router = useRouter();
  const { showToast } = useAdminToast();
  const { confirm } = useAdminConfirm();
  const [items, setItems] = useState<MobileGolfAdLandingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listMobileGolfAdsClient();
      setItems(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const copyUrl = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(buildMobileGolfAdPublicUrl(slug));
      showToast("success", "비즈보드 URL이 복사되었습니다.");
    } catch {
      showToast("error", "URL 복사에 실패했습니다.");
    }
  };

  const handlePublish = async (item: MobileGolfAdLandingListItem, publish: boolean) => {
    setRowBusyId(item.id);
    try {
      if (publish) {
        await publishMobileGolfAdClient(item.id);
        showToast("success", "발행되었습니다.");
      } else {
        await unpublishMobileGolfAdClient(item.id);
        showToast("success", "발행이 취소되었습니다.");
      }
      await loadItems();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "처리에 실패했습니다.");
    } finally {
      setRowBusyId(null);
    }
  };

  const handleDelete = async (item: MobileGolfAdLandingListItem) => {
    const ok = await confirm({
      title: "랜딩 삭제",
      description: `「${item.title}」을(를) 삭제할까요?`,
      confirmLabel: "삭제",
    });
    if (!ok) return;
    setRowBusyId(item.id);
    try {
      await deleteMobileGolfAdClient(item.id);
      showToast("success", "삭제되었습니다.");
      await loadItems();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "삭제에 실패했습니다.");
    } finally {
      setRowBusyId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">모바일 골프 랜딩</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            카카오 비즈보드용 `/golf/ads/[slug]` 랜딩을 생성·발행합니다.
          </p>
        </div>
        <Link
          href={ADMIN_MOBILE_GOLF_ADS_NEW_ROUTE}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
        >
          새 랜딩
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">불러오는 중…</p>
      ) : error ? (
        <p className="text-sm text-[var(--danger)]">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">등록된 랜딩이 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs text-[var(--text-muted)]">
                <th className="px-2 py-2 font-medium">제목</th>
                <th className="px-2 py-2 font-medium">slug</th>
                <th className="px-2 py-2 font-medium">상태</th>
                <th className="px-2 py-2 font-medium">수정일</th>
                <th className="px-2 py-2 font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const busy = rowBusyId === item.id;
                return (
                  <tr key={item.id} className="border-b border-[var(--border)]/70">
                    <td className="px-2 py-3 font-medium">{item.title}</td>
                    <td className="px-2 py-3 font-mono text-xs">{item.slug}</td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.isPublished
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {item.isPublished ? "발행" : "초안"}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-xs text-[var(--text-muted)]">
                      {new Date(item.updatedAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => router.push(buildAdminMobileGolfAdEditHref(item.id))}
                          className="text-xs font-semibold text-[var(--primary)]"
                        >
                          편집
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void copyUrl(item.slug)}
                          className="text-xs font-semibold text-[var(--text-secondary)]"
                        >
                          URL 복사
                        </button>
                        {item.isPublished ? (
                          <a
                            href={buildMobileGolfAdPreviewHref(item.slug)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-[var(--text-secondary)]"
                          >
                            보기
                          </a>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handlePublish(item, !item.isPublished)}
                          className="text-xs font-semibold text-[var(--text-secondary)]"
                        >
                          {item.isPublished ? "발행 취소" : "발행"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleDelete(item)}
                          className="text-xs font-semibold text-[var(--danger)]"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
