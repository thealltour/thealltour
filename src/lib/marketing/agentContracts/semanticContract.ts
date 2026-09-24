/**
 * Marketing Agent Semantic Contract (Phase 3A).
 *
 * WHAT the agent owns / reads / must not own.
 * Separated from MarketingHermesRuntimeContract (HOW the agent runs).
 * Runtime registry must not interpret these fields.
 */

export type MarketingAgentSemanticContract = {
  profileId: string;
  authority: {
    owns: string[];
    reads: string[];
    advisory: string[];
    mustNotOwn: string[];
  };
  inputs: {
    required: string[];
    optional?: string[];
  };
  output?: {
    artifactId?: string;
  };
  docs?: {
    notes?: string[];
  };
};
