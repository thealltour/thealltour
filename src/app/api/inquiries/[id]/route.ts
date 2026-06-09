import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTravelBookingByInquiryId, createTravelBooking, updateTravelBookingStatus } from "@/lib/travelBookings";
import { createEligibilityIfNotExists, adminClaimEligibilityById } from "@/lib/reviewEligibilities";
import { findLinkedMemberIdByCustomerProfileId } from "@/lib/customerAccountLinks";
import { createReviewReminders } from "@/lib/reviewReminders";
import {
  appendInquiryActivityLog,
  BOOKING_STATUS_KO,
  CONSULTATION_STATUS_KO,
} from "@/lib/inquiries/inquiryActivityLog";
import type { ConsultationStatus, BookingStatus } from "@/types/inquiry";

const STATUS_LOG_ACTOR = "관리자";

function consultationLabelKo(key: string): string {
  if (!key) return "—";
  return CONSULTATION_STATUS_KO[key] ?? key;
}

function bookingLabelKo(key: string): string {
  if (!key) return "—";
  return BOOKING_STATUS_KO[key] ?? key;
}

async function logConsultationAndBookingChanges(
  inquiryId: string,
  prevC: string | null | undefined,
  prevB: string | null | undefined,
  nextC: string | null | undefined,
  nextB: string | null | undefined,
) {
  const pc = prevC ?? "";
  const pb = prevB ?? "";
  const nc = nextC ?? "";
  const nb = nextB ?? "";
  if (pc !== nc) {
    const { error } = await appendInquiryActivityLog(supabaseAdmin, {
      inquiry_id: inquiryId,
      activity_type: "consultation_status_changed",
      actor_name: STATUS_LOG_ACTOR,
      summary: `상담 상태 변경: ${consultationLabelKo(pc)} → ${consultationLabelKo(nc)}`,
      metadata: { from: pc || null, to: nc || null },
    });
    if (error) console.error("[inquiries PATCH] consultation log failed", error);
  }
  if (pb !== nb) {
    const { error } = await appendInquiryActivityLog(supabaseAdmin, {
      inquiry_id: inquiryId,
      activity_type: "booking_status_changed",
      actor_name: STATUS_LOG_ACTOR,
      summary: `여행 상태 변경: ${bookingLabelKo(pb)} → ${bookingLabelKo(nb)}`,
      metadata: { from: pb || null, to: nb || null },
    });
    if (error) console.error("[inquiries PATCH] booking log failed", error);
  }
}

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

