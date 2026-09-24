#!/usr/bin/env node
/**
 * Fail-fast Marketing Hermes runtime contract enforcement (Phase 2).
 *
 *   npm run check:marketing-hermes-runtime
 */
import { assertMarketingHermesRuntimeEnforcement } from "../src/lib/marketing/hermesRuntime/enforcement";
import { assertNoUnregisteredDirectHermesSpawns } from "../src/lib/marketing/hermesRuntime/directSpawnGuard";
import { assertNoSpecialistGatewayTokenDuplication } from "../src/lib/marketing/hermesRuntime/credentialDuplicationGuard";

function main(): void {
  assertMarketingHermesRuntimeEnforcement();
  assertNoUnregisteredDirectHermesSpawns();
  assertNoSpecialistGatewayTokenDuplication();
  console.log("check:marketing-hermes-runtime PASS");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
