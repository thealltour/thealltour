/**
 * Explicit non-marketing Hermes profile inventory.
 * Implicit exclusion is forbidden — every skipped profile must be listed here.
 */

export type ExcludedHermesProfileKind = "excluded_test_profile";

export type ExcludedHermesProfileEntry = {
  profileId: string;
  kind: ExcludedHermesProfileKind;
  reason: string;
};

/**
 * Profiles that exist under ~/.hermes/profiles but are intentionally outside
 * the Marketing Hermes runtime registry.
 */
export const EXCLUDED_HERMES_PROFILE_INVENTORY: readonly ExcludedHermesProfileEntry[] = [
  {
    profileId: "runtime-spike",
    kind: "excluded_test_profile",
    reason: "AI Runtime gateway spike / Desktop e2e — not a marketing specialist",
  },
  {
    profileId: "test1",
    kind: "excluded_test_profile",
    reason: "Local Hermes scratch profile — not marketing production",
  },
];

export const EXCLUDED_HERMES_PROFILE_IDS = new Set(
  EXCLUDED_HERMES_PROFILE_INVENTORY.map((e) => e.profileId),
);

export function isExcludedHermesProfile(profileId: string): boolean {
  return EXCLUDED_HERMES_PROFILE_IDS.has(profileId);
}
