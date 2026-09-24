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
  MARKETING_HERMES_DIRECT_SPAWN_DEBT,
  type DirectHermesSpawnDebtEntry,
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
