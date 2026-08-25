/**
 * Content governance read-only smoke test.
 *
 * DB INSERT/UPDATE 없음. 게시/삭제 없음.
 *
 * 실행:
 *   npx tsx scripts/test-content-governance.ts --title "효도여행" --body "부모님과 떠나는 일정" --channel threads
 *   npx tsx scripts/test-content-governance.ts --body "..." --channel threads --product-id 실제-uuid --agenda-key filial-trip
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
  const { evaluateContentGovernance } = await import("../src/lib/marketing/governance/evaluateContentGovernance");
  const args = parseContentGovernanceCliArgs(process.argv.slice(2));
  const result = await evaluateContentGovernance(args);
  console.log(`decision: ${result.decision}`);
  console.log(`riskScore: ${result.riskScore}`);
  console.log(`semanticAvailable: ${result.semanticAvailable}`);
  console.log(`reasons: ${result.reasons.map((reason) => reason.code).join(", ") || "(none)"}`);
  for (const reason of result.reasons) {
    const extra = [
      reason.value != null ? `value=${reason.value}` : null,
      reason.matchedContentId ? `matched=${reason.matchedContentId}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    console.log(`- ${reason.code} (${reason.severity})${extra ? ` ${extra}` : ""}`);
  }
  console.log("semantic top matches:");
  if (result.matchedMemories.length === 0) {
    console.log("- (none)");
  } else {
    for (const match of result.matchedMemories.slice(0, 5)) {
      console.log(
        `- ${match.score.toFixed(3)} ${match.contentId ?? match.memoryId} ${match.title ?? ""} [${match.channels.join(",")}]`,
      );
    }
  }
  console.log(
    `agenda stats: id=${result.agendaStats.agendaId ?? "-"} key=${result.agendaStats.agendaKey ?? "-"} usage=${result.agendaStats.usageCount ?? "-"} last7=${result.agendaStats.publicationsLast7Days} last30=${result.agendaStats.publicationsLast30Days}`,
  );
  console.log(
    `channel stats: ${result.channelStats.channel} daily=${result.channelStats.dailyCount}/${result.channelStats.dailyMax} cooldownDays=${result.channelStats.cooldownDays} sameAgendaRecent=${result.channelStats.sameAgendaRecentCount}`,
  );
  console.log(`checkedAt: ${result.checkedAt}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`content governance failed: ${message}`);
  process.exit(1);
});
