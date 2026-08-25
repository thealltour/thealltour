/**
 * Governance policy / approval workflow read-only smoke test.
 *
 * DB INSERT/UPDATE 없음. 게시/삭제 없음. approval row 생성 없음.
 *
 * 실행:
 *   npx tsx scripts/test-governance-workflow.ts --title "효도여행" --body "부모님과 떠나는 일정" --channel threads
 *   npx tsx scripts/test-governance-workflow.ts --body "..." --channel instagram --product-id 실제-uuid --agenda-key filial-trip
 *
 * npx tsx는 Next.js env를 자동 로드하지 않으므로 .env / .env.local을 읽습니다.
 */

import { createRequire } from "node:module";
import { loadLocalEnv } from "./loadLocalEnv";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
const serverOnlyStub = require.resolve("./shims/server-only.js");
Module._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === "server-only") return serverOnlyStub;
  return originalResolve(request, parent, isMain, options);
};

loadLocalEnv();

async function main() {
  const { parseContentGovernanceCliArgs } = await import("../src/lib/marketing/governance/cli");
  const { evaluateGovernanceWorkflow } = await import("../src/lib/marketing/governance/evaluateGovernanceWorkflow");
  const args = parseContentGovernanceCliArgs(process.argv.slice(2));
  const result = await evaluateGovernanceWorkflow(args);

  console.log(`governanceDecision: ${result.governance.decision}`);
  console.log(`riskScore: ${result.governance.riskScore}`);
  console.log(`semanticAvailable: ${result.governance.semanticAvailable}`);
  console.log(`workflowAction: ${result.action}`);
  console.log(`workflowState: ${result.workflowState}`);
  console.log(`autoPublishAllowed: ${result.autoPublishAllowed}`);
  console.log(`humanApprovalRequired: ${result.humanApprovalRequired}`);
  console.log(`revisionRequired: ${result.revisionRequired}`);
  console.log(`policyVersion: ${result.policyVersion}`);
  console.log(`reasonCodes: ${result.reasons.map((reason) => reason.code).join(", ") || "(none)"}`);
  if (result.policyOverrides.length > 0) {
    console.log(`policyOverrides: ${result.policyOverrides.map((override) => override.code).join(", ")}`);
  }
  console.log(`summary: ${result.summary}`);
  const hints = result.revisionRequest?.revisionHints ?? [];
  console.log("revisionHints:");
  if (hints.length === 0) {
    console.log("- (none)");
  } else {
    for (const hint of hints) {
      console.log(`- ${hint}`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`governance workflow failed: ${message}`);
  process.exit(1);
});
