/**
 * PR29: 리뷰 운영 알림 채널 인터페이스.
 * in-app만 실제 사용, Slack/email/webhook은 placeholder.
 */
import type { ReviewNotificationItem } from "@/types/reviewNotifications";

export interface ReviewNotificationChannelHandler {
  send(notification: ReviewNotificationItem): Promise<void>;
}

/** In-app: 저장은 persistence에서 하므로 발송만 로그/ no-op */
export const inAppReviewNotificationChannel: ReviewNotificationChannelHandler = {
  async send(notification: ReviewNotificationItem): Promise<void> {
    // 실제 저장은 createReviewNotifications에서 수행. 채널은 추후 다중 발송 시 사용.
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug("[ReviewNotifications] in-app:", notification.id, notification.title);
    }
  },
};

/** TODO: Slack 연동 시 구현 */
export const slackReviewNotificationChannel: ReviewNotificationChannelHandler = {
  async send(_notification: ReviewNotificationItem): Promise<void> {
    // TODO PR30+: Slack webhook 발송
  },
};

/** TODO: 이메일 연동 시 구현 */
export const emailReviewNotificationChannel: ReviewNotificationChannelHandler = {
  async send(_notification: ReviewNotificationItem): Promise<void> {
    // TODO PR30+: 이메일 발송
  },
};

/** TODO: 웹훅 연동 시 구현 */
export const webhookReviewNotificationChannel: ReviewNotificationChannelHandler = {
  async send(_notification: ReviewNotificationItem): Promise<void> {
    // TODO PR30+: 외부 웹훅 POST
  },
};
