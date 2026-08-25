/**
 * Meta-first identity mapping example (STEP 3-3/3-4).
 * One grant → bindings → many identities → SocialAccounts.
 * Credentials only on AuthorizationGrant. Opaque handles only.
 */

import type { AuthorizationGrant } from "@/lib/marketing/social/domain/authorization";
import type {
  IdentityGrantBinding,
  ProviderIdentity,
  SocialAccount,
} from "@/lib/marketing/social/domain/accounts";
import { createCredentialReference } from "@/lib/marketing/social/domain/credentials";

const EXAMPLE_GRANT_ID = "grant_meta_example_001";
const EXAMPLE_CRED = createCredentialReference({
  storeHandle: "store:meta:example-grant-001",
  provider: "meta",
  family: "oauth2_user",
});

export function buildMetaMultiIdentityExample(): {
  grant: AuthorizationGrant;
  identities: ProviderIdentity[];
  bindings: IdentityGrantBinding[];
  accounts: SocialAccount[];
} {
  const identities: ProviderIdentity[] = [
    {
      id: "pid_fb_page_1",
      provider: "meta",
      kind: "facebook_page",
      externalId: "page_ext_1001",
      displayName: "Example Page",
      channelHints: ["facebook"],
      extension: { tasks: "CREATE_CONTENT" },
    },
    {
      id: "pid_ig_pro_1",
      provider: "meta",
      kind: "instagram_professional",
      externalId: "ig_ext_2002",
      displayName: "Example IG",
      channelHints: ["instagram"],
      extension: { account_type: "BUSINESS" },
    },
    {
      id: "pid_threads_1",
      provider: "meta",
      kind: "threads_profile",
      externalId: "threads_ext_3003",
      displayName: "Example Threads",
      channelHints: ["threads"],
    },
  ];

  const bindings: IdentityGrantBinding[] = identities.map((identity, index) => ({
    id: `binding_${index + 1}`,
    providerIdentityId: identity.id,
    authorizationGrantId: EXAMPLE_GRANT_ID,
    status: "active",
  }));

  const grant: AuthorizationGrant = {
    id: EXAMPLE_GRANT_ID,
    provider: "meta",
    status: "active",
    credentialFamily: "oauth2_user",
    permissions: [
      { code: "pages_manage_posts", label: "Page posts" },
      { code: "instagram_content_publish", label: "IG publish" },
      { code: "threads_content_publish", label: "Threads publish" },
      { code: "instagram_manage_insights", label: "IG insights" },
      { code: "threads_manage_insights", label: "Threads insights" },
    ],
    credentialRef: EXAMPLE_CRED,
    providerIdentityIds: identities.map((item) => item.id),
    issuedAt: "2026-08-25T00:00:00.000Z",
    expiresAt: "2026-10-24T00:00:00.000Z",
    refreshSupported: true,
    reauthorizationRequired: false,
    lifecycle: {
      expiresAt: "2026-10-24T00:00:00.000Z",
      refreshSupported: true,
      reauthorizationRequired: false,
    },
  };

  const accounts: SocialAccount[] = [
    {
      id: "sa_facebook_1",
      provider: "meta",
      channel: "facebook",
      providerIdentityId: "pid_fb_page_1",
      externalIdentityId: "page_ext_1001",
      displayName: "Example Page",
      status: "connected",
      activeAuthorizationGrantId: EXAMPLE_GRANT_ID,
    },
    {
      id: "sa_instagram_1",
      provider: "meta",
      channel: "instagram",
      providerIdentityId: "pid_ig_pro_1",
      externalIdentityId: "ig_ext_2002",
      displayName: "Example IG",
      status: "connected",
      activeAuthorizationGrantId: EXAMPLE_GRANT_ID,
    },
    {
      id: "sa_threads_1",
      provider: "meta",
      channel: "threads",
      providerIdentityId: "pid_threads_1",
      externalIdentityId: "threads_ext_3003",
      displayName: "Example Threads",
      status: "connected",
      activeAuthorizationGrantId: EXAMPLE_GRANT_ID,
    },
  ];

  return { grant, identities, bindings, accounts };
}

/** Reauthorization: same identities, new grant, old binding revoked. */
export function buildMetaGrantReplacementExample(): {
  identities: ProviderIdentity[];
  oldGrant: AuthorizationGrant;
  newGrant: AuthorizationGrant;
  bindings: IdentityGrantBinding[];
} {
  const base = buildMetaMultiIdentityExample();
  const oldGrant: AuthorizationGrant = { ...base.grant, status: "revoked" };
  const newCred = createCredentialReference({
    storeHandle: "store:meta:example-grant-002",
    provider: "meta",
    family: "oauth2_user",
  });
  const newGrant: AuthorizationGrant = {
    ...base.grant,
    id: "grant_meta_example_002",
    status: "active",
    credentialRef: newCred,
    issuedAt: "2026-08-25T12:00:00.000Z",
  };
  const bindings: IdentityGrantBinding[] = [
    ...base.bindings.map((b) => ({ ...b, status: "revoked" as const })),
    ...base.identities.map((identity, index) => ({
      id: `binding_new_${index + 1}`,
      providerIdentityId: identity.id,
      authorizationGrantId: newGrant.id,
      status: "active" as const,
    })),
  ];
  return { identities: base.identities, oldGrant, newGrant, bindings };
}
