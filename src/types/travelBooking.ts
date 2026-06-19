/**
 * 여행 예약/완료 건 — 통합 예약 도메인
 */

export type TravelBookingStatus = "reserved" | "completed" | "canceled";

export type BookingPaymentStatus = "unpaid" | "partial" | "paid" | "refunded";

export type BookingTravelerInput = {
  sort_order?: number;
  full_name: string;
  phone?: string;
  email?: string;
  passport_number?: string;
  passport_expiry?: string;
  birth_date?: string;
  gender?: string;
  nationality?: string;
  is_primary?: boolean;
  is_payer?: boolean;
};

export type BookingPaymentInput = {
  status?: BookingPaymentStatus;
  method?: string;
  total_amount?: number;
  paid_amount?: number;
};

export type ConfirmTravelBookingInput = {
  customer_profile_id: string;
  inquiry_id?: string | null;
  product_id?: string | null;
  product_title?: string | null;
  source_path?: string | null;
  departure_date: string;
  return_date: string;
  traveler_count: number;
  payer_name?: string;
  primary_traveler_phone?: string;
  member_id?: string | null;
  payment?: BookingPaymentInput;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_zip?: string;
  shipping_address1?: string;
  shipping_address2?: string;
  travelers?: BookingTravelerInput[];
  confirmed_by?: string;
};

export type TravelBooking = {
  id: string;
  booking_number: string;
  customer_profile_id: string;
  inquiry_id: string | null;
  member_id: string | null;
  product_id: string | null;
  product_title: string | null;
  source_path: string | null;
  booking_status: TravelBookingStatus;
  departure_date: string | null;
  return_date: string | null;
  travel_completed_at: string | null;
  traveler_count: number;
  payer_name: string | null;
  primary_traveler_phone: string | null;
  payment_status: BookingPaymentStatus;
  payment_method: string | null;
  payment_total_amount: number | null;
  payment_paid_amount: number;
  payment_confirmed_at: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_zip: string | null;
  shipping_address1: string | null;
  shipping_address2: string | null;
  confirmed_at: string | null;
  confirmed_by_admin_id: string | null;
  booking_confirmed_sms_sent_at: string | null;
  trip_completed_sms_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BookingTravelerRow = {
  id: string;
  booking_id: string;
  sort_order: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  birth_date: string | null;
  gender: string | null;
  nationality: string | null;
  is_primary: boolean;
  is_payer: boolean;
  created_at: string;
  updated_at: string;
};

export type BookingPaymentRow = {
  id: string;
  booking_id: string;
  amount: number;
  method: string;
  status: string;
  external_provider: string | null;
  external_payment_id: string | null;
  recorded_by: string | null;
  admin_memo: string | null;
  recorded_at: string;
  created_at: string;
};

/** @deprecated createTravelBooking — confirmTravelBooking RPC 사용 */
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

export type ConfirmTravelBookingResult = {
  booking_id: string;
  booking_number: string;
  inquiry_id: string | null;
  traveler_count: number;
};

export type CompleteTravelBookingResult = {
  booking_id: string;
  booking_number: string;
  inquiry_id: string | null;
  customer_profile_id: string;
  claim_token?: string | null;
  claim_link?: string | null;
};
