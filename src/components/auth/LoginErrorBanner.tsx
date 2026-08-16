import { getAuthErrorMessage } from "@/lib/auth/authErrors";

type LoginErrorBannerProps = {
  errorCode?: string | null;
};

export default function LoginErrorBanner({ errorCode }: LoginErrorBannerProps) {
  const message = getAuthErrorMessage(errorCode);
  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] px-4 py-3 text-sm text-[var(--danger)]"
    >
      {message}
    </div>
  );
}
