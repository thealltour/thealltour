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
  PLANNER_VOCABULARY_BOUNDARY_INVARIANTS,
  PLANNER_VOCABULARY_BOUNDARY_SEMANTIC_NOTES,
} from "@/lib/marketing/agentContracts/plannerVocabularyBoundary";

export {
  MARKETING_AGENT_SEMANTIC_REGISTRY,
  PHASE_3A_SEMANTIC_MIGRATED_PROFILE_IDS,
  PHASE_3E_DEPARTMENT_PROFILE_IDS,
  getMarketingAgentSemanticContract,
  listMarketingAgentSemanticContracts,
  requireMarketingAgentSemanticContract,
  type Phase3eDepartmentProfileId,
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
  PHASE_3B_WIRED_ARTIFACT_IDS,
  PHASE_3C_WIRED_ARTIFACT_IDS,
  PHASE_3D_WIRED_ARTIFACT_IDS,
  assertArtifactDependsOn,
  assertFingerprintSourcesInclude,
  getArtifactDependencies,
  getArtifactFailurePolicy,
  getArtifactLifecycleContract,
  getArtifactRepairAttemptBudget,
  isPhase3bWiredArtifact,
  isPhase3cWiredArtifact,
  isPhase3dWiredArtifact,
  lookupWiredArtifactContract,
  requireMaterializeInRepairLoop,
  requireOnGenerateFail,
  type ArtifactFailurePolicy,
  type Phase3bWiredArtifactId,
  type Phase3cWiredArtifactId,
  type Phase3dWiredArtifactId,
} from "@/lib/marketing/agentContracts/lifecycleHelpers";

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

export {
  assertSemanticCompletenessHealthy,
  buildSemanticCompletenessReport,
  type SemanticCompletenessClass,
  type SemanticCompletenessEntry,
  type SemanticCompletenessReport,
} from "@/lib/marketing/agentContracts/semanticCompleteness";
