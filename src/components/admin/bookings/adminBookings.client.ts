import { buildQueryString, extractErrorMessage, parseJsonResponse } from "@/components/admin/products/api/adminApiClient.shared";

export type AdminBookingRow = {
  id: string;
  booking_number: string;
  booking_status: string;
  product_title: string | null;
  traveler_count: number;
  payment_status: string;
  departure_date: string | null;
  return_date: string | null;
  inquiry_id: string | null;
  member_id: string | null;
  customer_profile_id: string;
  primary_traveler_phone: string | null;
  payer_name: string | null;
  created_at: string;
};

async function throwIfNotOk(response: Response, fallback: string) {
  if (response.ok) return;
  const payload = await parseJsonResponse<unknown>(response);
  throw new Error(extractErrorMessage(payload, fallback));
}

export async function fetchAdminBookings(params?: {
  status?: string;
  q?: string;
}): Promise<AdminBookingRow[]> {
  const qs = buildQueryString({ status: params?.status, q: params?.q });
  const response = await fetch(`/api/admin/bookings${qs ? `?${qs}` : ""}`, { cache: "no-store" });
  await throwIfNotOk(response, "예약 목록을 불러올 수 없습니다.");
  return parseJsonResponse<AdminBookingRow[]>(response);
}

export async function fetchAdminBookingDetail(id: string) {
  const response = await fetch(`/api/admin/bookings/${id}`, { cache: "no-store" });
  await throwIfNotOk(response, "예약 상세를 불러올 수 없습니다.");
  return parseJsonResponse<Record<string, unknown>>(response);
}

export async function postAdminBookingCreate(body: Record<string, unknown>) {
  const response = await fetch("/api/admin/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await parseJsonResponse<unknown>(response);
    throw new Error(extractErrorMessage(payload, "예약 생성에 실패했습니다."));
  }
  return parseJsonResponse<{ booking_id: string; booking_number: string }>(response);
}

export async function postAdminBookingAction(
  id: string,
  action: "complete" | "confirm" | "grant-reward",
  body?: Record<string, unknown>,
) {
  const response = await fetch(`/api/admin/bookings/${id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  await throwIfNotOk(response, "처리에 실패했습니다.");
  return parseJsonResponse<{ message?: string }>(response);
}
