import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getUpcomingBirthdays } from "@/lib/adminBirthdays";

const BIRTHDAY_WINDOW_DAYS = 28;

export type AdminNotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  target_url: string | null;
  is_read: boolean;
  created_at: string | null;
};

type NewMemberNotificationInput = {
  memberId: string;
  username: string;
  name: string;
};

type NewReviewNotificationInput = {
  reviewId: string;
  authorName: string;
  title: string;
};

type NewInquiryNotificationInput = {
  inquiryId: string;
  name: string;
  phone: string;
  content: string;
};

function getKstYear() {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kst.getFullYear();
}

export async function ensureBirthdayNotifications() {
  const upcomingBirthdays = await getUpcomingBirthdays(BIRTHDAY_WINDOW_DAYS);
  if (upcomingBirthdays.length === 0) return;

  const year = getKstYear();
  const payload = upcomingBirthdays.map((member) => ({
    type: "birthday_upcoming",
    title: "생일 4주 이내 회원",
    message: `${member.name}(${member.username}) · ${member.month}/${member.day} · D-${member.daysLeft}`,
    target_url: "/theall_manager_only/members",
    unique_key: `birthday:${member.id}:${year}`,
    is_read: false,
    payload: {
      member_id: member.id,
      member_name: member.name,
      member_username: member.username,
      phone: member.phone,
      month: member.month,
      day: member.day,
      days_left: member.daysLeft,
      year,
    },
  }));

  await supabaseAdmin.from("admin_notifications").upsert(payload, {
    onConflict: "unique_key",
    ignoreDuplicates: true,
  });
}

export async function createNewMemberNotification(input: NewMemberNotificationInput) {
  await supabaseAdmin.from("admin_notifications").upsert(
    {
      type: "new_member",
      title: "신규 회원 가입",
      message: `${input.name} (${input.username}) 회원이 가입했습니다.`,
      target_url: "/theall_manager_only/members",
      unique_key: `new_member:${input.memberId}`,
      is_read: false,
      payload: {
        member_id: input.memberId,
        username: input.username,
        name: input.name,
      },
    },
    { onConflict: "unique_key", ignoreDuplicates: true },
  );
}

export async function createNewReviewNotification(input: NewReviewNotificationInput) {
  await supabaseAdmin.from("admin_notifications").upsert(
    {
      type: "new_review",
      title: "신규 후기 등록",
      message: `${input.authorName}님이 후기 "${input.title}"를 등록했습니다.`,
      target_url: "/theall_manager_only/reviews/moderation?filter=flagged",
      unique_key: `new_review:${input.reviewId}`,
      is_read: false,
      payload: {
        review_id: input.reviewId,
        author_name: input.authorName,
        title: input.title,
      },
    },
    { onConflict: "unique_key", ignoreDuplicates: true },
  );
}

export async function createNewInquiryNotification(input: NewInquiryNotificationInput) {
  const shortContent = input.content.length > 36 ? `${input.content.slice(0, 36)}...` : input.content;
  await supabaseAdmin.from("admin_notifications").upsert(
    {
      type: "new_inquiry",
      title: "신규 상담 신청",
      message: `${input.name} (${input.phone})님 문의: ${shortContent}`,
      target_url: `/admin/inquiries?id=${input.inquiryId}`,
      unique_key: `new_inquiry:${input.inquiryId}`,
      is_read: false,
      payload: {
        inquiry_id: input.inquiryId,
        name: input.name,
        phone: input.phone,
        content: input.content,
      },
    },
    { onConflict: "unique_key", ignoreDuplicates: true },
  );
}

export async function getUnreadNotificationCount() {
  const result = await supabaseAdmin
    .from("admin_notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  if (result.error) return 0;
  return result.count ?? 0;
}

export async function prepareAdminNotificationsAndGetUnreadCount() {
  await ensureBirthdayNotifications();
  return getUnreadNotificationCount();
}

export async function getAdminNotifications() {
  await ensureBirthdayNotifications();
  const result = await supabaseAdmin
    .from("admin_notifications")
    .select("id,type,title,message,target_url,is_read,created_at")
    .order("is_read", { ascending: true })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (result.error) {
    return [] as AdminNotificationItem[];
  }
  return (result.data ?? []) as AdminNotificationItem[];
}
