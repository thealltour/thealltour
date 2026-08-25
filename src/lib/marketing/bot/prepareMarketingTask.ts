import "server-only";

import { BOT_MAX_FACTS, CONTENT_GENERATION_INSTRUCTIONS } from "@/lib/marketing/bot/constants";
import { botChannelPolicy } from "@/lib/marketing/bot/compactContext";
import { getMarketingContextTool, requireProductId } from "@/lib/marketing/bot/getMarketingContextTool";
import { searchMarketingMemoryTool } from "@/lib/marketing/bot/searchMarketingMemoryTool";
import { MarketingBotValidationError } from "@/lib/marketing/bot/errors";
import { defaultSourcesForPurpose } from "@/lib/marketing/retrieval/planner";
import type {
  BuildContentBriefInput,
  ContentBrief,
  MarketingBotDeps,
  PrepareMarketingTaskInput,
  PrepareMarketingTaskResult,
} from "@/lib/marketing/bot/types";

function resolveBriefPurpose(purpose?: string | null, goal?: string | null): string {
  for (const candidate of [purpose, goal]) {
    const value = candidate?.trim();
    if (value && defaultSourcesForPurpose(value).length > 0) return value;
  }
  return "create_content";
}

function recommendedFacts(brief: Omit<ContentBrief, "recommendedFacts">): string[] {
  const facts: string[] = [];
  if (brief.product?.title) facts.push(`상품: ${brief.product.title}`);
  if (brief.product?.oneLiner) facts.push(brief.product.oneLiner);
  if (brief.product?.duration) facts.push(`기간: ${brief.product.duration}`);
  if (brief.product?.price != null) facts.push(`가격: ${brief.product.price}`);
  if (brief.product?.inclusions) facts.push(`포함: ${brief.product.inclusions}`);
  for (const question of brief.customerInsight?.topQuestions ?? []) facts.push(`문의: ${question}`);
  for (const concern of brief.customerInsight?.topConcerns ?? []) facts.push(`우려: ${concern}`);
  for (const point of brief.reviewInsight?.positivePoints ?? []) facts.push(`후기 긍정: ${point}`);
  for (const point of brief.reviewInsight?.negativePoints ?? []) facts.push(`후기 주의: ${point}`);
  for (const item of brief.recentContent.slice(0, 3)) {
    if (item.title) facts.push(`최근 콘텐츠: ${item.title}`);
  }
  return facts.slice(0, BOT_MAX_FACTS);
}

export async function buildContentBriefTool(
  input: BuildContentBriefInput,
  deps: MarketingBotDeps = {},
): Promise<ContentBrief> {
  const productId = requireProductId(input.productId);
  if (!input.channel?.trim()) throw new MarketingBotValidationError("channel is required");
  const purpose = resolveBriefPurpose(input.purpose, input.goal);
  const context = await getMarketingContextTool(
    {
      purpose,
      productId,
      campaignId: input.campaignId,
      channel: input.channel,
    },
    deps,
  );
  const query = input.goal?.trim() || context.context.product?.title || purpose;
  const memory = await searchMarketingMemoryTool({ query, limit: 8 }, deps);
  const base = {
    product: context.context.product,
    customerInsight: context.context.customerInsights,
    reviewInsight: context.context.reviewInsights,
    performanceInsight: context.context.performance,
    recentContent: context.context.recentContent,
    semanticMatches: memory.matches,
    channelConstraints: botChannelPolicy(input.channel.trim()),
    productFound: context.productFound,
  };
  return { ...base, recommendedFacts: recommendedFacts(base) };
}

export async function prepareMarketingTask(
  input: PrepareMarketingTaskInput,
  deps: MarketingBotDeps = {},
): Promise<PrepareMarketingTaskResult> {
  const brief = await buildContentBriefTool(
    {
      productId: input.productId,
      channel: input.channel,
      campaignId: input.campaignId,
      agendaId: input.agendaId,
      goal: input.goal,
      purpose: "create_content",
    },
    deps,
  );
  return {
    status: "draft_ready",
    brief,
    memoryMatchCount: brief.semanticMatches.length,
    channelPolicy: brief.channelConstraints,
    generationInstructions: [...CONTENT_GENERATION_INSTRUCTIONS],
    nextAction: "generate_content_then_review",
    publishActionIncluded: false,
  };
}
