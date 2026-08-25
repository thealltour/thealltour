import { describe, expect, it } from "vitest";

import {
  PUBLICATION_FLOW_INACTIVE,
  SNS_SIDE_EFFECTS_STEP_3_3,
  SNS_SIDE_EFFECTS_STEP_3_4,
  assertCanInvokePublicationAdapter,
  assertNoRawCredentialMaterial,
  assertSocialAccountProviderChannelConsistency,
  authorizationHasPermission,
  buildMetaGrantReplacementExample,
  buildMetaMultiIdentityExample,
  createCredentialReference,
  evaluatePublicationEligibility,
  isAuthorizationGrantUsable,
  isPublicationSupported,
} from "@/lib/marketing/social";

describe("social account & credentials STEP 3-3/3-4", () => {
  it("keeps Meta multi-identity mapping under one grant without secrets", () => {
    const example = buildMetaMultiIdentityExample();
    expect(example.identities).toHaveLength(3);
    expect(example.accounts).toHaveLength(3);
    expect(example.bindings).toHaveLength(3);
    expect(example.grant.providerIdentityIds).toHaveLength(3);
    expect(new Set(example.accounts.map((a) => a.channel))).toEqual(
      new Set(["facebook", "instagram", "threads"]),
    );
    for (const account of example.accounts) {
      assertSocialAccountProviderChannelConsistency(account);
      expect(account.provider).toBe("meta");
      expect(account).not.toHaveProperty("credentialRef");
      expect(account.activeAuthorizationGrantId).toBe(example.grant.id);
    }
    expect(example.grant.credentialRef.kind).toBe("credential_reference");
    expect(authorizationHasPermission(example.grant, "threads_content_publish")).toBe(true);
    expect(isAuthorizationGrantUsable(example.grant)).toBe(true);
    assertNoRawCredentialMaterial(example);
  });

  it("rejects raw credential material on domain objects", () => {
    expect(() =>
      assertNoRawCredentialMaterial({
        id: "x",
        access_token: "leak",
      }),
    ).toThrow(/Raw credential material/);
    expect(() =>
      createCredentialReference({
        storeHandle: "access_token_abc",
        provider: "meta",
        family: "oauth2_user",
      }),
    ).toThrow(/opaque/);
  });

  it("separates capability metadata from runtime authorization", () => {
    expect(isPublicationSupported("threads")).toBe(false);
    const example = buildMetaMultiIdentityExample();
    expect(example.grant.status).toBe("active");
    expect(example.grant.permissions.length).toBeGreaterThan(0);
  });

  it("keeps eligibility false while publication flow is inactive", () => {
    expect(PUBLICATION_FLOW_INACTIVE).toBe(true);
    expect(SNS_SIDE_EFFECTS_STEP_3_3).toBe(0);
    expect(SNS_SIDE_EFFECTS_STEP_3_4).toBe(0);
    const example = buildMetaMultiIdentityExample();
    const threadsAccount = example.accounts.find((a) => a.channel === "threads")!;
    const identity = example.identities.find((i) => i.id === threadsAccount.providerIdentityId)!;
    const result = evaluatePublicationEligibility({
      channel: "threads",
      socialAccount: threadsAccount,
      authorizationGrant: example.grant,
      providerIdentity: identity,
      governanceDecision: "ALLOW",
      humanApprovalGranted: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.publicationFlowActive).toBe(false);
    expect(result.factors.publication_flow_active).toBe(false);
    expect(result.reasons).toContain("publication_flow_inactive");
    expect(() => assertCanInvokePublicationAdapter("publication_orchestrator")).toThrow(/denied/);
  });

  it("models grant lifecycle states", () => {
    const example = buildMetaMultiIdentityExample();
    const expired = { ...example.grant, status: "expired" as const };
    expect(isAuthorizationGrantUsable(expired)).toBe(false);
    const revoked = { ...example.grant, status: "revoked" as const };
    expect(isAuthorizationGrantUsable(revoked)).toBe(false);
  });

  it("represents grant replacement without destroying provider identities", () => {
    const replaced = buildMetaGrantReplacementExample();
    expect(replaced.identities).toHaveLength(3);
    expect(replaced.oldGrant.status).toBe("revoked");
    expect(replaced.newGrant.status).toBe("active");
    expect(replaced.newGrant.id).not.toBe(replaced.oldGrant.id);
    expect(replaced.newGrant.credentialRef.storeHandle).not.toBe(
      replaced.oldGrant.credentialRef.storeHandle,
    );
    const activeBindings = replaced.bindings.filter((b) => b.status === "active");
    const revokedBindings = replaced.bindings.filter((b) => b.status === "revoked");
    expect(activeBindings).toHaveLength(3);
    expect(revokedBindings).toHaveLength(3);
    for (const identity of replaced.identities) {
      expect(activeBindings.some((b) => b.providerIdentityId === identity.id)).toBe(true);
      expect(revokedBindings.some((b) => b.providerIdentityId === identity.id)).toBe(true);
    }
    assertNoRawCredentialMaterial(replaced);
  });
});
