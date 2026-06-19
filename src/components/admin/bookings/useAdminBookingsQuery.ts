"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAdminBookings } from "@/components/admin/bookings/adminBookings.client";

export function useAdminBookingsQuery(params?: { status?: string; q?: string }) {
  return useQuery({
    queryKey: ["admin", "bookings", params?.status ?? "", params?.q ?? ""],
    queryFn: () => fetchAdminBookings(params),
  });
}
