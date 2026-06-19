"use client";

import { useQuery } from "@tanstack/react-query";

export type InquiryListQueryParams = {
  page: number;
  pageSize: number;
  status: string;
  sort: string;
  quick?: string;
  search?: string;
  assigneeName?: string;
  createdAfter?: string;
};

async function fetchInquiryList(params: InquiryListQueryParams) {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    status: params.status,
    sort: params.sort,
  });
  if (params.quick) search.set("quick", params.quick);
  if (params.search) search.set("search", params.search);
  if (params.assigneeName) search.set("assigneeName", params.assigneeName);
  if (params.createdAfter) search.set("createdAfter", params.createdAfter);

  const response = await fetch(`/api/inquiries?${search.toString()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("문의 목록을 불러오지 못했습니다.");
  }
  return response.json();
}

export function useAdminInquiriesQuery(params: InquiryListQueryParams, enabled = true) {
  return useQuery({
    queryKey: ["admin", "inquiries", params],
    queryFn: () => fetchInquiryList(params),
    enabled,
  });
}
