import {
  MAX_SHORTFORM_VIDEO_RENDER_ERROR_CODE_LENGTH,
  MAX_SHORTFORM_VIDEO_RENDER_ERROR_SUMMARY_LENGTH,
} from "@/lib/marketing/assets/shortform/renderJob/contracts";

export function sanitizeShortformVideoRenderErrorSummary(
  error: unknown,
  limit = MAX_SHORTFORM_VIDEO_RENDER_ERROR_SUMMARY_LENGTH,
): string {
  let text = error instanceof Error ? error.message : String(error ?? "unknown_error");
  text = text
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/sk-[a-zA-Z0-9_-]+/gi, "[redacted]")
    .replace(/eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, "[redacted-jwt]")
    .replace(/PEXELS_API_KEY\s*=\s*\S+/gi, "PEXELS_API_KEY=[redacted]")
    .replace(/PIXABAY_API_KEY\s*=\s*\S+/gi, "PIXABAY_API_KEY=[redacted]")
    .replace(/OMNIVOICE_API_KEY\s*=\s*\S+/gi, "OMNIVOICE_API_KEY=[redacted]")
    .replace(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/gi, "SUPABASE_SERVICE_ROLE_KEY=[redacted]")
    .replace(/Authorization:\s*\S+/gi, "Authorization: [redacted]")
    .replace(/\/home\/[^\s:]+/g, "[path]")
    .replace(/\/mnt\/[^\s:]+/g, "[path]");
  text = text.split("\n")[0]?.trim() || "unknown_error";
  return text.slice(0, limit);
}

export function sanitizeShortformVideoRenderErrorCode(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  const cleaned = code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, MAX_SHORTFORM_VIDEO_RENDER_ERROR_CODE_LENGTH);
  return cleaned || null;
}
