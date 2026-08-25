/**
 * Runtime publication eligibility (STEP 3-3) — design only, never activates adapters.
 *
 * Independent factors; not reducible to approved=true or hasToken=true.
 */

import { getSocialCapability } from "@/lib/marketing/social/providers/capabilityRegistry";
import { isCapabilityActionable } from "@/lib/marketing/social/domain/capabilityStatus";
import {
  assertSocialAccountProviderChannelConsistency,
  type SocialAccount,
} from "@/lib/marketing/social/domain/accounts";
import {
  isAuthorizationGrantUsable,
  type AuthorizationGrant,
} from "@/lib/marketing/social/domain/authorization";
import type { ProviderIdentity } from "@/lib/marketing/social/domain/accounts";
import type { SocialChannel } from "@/lib/marketing/social/domain/providers";
import { PUBLICATION_FLOW_INACTIVE } from "@/lib/marketing/social/publication/governanceBoundary";
import { assertNoRawCredentialMaterial } from "@/lib/marketing/social/domain/credentials";

export type GovernanceDecisionForEligibility = "ALLOW" | "REVIEW" | "BLOCK";

export type PublicationEligibilityInput = {
  channel: SocialChannel;
  socialAccount: SocialAccount | null;
  authorizationGrant: AuthorizationGrant | null;
  providerIdentity: ProviderIdentity | null;
  governanceDecision?: GovernanceDecisionForEligibility | null;
  humanApprovalGranted?: boolean;
};

export type PublicationEligibilityFactor =
  | "publication_flow_active"
  | "channel_capability_actionable"
  | "social_account_connected"
  | "provider_identity_linked"
  | "authorization_grant_active"
  | "credential_reference_present"
  | "governance_allow"
  | "human_approval";

export type PublicationEligibilityResult = {
  eligible: boolean;
  /** Always false while PUBLICATION_FLOW_INACTIVE */
  publicationFlowActive: boolean;
  factors: Record<PublicationEligibilityFactor, boolean>;
  reasons: string[];
};

export function evaluatePublicationEligibility(
  input: PublicationEligibilityInput,
): PublicationEligibilityResult {
  assertNoRawCredentialMaterial(input);

  const reasons: string[] = [];
  const publicationFlowActive = !PUBLICATION_FLOW_INACTIVE;

  const capability = getSocialCapability(input.channel);
  const channelCapabilityActionable =
    capability != null && isCapabilityActionable(capability.publication);

  let socialAccountConnected = false;
  if (input.socialAccount) {
    assertSocialAccountProviderChannelConsistency(input.socialAccount);
    if (input.socialAccount.channel !== input.channel) {
      reasons.push("social_account_channel_mismatch");
    } else {
      socialAccountConnected = input.socialAccount.status === "connected";
    }
  } else {
    reasons.push("social_account_missing");
  }

  const providerIdentityLinked =
    input.providerIdentity != null &&
    input.socialAccount != null &&
    input.providerIdentity.id === input.socialAccount.providerIdentityId &&
    input.providerIdentity.provider === input.socialAccount.provider;

  if (input.providerIdentity && input.socialAccount && !providerIdentityLinked) {
    reasons.push("provider_identity_not_linked");
  }

  const authorizationGrantActive =
    input.authorizationGrant != null && isAuthorizationGrantUsable(input.authorizationGrant);

  if (!input.authorizationGrant) reasons.push("authorization_grant_missing");
  else if (!authorizationGrantActive) reasons.push(`authorization_grant_${input.authorizationGrant.status}`);

  const credentialReferencePresent = Boolean(
    input.authorizationGrant?.credentialRef?.kind === "credential_reference",
  );
  if (!credentialReferencePresent) reasons.push("credential_reference_missing");

  if (
    input.socialAccount?.activeAuthorizationGrantId &&
    input.authorizationGrant &&
    input.socialAccount.activeAuthorizationGrantId !== input.authorizationGrant.id
  ) {
    reasons.push("active_grant_mismatch");
  }

  const governanceAllow = input.governanceDecision === "ALLOW";
  if (input.governanceDecision != null && !governanceAllow) {
    reasons.push(`governance_${input.governanceDecision.toLowerCase()}`);
  } else if (input.governanceDecision == null) {
    reasons.push("governance_decision_missing");
  }

  const humanApproval = input.humanApprovalGranted === true;
  if (!humanApproval) reasons.push("human_approval_required");

  if (!publicationFlowActive) reasons.push("publication_flow_inactive");
  if (!channelCapabilityActionable) reasons.push("channel_capability_not_actionable");
  if (input.socialAccount && !socialAccountConnected) reasons.push("social_account_not_connected");

  const factors: Record<PublicationEligibilityFactor, boolean> = {
    publication_flow_active: publicationFlowActive,
    channel_capability_actionable: channelCapabilityActionable,
    social_account_connected: socialAccountConnected,
    provider_identity_linked: providerIdentityLinked,
    authorization_grant_active: authorizationGrantActive,
    credential_reference_present: credentialReferencePresent,
    governance_allow: governanceAllow,
    human_approval: humanApproval,
  };

  const eligible = Object.values(factors).every(Boolean);

  return {
    eligible,
    publicationFlowActive,
    factors,
    reasons: eligible ? [] : [...new Set(reasons)],
  };
}
