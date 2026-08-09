import SiteHeader from "@/components/site-chrome/SiteHeader";
import LinkAccountForm from "@/components/auth/LinkAccountForm";
import { isAuthProviderId } from "@/lib/auth/providerRegistry";
import type { AuthProviderId } from "@/lib/auth/types";

type PageProps = {
  searchParams?: Promise<{
    pending?: string;
    identifier?: string;
    matched_by?: string;
    provider?: string;
  }>;
};

export default async function LinkAccountPage({ searchParams }: PageProps) {
  const resolved = (await searchParams) ?? {};
  const pendingId = resolved.pending?.trim() ?? "";
  const identifier = resolved.identifier?.trim() ?? "";
  const matchedByRaw = resolved.matched_by?.trim() ?? "";
  const matchedBy: "email" | "phone" = matchedByRaw === "phone" ? "phone" : "email";
  const providerRaw = resolved.provider?.trim() ?? "";

  const valid = pendingId && identifier && isAuthProviderId(providerRaw);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--surface-muted)] to-[var(--bg)] text-[var(--text-primary)]">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-md flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[var(--card)] p-8 shadow-[var(--shadow-soft-strong)] ring-1 ring-[var(--border)] md:p-10">
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl font-bold">계정 연결</h1>
          </div>
          {valid ? (
            <LinkAccountForm
              pendingId={pendingId}
              identifier={identifier}
              matchedBy={matchedBy}
              provider={providerRaw as AuthProviderId}
            />
          ) : (
            <p className="text-sm text-red-500">유효하지 않은 연결 요청입니다. 다시 로그인해 주세요.</p>
          )}
        </section>
      </main>
    </div>
  );
}
