/**
 * MQ-4 — publishable success / approval gates.
 * Deterministic fallback is continuity/debug only — never approvable production success.
 */

import type {
  PublishableChannelContent,
  PublishableContentStatus,
} from "@/lib/marketing/publishable/contracts";

const PUBLISHABLE_SUCCESS_STATUSES: ReadonlySet<PublishableContentStatus> = new Set([
  "generated",
  "validated",
  "human_edited",
]);

export function isPublishableSuccessStatus(status: PublishableContentStatus): boolean {
  return PUBLISHABLE_SUCCESS_STATUSES.has(status);
}

export function channelCountsAsPublishableSuccess(
  content: Pick<PublishableChannelContent, "status" | "validation" | "provenance" | "publishableSuccess"> | null | undefined,
): boolean {
  if (!content) return false;
  if (typeof content.publishableSuccess === "boolean") return content.publishableSuccess;
  if (content.status === "human_edited") return content.validation?.ok !== false;
  if (content.provenance?.composer === "deterministic_fallback") return false;
  if (content.status === "fallback_generated") return false;
  if (content.status === "generation_failed" || content.status === "validation_failed") return false;
  return isPublishableSuccessStatus(content.status) && content.validation?.ok === true;
}

export function channelRequiresRegeneration(
  content: Pick<
    PublishableChannelContent,
    "status" | "needsRegeneration" | "provenance" | "publishableSuccess" | "validation"
  > | null | undefined,
): boolean {
  if (!content) return true;
  if (content.needsRegeneration) return true;
  return !channelCountsAsPublishableSuccess(content);
}

export function approvalBlockedReasonForChannel(
  content: Pick<
    PublishableChannelContent,
    "status" | "provenance" | "publishableSuccess" | "needsRegeneration" | "validation"
  > | null | undefined,
): string | null {
  if (!content) return "regeneration_required:missing_channel_content";
  if (content.status === "human_edited") return null;
  if (channelCountsAsPublishableSuccess(content)) return null;
  if (content.status === "fallback_generated" || content.provenance?.composer === "deterministic_fallback") {
    return "regeneration_required:fallback_generated_not_approvable";
  }
  if (content.status === "generation_failed") {
    return "regeneration_required:generation_failed";
  }
  if (content.status === "validation_failed") {
    return "regeneration_required:validation_failed";
  }
  return "regeneration_required";
}
