import { requireUuid } from "@/lib/marketing/context/validation";
import { CONTENT_MEMORY_DEFAULT_LOOKBACK_DAYS } from "@/lib/marketing/memory/constants";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";

export type ContentMemoryCliArgs = {
  contentId?: string;
  productId?: string;
  apply: boolean;
  preview: boolean;
  dryRun: boolean;
  lookbackDays?: number;
  channel?: string;
  sourceType?: string;
};

function readFlagValue(argv: string[], index: number, flag: string): { value: string; consumed: number } {
  const current = argv[index];
  const prefix = `${flag}=`;
  if (current.startsWith(prefix)) {
    const value = current.slice(prefix.length).trim();
    if (!value) throw new MemoryValidationError(`${flag} requires a value`);
    return { value, consumed: 1 };
  }
  const next = argv[index + 1];
  if (!next || next.startsWith("--")) {
    throw new MemoryValidationError(`${flag} requires a value`);
  }
  return { value: next.trim(), consumed: 2 };
}

function parsePositiveInt(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new MemoryValidationError(`${flag} must be a non-negative integer`);
  }
  return parsed;
}

export function parseContentMemoryCliArgs(argv: string[]): ContentMemoryCliArgs {
  let contentId: string | undefined;
  let productId: string | undefined;
  let apply = false;
  let dryRun = false;
  let preview = false;
  let lookbackDays: number | undefined;
  let channel: string | undefined;
  let sourceType: string | undefined;

  for (let index = 0; index < argv.length; ) {
    const token = argv[index];
    if (token === "--apply") {
      apply = true;
      index += 1;
      continue;
    }
    if (token === "--dry-run") {
      dryRun = true;
      index += 1;
      continue;
    }
    if (token === "--preview") {
      preview = true;
      index += 1;
      continue;
    }
    if (token === "--content-id" || token.startsWith("--content-id=") || token === "--contentId" || token.startsWith("--contentId=")) {
      const flag = token.startsWith("--contentId") ? "--contentId" : "--content-id";
      const read = readFlagValue(argv, index, token.includes("=") ? token.slice(0, token.indexOf("=")) : flag);
      contentId = requireUuid(read.value, "contentId");
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
    if (token === "--lookback-days" || token.startsWith("--lookback-days=")) {
      const read = readFlagValue(argv, index, "--lookback-days");
      lookbackDays = parsePositiveInt(read.value, "--lookback-days");
      if (lookbackDays < 1) throw new MemoryValidationError("--lookback-days must be >= 1");
      index += read.consumed;
      continue;
    }
    if (token === "--channel" || token.startsWith("--channel=")) {
      const read = readFlagValue(argv, index, "--channel");
      channel = read.value;
      index += read.consumed;
      continue;
    }
    if (token === "--source-type" || token.startsWith("--source-type=")) {
      const read = readFlagValue(argv, index, "--source-type");
      sourceType = read.value;
      index += read.consumed;
      continue;
    }
    throw new MemoryValidationError(`Unknown argument: ${token}`);
  }

  if (!contentId && !productId) {
    throw new MemoryValidationError("--content-id or --product-id is required");
  }

  const allowWrite = apply && !dryRun && !preview;
  return {
    contentId,
    productId,
    apply: allowWrite,
    preview,
    dryRun: !allowWrite,
    lookbackDays: lookbackDays ?? (productId && !contentId ? CONTENT_MEMORY_DEFAULT_LOOKBACK_DAYS : undefined),
    channel,
    sourceType,
  };
}
