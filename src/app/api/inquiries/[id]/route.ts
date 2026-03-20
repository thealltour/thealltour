import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getTravelBookingByInquiryId, createTravelBooking, updateTravelBookingStatus } from "@/lib/travelBookings";
import { createEligibilityIfNotExists } from "@/lib/reviewEligibilities";
import { createReviewReminders } from "@/lib/reviewReminders";
import type { ConsultationStatus, BookingStatus } from "@/types/inquiry";

type PatchBodyLegacy = {
  is_completed?: boolean;
  consultation_status?: ConsultationStatus;
  booking_status?: BookingStatus;
  completed_at?: string | null;
};

type PatchBodyAction =
  | { action: "update_status"; consultation_status?: ConsultationStatus; booking_status?: BookingStatus; completed_at?: string | null }
  | { action: "reserve_booking"; departure_date: string; return_date: string; product_id?: string; product_title?: string; source_path?: string }
  | { action: "complete_trip" };

type PatchBody = PatchBodyLegacy | PatchBodyAction;

function isActionBody(b: PatchBody): b is PatchBodyAction {
  return "action" in b && typeof (b as PatchBodyAction).action === "string";
}

const CONSULTATION_STATUSES: ConsultationStatus[] = ["new", "contacted", "closed"];
const BOOKING_STATUSES: BookingStatus[] = ["none", "reserved", "completed", "canceled"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: inquiryId } = await context.params;
  const body = (await request.json()) as PatchBody;

  if (isActionBody(body)) {
    if (body.action === "update_status") {
      const updatePayload: Record<string, unknown> = {};
      if (body.consultation_status && CONSULTATION_STATUSES.includes(body.consultation_status)) {
        updatePayload.consultation_status = body.consultation_status;
      }
      if (body.booking_status && BOOKING_STATUSES.includes(body.booking_status)) {
        updatePayload.booking_status = body.booking_status;
      }
      if (body.completed_at !== undefined) {
        updatePayload.completed_at = body.completed_at === null || body.completed_at === "" ? null : body.completed_at;
      }
      if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json(
          { message: "consultation_status, booking_status, completed_at 중 하나 이상이 필요합니다." },
          { status: 400 },
        );
      }
      const { error } = await supabase.from("inquiries").update(updatePayload).eq("id", inquiryId);
      if (error) {
        return handleInquiryUpdateError(error);
      }
      return NextResponse.json({ message: "상담 상태가 업데이트되었습니다." });
    }

    if (body.action === "reserve_booking") {
      const departure = body.departure_date?.trim();
      const returnDate = body.return_date?.trim();
      if (!departure || !returnDate) {
        return NextResponse.json(
          { message: "출발일(departure_date)과 귀국일(return_date)은 필수입니다." },
          { status: 400 },
        );
      }
      const dep = new Date(departure);
      const ret = new Date(returnDate);
      if (Number.isNaN(dep.getTime()) || Number.isNaN(ret.getTime())) {
        return NextResponse.json({ message: "출발일·귀국일 형식이 올바르지 않습니다." }, { status: 400 });
      }
      if (ret < dep) {
        return NextResponse.json({ message: "귀국일은 출발일 이후여야 합니다." }, { status: 400 });
      }

      const { data: inquiry, error: fetchError } = await supabase
        .from("inquiries")
        .select("id, customer_profile_id, product_id, product_title, source_path")
        .eq("id", inquiryId)
        .single();

      if (fetchError || !inquiry) {
        return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
      }

      const customerProfileId = (inquiry as { customer_profile_id?: string | null }).customer_profile_id;
      if (!customerProfileId) {
        return NextResponse.json(
          { message: "이 문의에 연결된 고객 프로필이 없습니다. 예약 확정을 할 수 없습니다." },
          { status: 400 },
        );
      }

      const existing = await getTravelBookingByInquiryId(inquiryId);
      if (existing) {
        return NextResponse.json(
          { message: "이미 이 문의로 예약이 등록되어 있습니다. 중복 생성할 수 없습니다." },
          { status: 400 },
        );
      }

      const row = inquiry as { product_id?: string | null; product_title?: string | null; source_path?: string | null };
      const productId = (body.product_id ?? row.product_id ?? "").trim() || null;
      const productTitle = (body.product_title ?? row.product_title ?? "").trim() || null;
      const sourcePath = (body.source_path ?? row.source_path ?? "").trim() || null;

      const booking = await createTravelBooking({
        customer_profile_id: customerProfileId,
        inquiry_id: inquiryId,
        product_id: productId,
        product_title: productTitle,
        source_path: sourcePath,
        booking_status: "reserved",
        departure_date: departure,
        return_date: returnDate,
      });

      if (!booking) {
        return NextResponse.json({ message: "예약 생성에 실패했습니다." }, { status: 500 });
      }

      const { error: updateErr } = await supabase
        .from("inquiries")
        .update({
          consultation_status: "closed",
          booking_status: "reserved",
        })
        .eq("id", inquiryId);

      if (updateErr) {
        return NextResponse.json({ message: "문의 상태 업데이트에 실패했습니다." }, { status: 500 });
      }

      return NextResponse.json({ message: "예약이 확정되었습니다." });
    }

    if (body.action === "complete_trip") {
      const { data: inquiry, error: fetchError } = await supabase
        .from("inquiries")
        .select("id, customer_profile_id, booking_status")
        .eq("id", inquiryId)
        .single();

      if (fetchError || !inquiry) {
        return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
      }

      const row = inquiry as Record<string, unknown>;
      const bookingStatus = row.booking_status as string | undefined;
      if (bookingStatus !== "reserved") {
        return NextResponse.json(
          { message: "예약 확정된 문의만 여행 완료 처리할 수 있습니다." },
          { status: 400 },
        );
      }

      const booking = await getTravelBookingByInquiryId(inquiryId);
      if (!booking) {
        return NextResponse.json(
          { message: "연결된 예약 건을 찾을 수 없습니다. 여행 완료 처리가 불가합니다." },
          { status: 400 },
        );
      }

      const customerProfileId = row.customer_profile_id as string | null | undefined;
      if (!customerProfileId) {
        return NextResponse.json(
          { message: "이 문의에 연결된 고객 프로필이 없습니다. 여행 완료 처리가 불가합니다." },
          { status: 400 },
        );
      }

      const now = new Date().toISOString();
      const updated = await updateTravelBookingStatus(booking.id, "completed", { travel_completed_at: now });
      if (!updated) {
        return NextResponse.json({ message: "예약 상태 업데이트에 실패했습니다." }, { status: 500 });
      }

      const { error: inquiryUpdateErr } = await supabase
        .from("inquiries")
        .update({
          booking_status: "completed",
          completed_at: now,
        })
        .eq("id", inquiryId);

      if (inquiryUpdateErr) {
        return NextResponse.json({ message: "문의 상태 업데이트에 실패했습니다." }, { status: 500 });
      }

      const eligibility = await createEligibilityIfNotExists(booking.id, customerProfileId, {
        withClaimToken: true,
      });

      if (eligibility) {
        await createReviewReminders(eligibility);
        return NextResponse.json({
          message: "여행 완료 및 후기 자격이 생성되었습니다.",
          claim_token: eligibility.claim_token,
          claim_link: eligibility.claim_token ? `/reviews/claim/${eligibility.claim_token}` : null,
        });
      }

      return NextResponse.json({ message: "여행 완료 처리되었습니다. (후기 자격 생성 건너뜀)" });
    }
  }

  // Legacy: no action, direct field update
  const updatePayload: Record<string, unknown> = {};
  if (typeof body.is_completed === "boolean") {
    updatePayload.is_completed = body.is_completed;
  }
  if (body.consultation_status && CONSULTATION_STATUSES.includes(body.consultation_status)) {
    updatePayload.consultation_status = body.consultation_status;
  }
  if (body.booking_status && BOOKING_STATUSES.includes(body.booking_status)) {
    updatePayload.booking_status = body.booking_status;
  }
  if (body.completed_at !== undefined) {
    updatePayload.completed_at = body.completed_at === null || body.completed_at === "" ? null : body.completed_at;
  }
  if (Object.keys(updatePayload).length === 0) {
    return NextResponse.json(
      { message: "is_completed, consultation_status, booking_status, completed_at 중 하나 이상이 필요합니다." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("inquiries").update(updatePayload).eq("id", inquiryId);
  if (error) {
    return handleInquiryUpdateError(error);
  }
  return NextResponse.json({ message: "상담 상태가 업데이트되었습니다." });
}

function handleInquiryUpdateError(error: { code?: string; message?: string }) {
  const code = error?.code;
  if (code === "42703") {
    return NextResponse.json(
      { message: "inquiries 테이블에 요청한 컬럼이 없습니다. DB 업그레이드 SQL을 실행해 주세요." },
      { status: 500 },
    );
  }
  if (code === "42501") {
    return NextResponse.json(
      { message: "inquiries 테이블 UPDATE 권한(RLS 정책)이 없습니다. 정책 SQL을 확인해 주세요." },
      { status: 500 },
    );
  }
  return NextResponse.json({ message: "상담 상태 업데이트에 실패했습니다." }, { status: 500 });
}

function handleInquiryDeleteError(error: { code?: string; message?: string }) {
  const code = error?.code;
  if (code === "42501") {
    return NextResponse.json(
      { message: "inquiries 테이블 DELETE 권한(RLS 정책)이 없습니다. 마이그레이션 SQL을 적용해 주세요." },
      { status: 500 },
    );
  }
  return NextResponse.json({ message: "문의 삭제에 실패했습니다." }, { status: 500 });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: inquiryId } = await context.params;
  const id = inquiryId?.trim();
  if (!id) {
    return NextResponse.json({ message: "문의 ID가 필요합니다." }, { status: 400 });
  }

  const { data, error } = await supabase.from("inquiries").delete().eq("id", id).select("id");

  if (error) {
    return handleInquiryDeleteError(error);
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ message: "문의가 삭제되었습니다." });
}
