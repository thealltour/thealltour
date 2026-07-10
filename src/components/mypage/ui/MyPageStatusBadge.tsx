import { Badge, type BadgeProps } from "@/components/ui/Badge";

export const REDEMPTION_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "반려",
  SHIPPED: "발송 완료",
  COMPLETED: "수령 완료",
  CANCELED: "취소",
};

export type ReviewStatusVariant = "writable" | "draft" | "submitted";

function variantForStatus(status: string): BadgeProps["variant"] {
  switch (status) {
    case "REQUESTED":
    case "PENDING":
    case "pending_deposit":
      return "warning";
    case "APPROVED":
    case "COMPLETED":
    case "completed":
    case "reserved":
      return "success";
    case "REJECTED":
    case "CANCELED":
    case "canceled":
      return "danger";
    case "SHIPPED":
    case "partial":
      return "primary";
    case "paid":
      return "success";
    default:
      return "neutral";
  }
}

function variantForReview(variant: ReviewStatusVariant): BadgeProps["variant"] {
  switch (variant) {
    case "writable":
      return "primary";
    case "draft":
      return "warning";
    case "submitted":
      return "success";
    default:
      return "neutral";
  }
}

type MyPageStatusBadgeProps = {
  status?: string;
  label?: string;
  reviewVariant?: ReviewStatusVariant;
};

export function MyPageStatusBadge({ status, label, reviewVariant }: MyPageStatusBadgeProps) {
  if (reviewVariant) {
    const reviewLabels: Record<ReviewStatusVariant, string> = {
      writable: "작성 가능",
      draft: "작성 중",
      submitted: "작성 완료",
    };
    return <Badge variant={variantForReview(reviewVariant)}>{label ?? reviewLabels[reviewVariant]}</Badge>;
  }

  const displayLabel = label ?? (status ? (REDEMPTION_STATUS_LABEL[status] ?? status) : "");
  return <Badge variant={variantForStatus(status ?? "")}>{displayLabel}</Badge>;
}
