"use client";

/**
 * PR14: 관리자 리뷰 요약 목록 + 재생성.
 */
import { useEffect, useState } from "react";
import { useAdminToast } from "@/components/admin/AdminToastProvider";

type SummaryRow = {
  id: string;
  product_id: string;
  product_title: string | null;
  review_count: number;
  average_rating: number | null;
  status: string;
  updated_at: string;
};

function formatDate(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleString("ko-KR");
}

export default function AdminReviewSummariesPage() {
  const { showToast } = useAdminToast();
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [productIdInput, setProductIdInput] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/review-summaries?limit=100");
      const data = (await res.json()) as { rows: SummaryRow[]; total: number };
      if (res.ok) {
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleRegenerate = async (productId: string) => {
    setRegeneratingId(productId);
    try {
      const res = await fetch(`/api/admin/products/${productId}/review-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      const data = (await res.json()) as { message?: string; success?: boolean };
      if (res.ok && data.success) {
        showToast("success", `요약이 재생성되었습니다. (리뷰 ${(data as { reviewCount?: number }).reviewCount ?? 0}건)`);
        fetchList();
      } else {
        showToast("error", data.message ?? "재생성에 실패했습니다.");
      }
    } catch {
      showToast("error", "요청 중 오류가 발생했습니다.");
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleCreateForProduct = async () => {
    const id = productIdInput.trim();
    if (!id) {
      showToast("error", "상품 ID를 입력하세요.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/products/${id}/review-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      const data = (await res.json()) as { message?: string; success?: boolean };
      if (res.ok && data.success) {
        showToast("success", "요약이 생성되었습니다.");
        setProductIdInput("");
        fetchList();
      } else {
        showToast("error", data.message ?? "생성에 실패했습니다.");
      }
    } catch {
      showToast("error", "요청 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-medium text-[var(--text-muted)]">리뷰 요약</span>
        <span className="text-sm text-[var(--text-muted)]">총 {total}건</span>
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
            disabled={creating}
            onClick={handleCreateForProduct}
            className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {creating ? "생성 중..." : "요약 생성"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">로딩 중...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">등록된 요약이 없습니다. 상품 ID를 입력해 요약을 생성하세요.</div>
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
                      disabled={regeneratingId === r.product_id}
                      onClick={() => handleRegenerate(r.product_id)}
                      className="text-xs font-medium text-[var(--brand)] hover:underline disabled:opacity-50"
                    >
                      {regeneratingId === r.product_id ? "재생성 중..." : "재생성"}
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
