import { requireAdminPermission } from "@/lib/apiAuth";
import { createSocialRepository } from "@/lib/marketing/social/repository/createSocialRepository";

export const dynamic = "force-dynamic";

/**
 * OPS-1 / CG-4C — Safe SocialAccount list for Manual Publication Bridge selector.
 * Optional ?channel= filters to compatible accounts. Never returns credentials.
 */
export async function GET(request: Request) {
  const auth = await requireAdminPermission("settings.manage");
  if (!auth.ok) return auth.res;

  try {
    const url = new URL(request.url);
    const channelFilter = url.searchParams.get("channel")?.trim() || null;
    const repo = await createSocialRepository();
    const accounts = await repo.listSocialAccounts({
      status: ["connected", "disconnected"],
      limit: 50,
    });
    const filtered = channelFilter
      ? accounts.filter((account) => account.channel === channelFilter && account.status === "connected")
      : accounts.filter((account) => account.status === "connected" || account.status === "disconnected");

    return Response.json(
      {
        accounts: filtered.map((account) => ({
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
        channelFilter,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "list_failed";
    return Response.json({ message, accounts: [] }, { status: 500 });
  }
}
