export type {
  MarketingHermesAgentKind,
  MarketingHermesInferenceGatewayCredentialMode,
  MarketingHermesRuntimeContract,
} from "@/lib/marketing/hermesRuntime/contract";

export {
  MARKETING_HERMES_RUNTIME_REGISTRY,
  getMarketingHermesRuntimeContract,
  listMarketingHermesRuntimeContracts,
  listRegisteredMarketingHermesProfileIds,
  requireMarketingHermesRuntimeContract,
} from "@/lib/marketing/hermesRuntime/registry";

export {
  DEFAULT_HERMES_HOME,
  HERMES_GATEWAY_TOKEN_ENV,
  buildHermesProfileSpawnEnv,
  hermesGatewayTokenTestHooks,
  resolveInferenceGatewayTokenForHermesChild,
} from "@/lib/marketing/hermesRuntime/credentials";

export {
  buildHermesProfileArgv,
  invokeMarketingHermesAgent,
  marketingHermesLauncherTestHooks,
  spawnMarketingHermesProfileOnce,
  type InvokeMarketingHermesAgentInput,
  type MarketingHermesSpawnOnceFn,
} from "@/lib/marketing/hermesRuntime/launcher";

export {
  invokeMarketingHermesAgentSync,
  type InvokeMarketingHermesAgentSyncInput,
} from "@/lib/marketing/hermesRuntime/syncLauncher";

export {
  EXCLUDED_HERMES_PROFILE_IDS,
  EXCLUDED_HERMES_PROFILE_INVENTORY,
  isExcludedHermesProfile,
  type ExcludedHermesProfileEntry,
  type ExcludedHermesProfileKind,
} from "@/lib/marketing/hermesRuntime/excludedInventory";

export {
  MARKETING_HERMES_DEBT_INVENTORY,
  MARKETING_HERMES_DIRECT_SPAWN_ALLOWLIST,
  MARKETING_HERMES_DIRECT_SPAWN_DEBT,
  type DirectHermesSpawnDebtEntry,
  type MarketingHermesDebtCategory,
  type MarketingHermesDebtEntry,
} from "@/lib/marketing/hermesRuntime/directSpawnDebt";

export {
  NON_MARKETING_HERMES_PROFILE_IDS,
  assertMarketingHermesRegistryHealthy,
  collectMarketingHermesAliasPreflightIssues,
  collectMarketingHermesRegistryDrift,
  listHermesProfileIdsOnDisk,
  listMarketingHermesProfileIdsOnDisk,
  readHermesProfileModelConfig,
  resolveHermesProfilesRoot,
  resolveMarketingHermesProfileFixturesRoot,
} from "@/lib/marketing/hermesRuntime/preflight";

export {
  assertMarketingHermesRuntimeEnforcement,
  collectAllMarketingHermesEnforcementIssues,
  collectMarketingHermesCompletenessIssues,
  collectMarketingHermesRegistryStructuralIssues,
  collectMarketingHermesSpecialistPolicyIssues,
  type MarketingHermesEnforcementIssue,
} from "@/lib/marketing/hermesRuntime/enforcement";

export {
  assertNoUnregisteredDirectHermesSpawns,
  findDirectHermesSpawnViolations,
  type DirectHermesSpawnViolation,
} from "@/lib/marketing/hermesRuntime/directSpawnGuard";

export {
  assertNoSpecialistGatewayTokenDuplication,
  findSpecialistCredentialDuplicationViolations,
  listProfileLocalCredentialAllowlist,
  type CredentialDuplicationViolation,
} from "@/lib/marketing/hermesRuntime/credentialDuplicationGuard";
