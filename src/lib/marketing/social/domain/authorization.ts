/**
 * AuthorizationGrant + permission/scope metadata (STEP 3-3).
 * Providers may call permissions "scopes", "tasks", or "permissions" —
 * we store them as PermissionGrant.code strings.
 */

import type { CredentialFamily } from "@/lib/marketing/social/domain/capabilityStatus";
import type { CredentialReference, CredentialLifecycleHint } from "@/lib/marketing/social/domain/credentials";
import type { SocialProvider } from "@/lib/marketing/social/domain/providers";

export const AUTHORIZATION_GRANT_STATUSES = [
  "pending",
  "active",
  "expired",
  "revoked",
  "invalid",
] as const;

export type AuthorizationGrantStatus = (typeof AUTHORIZATION_GRANT_STATUSES)[number];

/**
 * Provider-granted permission/scope/task identifier.
 * Static required prerequisites stay in the capability registry;
 * these are runtime grants only.
 */
export type PermissionGrant = {
  /** Provider-native permission or scope string */
  code: string;
  /** Optional label for UI — not a secret */
  label?: string | null;
};

export type AuthorizationGrant = {
  id: string;
  provider: SocialProvider;
  status: AuthorizationGrantStatus;
  credentialFamily: CredentialFamily;
  permissions: PermissionGrant[];
  credentialRef: CredentialReference;
  /**
   * Convenience list of ProviderIdentity ids reachable under this grant.
   * Persistence source of truth: social_identity_grant_bindings.
   */
  providerIdentityIds: string[];
  /** Top-level reauth flag; also mirrored on grant.lifecycle when useful */
  reauthorizationRequired?: boolean;
  issuedAt?: string | null;
  expiresAt?: string | null;
  refreshSupported?: boolean;
  lifecycle?: CredentialLifecycleHint;
};

export function isAuthorizationGrantStatus(value: string): value is AuthorizationGrantStatus {
  return (AUTHORIZATION_GRANT_STATUSES as readonly string[]).includes(value);
}

export function isAuthorizationGrantUsable(grant: AuthorizationGrant): boolean {
  return grant.status === "active";
}

export function authorizationHasPermission(grant: AuthorizationGrant, code: string): boolean {
  return grant.permissions.some((item) => item.code === code);
}

export function listAuthorizationPermissions(grant: AuthorizationGrant): string[] {
  return grant.permissions.map((item) => item.code);
}
