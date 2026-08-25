/**
 * Marketing bot workflow read-only smoke test.
 *
 * DB INSERT/UPDATE 없음. 게시/삭제 없음. Hermes Gateway 변경 없음.
 *
 * 실행:
 *   npx tsx scripts/test-marketing-bot-workflow.ts --product-id <uuid> --channel threads --goal "스페인 포르투갈 패키지 홍보 콘텐츠"
 *   npx tsx scripts/test-marketing-bot-workflow.ts --product-id <uuid> --channel threads --body "초안 본문" --title "제목"
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
  const { parseMarketingBotCliArgs } = await import("../src/lib/marketing/bot/cli");
  const { prepareMarketingTask } = await import("../src/lib/marketing/bot/prepareMarketingTask");
  const { reviewGeneratedContent } = await import("../src/lib/marketing/bot/evaluateGovernanceTool");
  const args = parseMarketingBotCliArgs(process.argv.slice(2));

  const prepared = await prepareMarketingTask({
    productId: args.productId,
    channel: args.channel,
    campaignId: args.campaignId,
    agendaId: args.agendaId,
    goal: args.goal,
  });

  console.log("context prepared: yes");
  console.log(`productFound: ${prepared.brief.productFound}`);
  console.log(`productTitle: ${prepared.brief.product?.title ?? "(none)"}`);
  console.log(`memory match count: ${prepared.memoryMatchCount}`);
  console.log(`channelPolicy.autoPublishEnabled: ${prepared.channelPolicy.autoPublishEnabled}`);
  console.log(`brief facts: ${prepared.brief.recommendedFacts.length}`);
  console.log(`nextAction: ${prepared.nextAction}`);
  console.log(`publishActionIncluded: ${prepared.publishActionIncluded}`);
  if (prepared.publishActionIncluded) {
    throw new Error("publish action must not be included");
  }

  const sampleBody =
    args.body?.trim() ||
    `${prepared.brief.product?.title ?? "패키지"} 일정은 상품 정보에 따릅니다. 부모님과 함께 걷기 부담을 줄인 구성을 안내합니다.`;
  const sampleTitle = args.title?.trim() || prepared.brief.product?.title || "패키지 안내";

  const reviewed = await reviewGeneratedContent({
    title: sampleTitle,
    body: sampleBody,
    channel: args.channel,
    productId: args.productId,
    campaignId: args.campaignId,
    agendaId: args.agendaId,
    agendaKey: args.agendaKey,
  });

  console.log(`governanceDecision: ${reviewed.governance?.governanceDecision}`);
  console.log(`workflowState: ${reviewed.governance?.workflowState}`);
  console.log(`botStatus: ${reviewed.status}`);
  console.log(`humanApprovalRequired: ${reviewed.governance?.humanApprovalRequired}`);
  console.log(`reasonCodes: ${reviewed.governance?.reasonCodes.join(", ") || "(none)"}`);
  console.log(`nextAction: ${reviewed.nextAction}`);
  console.log(`publishActionIncluded: ${reviewed.publishActionIncluded}`);
  if (reviewed.publishActionIncluded) {
    throw new Error("publish action must not be included");
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`marketing bot workflow failed: ${message}`);
  process.exit(1);
});
