"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type AdminReviewSummaryRow = {
  id: string;
  product_id: string;
  product_title: string | null;
  review_count: number;
  average_rating: number | null;
  status: string;
  updated_at: string;
};

export type AdminReviewReminderRow = {
  id: string;
  eligibility_id: string;
  member_id: string | null;
  reminder_type: string;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
  created_at: string;
};

const summariesKey = ["admin", "review-summaries"] as const;
const remindersKey = (status: string) => ["admin", "review-reminders", status] as const;

export function useAdminReviewSummariesQuery() {
  return useQuery({
    queryKey: summariesKey,
    queryFn: async () => {
      const res = await fetch("/api/admin/review-summaries?limit=100", { cache: "no-store" });
      const data = (await res.json()) as { rows: AdminReviewSummaryRow[]; total: number; message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? "목록을 불러오지 못했습니다.");
      }
      return { rows: data.rows ?? [], total: data.total ?? 0 };
    },
  });
}

export function useRegenerateReviewSummaryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const res = await fetch(`/api/admin/products/${productId}/review-summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate" }),
      });
      const data = (await res.json()) as { message?: string; success?: boolean; reviewCount?: number };
      if (!res.ok || !data.success) {
        throw new Error(data.message ?? "재생성에 실패했습니다.");
      }
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: summariesKey });
    },
  });
}

export function useAdminReviewRemindersQuery(statusFilter: string) {
  return useQuery({
    queryKey: remindersKey(statusFilter),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      params.set("limit", "100");
      const res = await fetch(`/api/admin/review-reminders?${params}`, { cache: "no-store" });
      const data = (await res.json()) as { rows: AdminReviewReminderRow[]; total: number; message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? "목록을 불러오지 못했습니다.");
      }
      return { rows: data.rows ?? [], total: data.total ?? 0 };
    },
  });
}

export function useReviewReminderCancelMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/review-reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? "취소에 실패했습니다.");
      }
      return data.message ?? "취소되었습니다.";
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "review-reminders"] });
    },
  });
}

export function useReviewReminderResendMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/review-reminders/${id}`, { method: "POST" });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        throw new Error(data.message ?? "재발송에 실패했습니다.");
      }
      return data.message ?? "재발송 처리되었습니다.";
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "review-reminders"] });
    },
  });
}
