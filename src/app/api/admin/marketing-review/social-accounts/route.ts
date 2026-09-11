import { requireAdminPermission } from "@/lib/apiAuth";
import { createSocialRepository } from "@/lib/marketing/social/repository/createSocialRepository";

export const dynamic = "force-dynamic";

/**
 * OPS-1 — Safe SocialAccount list for Manual Publication Bridge selector.
 * Returns channel/display identity only — never credentials or tokens.
 */
export async function GET() {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  try {
    const repo = await createSocialRepository();
    const accounts = await repo.listSocialAccounts({
      status: ["connected", "disconnected"],
      limit: 50,
    });
    return Response.json(
      {
        accounts: accounts.map((account) => ({
          id: account.id,
          channel: account.channel,
          provider: account.provider,
          displayName: account.displayName ?? null,
          externalIdentityId: account.externalIdentityId,
          status: account.status,
          label: [
            account.channel,
            account.displayName?.trim() || account.externalIdentityId,
            account.status === "connected" ? null : account.status,
          ]
            .filter(Boolean)
            .join(" · "),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "list_failed";
    return Response.json({ message, accounts: [] }, { status: 500 });
  }
}
