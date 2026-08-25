import { requireUuid } from "@/lib/marketing/context/validation";
import { GovernanceValidationError } from "@/lib/marketing/governance/errors";

export type ContentGovernanceCliArgs = {
  title?: string;
  body: string;
  channel: string;
  productId?: string;
  agendaId?: string;
  agendaKey?: string;
  sourceContentId?: string;
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

export function parseContentGovernanceCliArgs(argv: string[]): ContentGovernanceCliArgs {
  let title: string | undefined;
  let body: string | undefined;
  let channel: string | undefined;
  let productId: string | undefined;
  let agendaId: string | undefined;
  let agendaKey: string | undefined;
  let sourceContentId: string | undefined;

  for (let index = 0; index < argv.length; ) {
    const token = argv[index];
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
    if (token === "--channel" || token.startsWith("--channel=")) {
      const read = readFlagValue(argv, index, "--channel");
      channel = read.value;
      index += read.consumed;
      continue;
    }
    if (token === "--product-id" || token.startsWith("--product-id=") || token === "--productId" || token.startsWith("--productId=")) {
      const flag = token.startsWith("--productId") ? "--productId" : "--product-id";
      const read = readFlagValue(argv, index, token.includes("=") ? token.slice(0, token.indexOf("=")) : flag);
      productId = requireUuid(read.value, "productId");
      index += read.consumed;
      continue;
    }
    if (token === "--agenda-id" || token.startsWith("--agenda-id=")) {
      const read = readFlagValue(argv, index, "--agenda-id");
      agendaId = requireUuid(read.value, "agendaId");
      index += read.consumed;
      continue;
    }
    if (token === "--agenda-key" || token.startsWith("--agenda-key=")) {
      const read = readFlagValue(argv, index, "--agenda-key");
      agendaKey = read.value;
      index += read.consumed;
      continue;
    }
    if (token === "--source-content-id" || token.startsWith("--source-content-id=")) {
      const read = readFlagValue(argv, index, "--source-content-id");
      sourceContentId = requireUuid(read.value, "sourceContentId");
      index += read.consumed;
      continue;
    }
    throw new GovernanceValidationError(`Unknown argument: ${token}`);
  }

  if (!body?.trim()) throw new GovernanceValidationError("--body is required");
  if (!channel?.trim()) throw new GovernanceValidationError("--channel is required");

  return { title, body, channel, productId, agendaId, agendaKey, sourceContentId };
}
