import {
  assertSocialAccountProviderChannelConsistency,
  type ProviderIdentity,
  type SocialAccount,
} from "@/lib/marketing/social/domain/accounts";
import {
  isAuthorizationGrantUsable,
  type AuthorizationGrant,
} from "@/lib/marketing/social/domain/authorization";
import { CHANNEL_PROVIDER, type SocialChannel, type SocialProvider } from "@/lib/marketing/social/domain/providers";
import { assertNoRawCredentialMaterial } from "@/lib/marketing/social/domain/credentials";
import { SocialInvariantError } from "@/lib/marketing/social/repository/errors";

export function assertProviderChannelCompatible(provider: SocialProvider, channel: SocialChannel): void {
  const expected = CHANNEL_PROVIDER[channel];
  if (provider !== expected) {
    throw new SocialInvariantError(
      `provider/channel incompatible: channel=${channel} expects ${expected}, got ${provider}`,
    );
  }
}

export function assertAccountMatchesIdentity(account: SocialAccount, identity: ProviderIdentity): void {
  assertSocialAccountProviderChannelConsistency(account);
  if (account.providerIdentityId !== identity.id) {
    throw new SocialInvariantError("SocialAccount.providerIdentityId does not match ProviderIdentity.id");
  }
  if (account.provider !== identity.provider) {
    throw new SocialInvariantError("SocialAccount.provider does not match ProviderIdentity.provider");
  }
  if (account.externalIdentityId !== identity.externalId) {
    throw new SocialInvariantError("SocialAccount.externalIdentityId does not match ProviderIdentity.externalId");
  }
  if (identity.channelHints.length > 0 && !identity.channelHints.includes(account.channel)) {
    throw new SocialInvariantError(
      `ProviderIdentity channelHints do not include SocialAccount.channel=${account.channel}`,
    );
  }
}

export function assertGrantUsable(grant: AuthorizationGrant): void {
  if (!isAuthorizationGrantUsable(grant)) {
    throw new SocialInvariantError(`AuthorizationGrant status is not usable: ${grant.status}`);
  }
}

/** Soft pointer alone never confers authorization — binding + grant must both be active. */
export function assertActiveAuthorizationForAccount(input: {
  account: SocialAccount;
  identity: ProviderIdentity;
  grant: AuthorizationGrant | null;
  bindingStatus: "active" | "revoked" | string | null;
}): void {
  assertAccountMatchesIdentity(input.account, input.identity);
  if (!input.grant) {
    throw new SocialInvariantError("AuthorizationGrant missing");
  }
  assertGrantUsable(input.grant);
  if (input.bindingStatus !== "active") {
    throw new SocialInvariantError(
      `IdentityGrantBinding is not active (status=${input.bindingStatus ?? "missing"})`,
    );
  }
  if (
    input.account.activeAuthorizationGrantId &&
    input.account.activeAuthorizationGrantId !== input.grant.id
  ) {
    // Soft pointer mismatch is a warning signal — never treat soft pointer as authority.
    throw new SocialInvariantError(
      "SocialAccount.activeAuthorizationGrantId soft pointer does not match resolved grant",
    );
  }
}

export function assertOpaquePersistenceInput(value: unknown): void {
  assertNoRawCredentialMaterial(value);
}
