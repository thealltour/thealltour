/**
 * 여행 예약/완료 건.
 * customer_profile 기준 관리.
 */

export type TravelBookingStatus = "reserved" | "completed" | "canceled";

export type TravelBooking = {
  id: string;
  customer_profile_id: string;
  inquiry_id: string | null;
  product_id: string | null;
  product_title: string | null;
  source_path: string | null;
  booking_status: TravelBookingStatus;
  departure_date: string | null;
  return_date: string | null;
  travel_completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TravelBookingInput = {
  customer_profile_id: string;
  inquiry_id?: string | null;
  product_id?: string | null;
  product_title?: string | null;
  source_path?: string | null;
  booking_status?: TravelBookingStatus;
  departure_date?: string | null;
  return_date?: string | null;
  travel_completed_at?: string | null;
};
