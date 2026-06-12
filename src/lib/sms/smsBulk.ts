import "server-only";

import { createSmsBulkCompletedNotification } from "@/lib/adminNotifications";
import { normalizeReceiverPhone } from "@/lib/notifications/sendAligoRelay";
import { sendAdminSms } from "@/lib/sms/sendAdminSms";
import { applySmsTemplate, getSmsTemplateById } from "@/lib/sms/smsTemplates";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type SmsBulkSourceType = "manual" | "inquiries" | "members";

export type SmsBulkRecipient = {
  phone: string;
  name?: string | null;
  inquiryId?: string | null;
  memberId?: string | null;
};

const DEFAULT_BATCH_SIZE = Number.parseInt(process.env.SMS_BULK_BATCH_SIZE ?? "15", 10);

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, "\\$&");
}

export function parseManualRecipients(raw: string[]): SmsBulkRecipient[] {
  const seen = new Set<string>();
  const out: SmsBulkRecipient[] = [];
  for (const line of raw) {
    const phone = normalizeReceiverPhone(line);
    if (!phone || phone.length < 10 || seen.has(phone)) continue;
    seen.add(phone);
    out.push({ phone });
  }
  return out;
}

export async function resolveInquiryRecipients(filter: {
  status?: string;
  search?: string;
  limit?: number;
}): Promise<SmsBulkRecipient[]> {
  const limit = Math.min(filter.limit ?? 200, 500);
  let query = supabaseAdmin
    .from("inquiries")
    .select("id, name, phone")
    .not("phone", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  const status = filter.status?.trim();
  if (status === "pending") {
    query = query.in("consultation_status", ["new", "contacted"]);
  } else if (status && status !== "all") {
    query = query.eq("consultation_status", status);
  }

  if (filter.search?.trim()) {
    const escaped = escapeIlike(filter.search.trim());
    query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const seen = new Set<string>();
  const out: SmsBulkRecipient[] = [];
  for (const row of data) {
    const phone = normalizeReceiverPhone(typeof row.phone === "string" ? row.phone : "");
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({
      phone,
      name: typeof row.name === "string" ? row.name : null,
      inquiryId: row.id != null ? String(row.id) : null,
    });
  }
  return out;
}

export async function resolveMemberRecipients(input: {
  memberIds?: string[];
  search?: string;
  limit?: number;
}): Promise<SmsBulkRecipient[]> {
  const limit = Math.min(input.limit ?? 200, 500);
  let query = supabaseAdmin
    .from("members")
    .select("id, name, phone")
    .not("phone", "is", null)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (input.memberIds?.length) {
    query = query.in("id", input.memberIds);
  } else if (input.search?.trim()) {
    const escaped = escapeIlike(input.search.trim());
    query = query.or(`name.ilike.%${escaped}%,phone.ilike.%${escaped}%,username.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const seen = new Set<string>();
  const out: SmsBulkRecipient[] = [];
  for (const row of data) {
    const phone = normalizeReceiverPhone(typeof row.phone === "string" ? row.phone : "");
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({
      phone,
      name: typeof row.name === "string" ? row.name : null,
      memberId: row.id != null ? String(row.id) : null,
    });
  }
  return out;
}

export async function createSmsBulkJob(input: {
  message: string;
  templateId?: string | null;
  sourceType: SmsBulkSourceType;
  sourceFilter?: Record<string, unknown>;
  recipients: SmsBulkRecipient[];
  createdBy?: string | null;
}): Promise<{ jobId: string } | { error: string }> {
  if (input.recipients.length === 0) {
    return { error: "발송 대상이 없습니다." };
  }

  let message = input.message.trim();
  if (!message && input.templateId) {
    const tpl = await getSmsTemplateById(input.templateId);
    if (!tpl) return { error: "템플릿을 찾을 수 없습니다." };
    message = tpl.body;
  }
  if (!message) return { error: "메시지 내용이 필요합니다." };

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("sms_bulk_jobs")
    .insert({
      message,
      template_id: input.templateId ?? null,
      source_type: input.sourceType,
      source_filter: input.sourceFilter ?? {},
      status: "pending",
      total_count: input.recipients.length,
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .maybeSingle();

  if (jobErr || !job?.id) {
    if (jobErr?.code === "42P01") return { error: "대량 발송 테이블이 없습니다. 마이그레이션을 적용해 주세요." };
    return { error: "대량 발송 작업 생성에 실패했습니다." };
  }

  const jobId = String(job.id);
  const items = input.recipients.map((r) => ({
    job_id: jobId,
    recipient_phone: r.phone,
    inquiry_id: r.inquiryId ?? null,
    member_id: r.memberId ?? null,
    recipient_name: r.name ?? null,
    status: "pending",
  }));

  const { error: itemsErr } = await supabaseAdmin.from("sms_bulk_job_items").insert(items);
  if (itemsErr) {
    await supabaseAdmin.from("sms_bulk_jobs").delete().eq("id", jobId);
    return { error: "발송 대상 저장에 실패했습니다." };
  }

  return { jobId };
}

export async function processSmsBulkJobBatch(jobId: string): Promise<{
  processed: number;
  completed: boolean;
  success: number;
  failed: number;
}> {
  const batchSize = Number.isFinite(DEFAULT_BATCH_SIZE) && DEFAULT_BATCH_SIZE > 0 ? DEFAULT_BATCH_SIZE : 15;

  const { data: job, error: jobErr } = await supabaseAdmin
    .from("sms_bulk_jobs")
    .select("id, message, template_id, status, total_count, success_count, failed_count")
    .eq("id", jobId)
    .maybeSingle();

  if (jobErr || !job) return { processed: 0, completed: false, success: 0, failed: 0 };
  if (job.status === "completed" || job.status === "cancelled") {
    return {
      processed: 0,
      completed: true,
      success: job.success_count ?? 0,
      failed: job.failed_count ?? 0,
    };
  }

  await supabaseAdmin
    .from("sms_bulk_jobs")
    .update({ status: "processing", started_at: new Date().toISOString() })
    .eq("id", jobId)
    .in("status", ["pending", "processing"]);

  let templateBody: string | null = null;
  if (job.template_id) {
    const tpl = await getSmsTemplateById(String(job.template_id));
    templateBody = tpl?.body ?? null;
  }
  const baseMessage = typeof job.message === "string" ? job.message : "";

  const { data: pendingItems, error: itemsErr } = await supabaseAdmin
    .from("sms_bulk_job_items")
    .select("id, recipient_phone, inquiry_id, member_id, recipient_name")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .limit(batchSize);

  if (itemsErr || !pendingItems?.length) {
    const success = job.success_count ?? 0;
    const failed = job.failed_count ?? 0;
    await supabaseAdmin
      .from("sms_bulk_jobs")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", jobId);

    if (success + failed > 0) {
      await createSmsBulkCompletedNotification({
        jobId,
        total: job.total_count ?? success + failed,
        success,
        failed,
      });
    }
    return { processed: 0, completed: true, success, failed };
  }

  let batchSuccess = 0;
  let batchFailed = 0;

  for (const item of pendingItems) {
    const phone = typeof item.recipient_phone === "string" ? item.recipient_phone : "";
    const name = typeof item.recipient_name === "string" ? item.recipient_name : "";
    const inquiryId = item.inquiry_id != null ? String(item.inquiry_id) : null;
    const rawMessage = templateBody ?? baseMessage;
    const message = applySmsTemplate(rawMessage, { name, phone });

    const result = await sendAdminSms({
      receiver: phone,
      message,
      inquiryId,
      skipFailureNotification: true,
    });

    const nowIso = new Date().toISOString();
    if (result.ok) {
      batchSuccess += 1;
      await supabaseAdmin
        .from("sms_bulk_job_items")
        .update({
          status: "success",
          message_log_id: result.logId,
          processed_at: nowIso,
        })
        .eq("id", item.id);
    } else {
      batchFailed += 1;
      await supabaseAdmin
        .from("sms_bulk_job_items")
        .update({
          status: "failed",
          message_log_id: result.logId,
          failure_reason: result.failureReason ?? "발송 실패",
          processed_at: nowIso,
        })
        .eq("id", item.id);
    }
  }

  const newSuccess = (job.success_count ?? 0) + batchSuccess;
  const newFailed = (job.failed_count ?? 0) + batchFailed;

  const { count: remaining } = await supabaseAdmin
    .from("sms_bulk_job_items")
    .select("*", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", "pending");

  const completed = (remaining ?? 0) === 0;

  await supabaseAdmin
    .from("sms_bulk_jobs")
    .update({
      success_count: newSuccess,
      failed_count: newFailed,
      status: completed ? "completed" : "processing",
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", jobId);

  if (completed) {
    await createSmsBulkCompletedNotification({
      jobId,
      total: job.total_count ?? newSuccess + newFailed,
      success: newSuccess,
      failed: newFailed,
    });
  }

  return {
    processed: pendingItems.length,
    completed,
    success: newSuccess,
    failed: newFailed,
  };
}

export async function getPendingBulkJobIds(limit = 5): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("sms_bulk_jobs")
    .select("id")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data.map((r) => String(r.id));
}
