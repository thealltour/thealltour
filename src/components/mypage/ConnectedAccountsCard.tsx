"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { MyPageCard } from "@/components/mypage/ui/MyPageCard";
import { Button } from "@/components/ui/Button";
import type { AuthProviderId } from "@/lib/auth/types";

type ProviderRow = {
  provider: AuthProviderId;
  display_name: string | null;
  email: string | null;
  linked_at: string;
};

type AuthSummary = {
  hasPassword: boolean;
  signupMethod: string;
  providers: ProviderRow[];
  availableProviders: AuthProviderId[];
};

const PROVIDER_LABELS: Record<AuthProviderId, string> = {
  google: "Google",
  kakao: "카카오",
  naver: "네이버",
};

type ConnectedAccountsCardProps = {
  initialSummary: AuthSummary;
};

export default function ConnectedAccountsCard({ initialSummary }: ConnectedAccountsCardProps) {
  const router = useRouter();
  const [summary, setSummary] = useState(initialSummary);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const refreshSummary = useCallback(async () => {
    const response = await fetch("/api/me/auth-providers");
    if (response.ok) {
      const data = (await response.json()) as AuthSummary;
      setSummary(data);
    }
  }, []);

  async function handleUnlink(provider: AuthProviderId) {
    setMessage("");
    setError("");
    setLoadingProvider(provider);
    try {
      const response = await fetch(`/api/me/auth-providers/${provider}`, { method: "DELETE" });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setError(result.message ?? "연결 해제에 실패했습니다.");
        return;
      }
      setMessage(result.message ?? "연결이 해제되었습니다.");
      await refreshSummary();
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoadingProvider(null);
    }
  }

  function handleLink(provider: AuthProviderId) {
    const params = new URLSearchParams({ mode: "link", next: "/mypage/profile" });
    window.location.href = `/api/auth/${provider}/start?${params.toString()}`;
  }

  return (
    <MyPageCard>
      <h2 className="text-base font-semibold text-[var(--text-primary)]">연결된 로그인</h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {summary.hasPassword ? "아이디·비밀번호 로그인 사용 중" : "소셜 로그인 전용 계정"}
      </p>

      <ul className="mt-4 space-y-3">
        {summary.hasPassword ? (
          <li className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3 text-sm">
            <span>아이디·비밀번호</span>
            <span className="text-[var(--text-muted)]">연결됨</span>
          </li>
        ) : null}
        {summary.providers.map((row) => (
          <li
            key={row.provider}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-4 py-3 text-sm"
          >
            <div>
              <span className="font-medium">{PROVIDER_LABELS[row.provider]}</span>
              {row.email ? (
                <span className="ml-2 text-[var(--text-muted)]">{row.email}</span>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loadingProvider === row.provider}
              onClick={() => handleUnlink(row.provider)}
            >
              연결 해제
            </Button>
          </li>
        ))}
      </ul>

      {summary.availableProviders.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.availableProviders.map((provider) => (
            <Button
              key={provider}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleLink(provider)}
            >
              {PROVIDER_LABELS[provider]} 연결
            </Button>
          ))}
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-[var(--success)]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
    </MyPageCard>
  );
}
