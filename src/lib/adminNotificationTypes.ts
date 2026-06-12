export const SMS_NOTIFICATION_TYPES = new Set([
  "inbound_sms_reply",
  "inbound_sms_unmatched",
  "outbound_sms_failed",
  "sms_bulk_completed",
]);

export function isSmsNotificationType(type: string): boolean {
  return SMS_NOTIFICATION_TYPES.has(type);
}

export function notificationTypeIcon(type: string): string {
  if (isSmsNotificationType(type)) return "📱 ";
  if (type === "birthday_upcoming") return "🎂 ";
  if (type === "new_member") return "👤 ";
  if (type === "new_review") return "📝 ";
  if (type === "new_inquiry") return "📞 ";
  return "🔔 ";
}
