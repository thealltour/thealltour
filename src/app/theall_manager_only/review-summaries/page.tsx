"use client";

/**
 * PR14: 관리자 리뷰 요약 목록 + 재생성.
 */
import { useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToastProvider";
import {
  useAdminReviewSummariesQuery,
  useRegenerateReviewSummaryMutation,
} from "@/components/admin/reviews/useAdminReviewSummariesAndReminders";

function formatDate(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("ko-KR");
}

export default function AdminReviewSummariesPage() {
  const { showToast } = useAdminToast();
  const { data, isPending, isError, error, refetch } = useAdminReviewSummariesQuery();
  const regenerate = useRegenerateReviewSummaryMutation();
  const [productIdInput, setProductIdInput] = useState("");

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  const handleRegenerate = async (productId: string) => {
    try {
      const data = await regenerate.mutateAsync(productId);
      showToast(
        "success",
        `요약이 재생성되었습니다. (리뷰 ${data.reviewCount ?? 0}건)`,
      );
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "재생성에 실패했습니다.");
    }
  };

  const handleCreateForProduct = async () => {
    const id = productIdInput.trim();
    if (!id) {
      showToast("error", "상품 ID를 입력하세요.");
      return;
    }
    try {
      await regenerate.mutateAsync(id);
      showToast("success", "요약이 생성되었습니다.");
      setProductIdInput("");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "생성에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-[var(--text-muted)]">리뷰 요약</span>
        <span className="text-sm text-[var(--text-muted)]">총 {total}건</span>
        {isError ? (
          <button
            type="button"
            onClick={() => void refetch()}
            className="text-xs font-medium text-[var(--brand)] hover:underline"
          >
            다시 시도
          </button>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={productIdInput}
            onChange={(e) => setProductIdInput(e.target.value)}
            placeholder="상품 ID (요약 생성)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
          />
          <button
            type="button"
            disabled={regenerate.isPending}
            onClick={() => void handleCreateForProduct()}
            className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {regenerate.isPending ? "생성 중..." : "요약 생성"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {isPending ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">로딩 중...</div>
        ) : isError ? (
          <div className="p-8 text-center text-sm text-red-600">
            {error instanceof Error ? error.message : "불러오기에 실패했습니다."}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">
            등록된 요약이 없습니다. 상품 ID를 입력해 요약을 생성하세요.
          </div>
        ) : (
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-muted)]">
                <th className="px-4 py-3 font-semibold text-[var(--text)]">product_id</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">상품명</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">status</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">리뷰 수</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">평균 평점</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">updated_at</th>
                <th className="px-4 py-3 font-semibold text-[var(--text)]">동작</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)]">
                  <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">
                    {r.product_id.slice(0, 8)}…
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-2" title={r.product_title ?? ""}>
                    {r.product_title ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        r.status === "ready"
                          ? "text-green-600"
                          : r.status === "stale"
                            ? "text-amber-600"
                            : "text-slate-500"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{r.review_count}</td>
                  <td className="px-4 py-2">{r.average_rating != null ? r.average_rating.toFixed(1) : "—"}</td>
                  <td className="px-4 py-2 text-[var(--text-muted)]">{formatDate(r.updated_at)}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      disabled={regenerate.isPending && regenerate.variables === r.product_id}
                      onClick={() => void handleRegenerate(r.product_id)}
                      className="text-xs font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
                    >
                      {regenerate.isPending && regenerate.variables === r.product_id
                        ? "재생성 중..."
                        : "재생성"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-[var(--text-muted)]">
        리뷰가 2건 이상인 상품만 요약이 생성됩니다. 리뷰 제출/숨김 시 해당 상품 요약은 자동으로 stale 처리됩니다.
      </p>
    </div>
  );
}
