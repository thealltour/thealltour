/** 예약 생성 허브 deep link URL 생성 */
export function buildAdminBookingNewUrl(params: {
  customer_profile_id: string;
  member_id?: string | null;
  product_id?: string | null;
  product_title?: string | null;
  inquiry_id?: string | null;
}): string {
  const q = new URLSearchParams();
  q.set("customer_profile_id", params.customer_profile_id);
  if (params.member_id?.trim()) q.set("member_id", params.member_id.trim());
  if (params.product_id?.trim()) q.set("product_id", params.product_id.trim());
  if (params.product_title?.trim()) q.set("product_title", params.product_title.trim());
  if (params.inquiry_id?.trim()) q.set("inquiry_id", params.inquiry_id.trim());
  return `/theall_manager_only/bookings/new?${q.toString()}`;
}
