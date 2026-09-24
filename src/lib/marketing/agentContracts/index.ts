export type { MarketingAgentSemanticContract } from "@/lib/marketing/agentContracts/semanticContract";
export type {
  MarketingArtifactContract,
  MarketingArtifactGenerateFailPolicy,
} from "@/lib/marketing/agentContracts/artifactContract";

export {
  MARKETING_AGENT_VOCABULARY_KEYS,
  MARKETING_AGENT_VOCABULARY_SET,
  MARKETING_ROLE_VOCABULARY_SEPARATION,
  type MarketingAgentVocabularyKey,
} from "@/lib/marketing/agentContracts/vocabulary";

export {
  MARKETING_AGENT_SEMANTIC_REGISTRY,
  PHASE_3A_SEMANTIC_MIGRATED_PROFILE_IDS,
  getMarketingAgentSemanticContract,
  listMarketingAgentSemanticContracts,
  requireMarketingAgentSemanticContract,
} from "@/lib/marketing/agentContracts/semanticRegistry";

export {
  MARKETING_ARTIFACT_REGISTRY,
  getMarketingArtifactContract,
  listMarketingArtifactContracts,
  requireMarketingArtifactContract,
} from "@/lib/marketing/agentContracts/artifactRegistry";

export {
  MARKETING_AGENT_CONTRACT_DEBT,
  type MarketingAgentContractDebtEntry,
} from "@/lib/marketing/agentContracts/debt";

export {
  assertMarketingAgentContractsHealthy,
  collectAllMarketingAgentContractIssues,
  collectArtifactDependencyIssues,
  collectArtifactProducerIssues,
  collectArtifactUniquenessIssues,
  collectAuthoritySanityIssues,
  collectSemanticRuntimeLinkageIssues,
  type MarketingAgentContractIssue,
} from "@/lib/marketing/agentContracts/enforcement";
