import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import {
  createSmsBulkJob,
  parseManualRecipients,
  resolveInquiryRecipients,
  resolveMemberRecipients,
  type SmsBulkSourceType,
} from "@/lib/sms/smsBulk";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { data, error } = await supabaseAdmin
    .from("sms_bulk_jobs")
    .select(
      "id, message, source_type, status, total_count, success_count, failed_count, created_at, completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    if (error.code === "42P01") return NextResponse.json({ items: [] });
    return NextResponse.json({ message: "대량 발송 목록 조회에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    template_id?: string | null;
    source_type?: SmsBulkSourceType;
    recipients?: string[];
    inquiry_filter?: { status?: string; search?: string; limit?: number };
    member_ids?: string[];
    member_search?: string;
    member_limit?: number;
    actor_name?: string;
  };

  const sourceType = body.source_type ?? "manual";
  let recipients: Awaited<ReturnType<typeof parseManualRecipients>> = [];

  if (sourceType === "manual") {
    recipients = parseManualRecipients(body.recipients ?? []);
  } else if (sourceType === "inquiries") {
    recipients = await resolveInquiryRecipients(body.inquiry_filter ?? {});
  } else if (sourceType === "members") {
    recipients = await resolveMemberRecipients({
      memberIds: body.member_ids,
      search: body.member_search,
      limit: body.member_limit,
    });
  } else {
    return NextResponse.json({ message: "지원하지 않는 source_type입니다." }, { status: 400 });
  }

  const result = await createSmsBulkJob({
    message: body.message ?? "",
    templateId: body.template_id ?? null,
    sourceType,
    sourceFilter:
      sourceType === "inquiries"
        ? (body.inquiry_filter ?? {})
        : sourceType === "members"
          ? { member_ids: body.member_ids ?? [], search: body.member_search ?? "" }
          : {},
    recipients,
    createdBy: body.actor_name ?? "관리자",
  });

  if ("error" in result) {
    return NextResponse.json({ message: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, jobId: result.jobId });
}
