#!/usr/bin/env node
/**
 * Fail-fast Marketing Agent Semantic + Artifact contracts (Phase 3A).
 *
 *   npm run check:marketing-agent-contracts
 */
import { assertMarketingAgentContractsHealthy } from "../src/lib/marketing/agentContracts/enforcement";

function main(): void {
  assertMarketingAgentContractsHealthy();
  console.log("check:marketing-agent-contracts PASS");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
