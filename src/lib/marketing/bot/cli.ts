import { GovernanceValidationError } from "@/lib/marketing/governance/errors";

export type MarketingBotCliArgs = {
  productId: string;
  channel: string;
  goal?: string;
  title?: string;
  body?: string;
  campaignId?: string;
  agendaId?: string;
  agendaKey?: string;
};

function readFlagValue(argv: string[], index: number, flag: string): { value: string; consumed: number } {
  const current = argv[index];
  const prefix = `${flag}=`;
  if (current.startsWith(prefix)) {
    const value = current.slice(prefix.length);
    if (!value.trim()) throw new GovernanceValidationError(`${flag} requires a value`);
    return { value, consumed: 1 };
  }
  const next = argv[index + 1];
  if (next == null || next.startsWith("--")) {
    throw new GovernanceValidationError(`${flag} requires a value`);
  }
  return { value: next, consumed: 2 };
}

export function parseMarketingBotCliArgs(argv: string[]): MarketingBotCliArgs {
  let productId: string | undefined;
  let channel: string | undefined;
  let goal: string | undefined;
  let title: string | undefined;
  let body: string | undefined;
  let campaignId: string | undefined;
  let agendaId: string | undefined;
  let agendaKey: string | undefined;

  for (let index = 0; index < argv.length; ) {
    const token = argv[index];
    if (token === "--product-id" || token.startsWith("--product-id=")) {
      const read = readFlagValue(argv, index, "--product-id");
      productId = read.value;
      index += read.consumed;
      continue;
    }
    if (token === "--channel" || token.startsWith("--channel=")) {
      const read = readFlagValue(argv, index, "--channel");
      channel = read.value;
      index += read.consumed;
      continue;
    }
    if (token === "--goal" || token.startsWith("--goal=")) {
      const read = readFlagValue(argv, index, "--goal");
      goal = read.value;
      index += read.consumed;
      continue;
    }
    if (token === "--title" || token.startsWith("--title=")) {
      const read = readFlagValue(argv, index, "--title");
      title = read.value;
      index += read.consumed;
      continue;
    }
    if (token === "--body" || token.startsWith("--body=")) {
      const read = readFlagValue(argv, index, "--body");
      body = read.value;
      index += read.consumed;
      continue;
    }
    if (token === "--campaign-id" || token.startsWith("--campaign-id=")) {
      const read = readFlagValue(argv, index, "--campaign-id");
      campaignId = read.value;
      index += read.consumed;
      continue;
    }
    if (token === "--agenda-id" || token.startsWith("--agenda-id=")) {
      const read = readFlagValue(argv, index, "--agenda-id");
      agendaId = read.value;
      index += read.consumed;
      continue;
    }
    if (token === "--agenda-key" || token.startsWith("--agenda-key=")) {
      const read = readFlagValue(argv, index, "--agenda-key");
      agendaKey = read.value;
      index += read.consumed;
      continue;
    }
    throw new GovernanceValidationError(`Unknown argument: ${token}`);
  }

  if (!productId?.trim()) throw new GovernanceValidationError("--product-id is required");
  if (!channel?.trim()) throw new GovernanceValidationError("--channel is required");
  return { productId, channel, goal, title, body, campaignId, agendaId, agendaKey };
}
