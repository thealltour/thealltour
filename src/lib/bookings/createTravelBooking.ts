import "server-only";

import { confirmTravelBooking } from "@/lib/bookings/confirmTravelBooking";
import { sendBookingConfirmedSms } from "@/lib/bookings/bookingSms";
import type { ConfirmTravelBookingInput, ConfirmTravelBookingResult } from "@/types/travelBooking";

export type CreateTravelBookingOptions = ConfirmTravelBookingInput & {
  send_confirmation_sms?: boolean;
};

export async function createStandaloneTravelBooking(
  input: CreateTravelBookingOptions,
): Promise<ConfirmTravelBookingResult> {
  const { send_confirmation_sms, ...confirmInput } = input;
  const result = await confirmTravelBooking(confirmInput);

  if (send_confirmation_sms !== false && confirmInput.primary_traveler_phone?.trim()) {
    await sendBookingConfirmedSms({
      bookingId: result.booking_id,
      inquiryId: confirmInput.inquiry_id ?? null,
      receiver: confirmInput.primary_traveler_phone,
      name: confirmInput.payer_name,
      booking_number: result.booking_number,
      product_title: confirmInput.product_title ?? undefined,
      departure_date: confirmInput.departure_date,
      traveler_count: result.traveler_count,
    });
  }

  return result;
}

export async function createTravelBookingFromInquiry(
  inquiryId: string,
  input: Omit<CreateTravelBookingOptions, "inquiry_id">,
): Promise<ConfirmTravelBookingResult> {
  return createStandaloneTravelBooking({
    ...input,
    inquiry_id: inquiryId,
  });
}
