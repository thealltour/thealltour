import type { NextRequest } from "next/server";

export type InquiryListFilters = {
  status?: string;
  search?: string;
  quick?: string;
  assigneeName?: string;
  createdAfter?: string;
  page: number;
  pageSize: number;
  sort: string;
};

export function parseInquiryListFilters(request: NextRequest): InquiryListFilters {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "20", 10) || 20));
  return {
    status: searchParams.get("status")?.trim() || "all",
    search: searchParams.get("search")?.trim() || undefined,
    quick: searchParams.get("quick")?.trim() || undefined,
    assigneeName: searchParams.get("assigneeName")?.trim() || undefined,
    createdAfter: searchParams.get("createdAfter")?.trim() || undefined,
    page,
    pageSize,
    sort: searchParams.get("sort")?.trim() || "priority_queue",
  };
}