const CONSULTATION_STATUSES: ConsultationStatus[] = ["new", "contacted", "closed", "on_hold"];
const BOOKING_STATUSES: BookingStatus[] = ["none", "reserved", "completed", "canceled"];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: inquiryId } = await context.params;
  const body = (await request.json()) as PatchBody;

  if (isActionBody(body)) {
    if (body.action === "update_status") {
      const { data: prevSnap, error: prevErr } = await supabaseAdmin
        .from("inquiries")
        .select("consultation_status, booking_status")
        .eq("id", inquiryId)
        .maybeSingle();
      if (prevErr || !prevSnap) {
        return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
      }
      const prevRow = prevSnap as { consultation_status?: string | null; booking_status?: string | null };
      const prevC = prevRow.consultation_status ?? undefined;
      const prevB = prevRow.booking_status ?? undefined;

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
      updatePayload.last_activity_at = new Date().toISOString();

      let nextC = prevC;
      let nextB = prevB;
      if (updatePayload.consultation_status !== undefined) nextC = String(updatePayload.consultation_status);
      if (updatePayload.booking_status !== undefined) nextB = String(updatePayload.booking_status);

      const { error } = await supabaseAdmin.from("inquiries").update(updatePayload).eq("id", inquiryId);
      if (error) {
        return handleInquiryUpdateError(error);
      }
      await logConsultationAndBookingChanges(inquiryId, prevC, prevB, nextC, nextB);
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

      const { data: inquiry, error: fetchError } = await supabaseAdmin
        .from("inquiries")
        .select("id, customer_profile_id, product_id, product_title, source_path, consultation_status, booking_status")
        .eq("id", inquiryId)
        .single();

      if (fetchError || !inquiry) {
        return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
      }

      const consultationRow = (inquiry as { consultation_status?: string | null }).consultation_status;
      if (consultationRow === "on_hold") {
        return NextResponse.json(
          {
            message:
              "보류 상태입니다. 먼저 상담 상태를 「상담중」으로 재개한 뒤 예약 확정해 주세요.",
          },
          { status: 400 },
        );
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

      const rowBooking = (inquiry as { booking_status?: string | null }).booking_status ?? "none";
      const rowConsultation = consultationRow ?? "new";

      const { error: updateErr } = await supabaseAdmin
        .from("inquiries")
        .update({
          consultation_status: "closed",
          booking_status: "reserved",
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", inquiryId);

      if (updateErr) {
        return NextResponse.json({ message: "문의 상태 업데이트에 실패했습니다." }, { status: 500 });
      }

      await logConsultationAndBookingChanges(inquiryId, rowConsultation, rowBooking, "closed", "reserved");

      return NextResponse.json({ message: "예약이 확정되었습니다." });
    }

    if (body.action === "complete_trip") {
      const { data: inquiry, error: fetchError } = await supabaseAdmin
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

      const prevBook = bookingStatus ?? "none";

      const { error: inquiryUpdateErr } = await supabaseAdmin
        .from("inquiries")
        .update({
          booking_status: "completed",
          completed_at: now,
          last_activity_at: now,
        })
        .eq("id", inquiryId);

      if (inquiryUpdateErr) {
        return NextResponse.json({ message: "문의 상태 업데이트에 실패했습니다." }, { status: 500 });
      }

      await logConsultationAndBookingChanges(inquiryId, undefined, prevBook, undefined, "completed");

      const eligibility = await createEligibilityIfNotExists(booking.id, customerProfileId, {
        withClaimToken: true,
      });

      if (eligibility) {
        const linkedMemberId = await findLinkedMemberIdByCustomerProfileId(customerProfileId);
        if (linkedMemberId && !eligibility.claimed_by_member_id) {
          await adminClaimEligibilityById(eligibility.id, linkedMemberId);
        }

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
  const { data: prevLegacy, error: prevLegErr } = await supabaseAdmin
    .from("inquiries")
    .select("consultation_status, booking_status")
    .eq("id", inquiryId)
    .maybeSingle();
  if (prevLegErr || !prevLegacy) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }
  const leg = prevLegacy as { consultation_status?: string | null; booking_status?: string | null };
  const prevLC = leg.consultation_status ?? undefined;
  const prevLB = leg.booking_status ?? undefined;

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

  updatePayload.last_activity_at = new Date().toISOString();

  let nextLC = prevLC;
  let nextLB = prevLB;
  if (updatePayload.consultation_status !== undefined) nextLC = String(updatePayload.consultation_status);
  if (updatePayload.booking_status !== undefined) nextLB = String(updatePayload.booking_status);

  const { error } = await supabaseAdmin.from("inquiries").update(updatePayload).eq("id", inquiryId);
  if (error) {
    return handleInquiryUpdateError(error);
  }
  await logConsultationAndBookingChanges(inquiryId, prevLC, prevLB, nextLC, nextLB);
  return NextResponse.json({ message: "상담 상태가 업데이트되었습니다." });
}

function handleInquiryUpdateError(error: { code?: string; message?: string }) {
  const code = error?.code;
  if (code === "23514") {
    return NextResponse.json(
      {
        message:
          "DB 제약 조건 위반입니다. consultation_status에 on_hold 등을 허용하는 마이그레이션을 Supabase에 적용했는지 확인해 주세요. (예: supabaseAdmin/migrations/20260407120100_inquiries_consultation_status_on_hold.sql)",
      },
      { status: 400 },
    );
  }
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

  const { data, error } = await supabaseAdmin.from("inquiries").delete().eq("id", id).select("id");

  if (error) {
    return handleInquiryDeleteError(error);
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ message: "문의가 삭제되었습니다." });
}
