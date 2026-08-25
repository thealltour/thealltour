import { requireUuid } from "@/lib/marketing/context/validation";
import { CUSTOMER_INSIGHT_DEFAULT_LOOKBACK_DAYS } from "@/lib/marketing/memory/constants";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";

export type CustomerInsightMemoryCliArgs = {
  productId: string;
  apply: boolean;
  preview: boolean;
  dryRun: boolean;
  lookbackDays: number;
  minInquiryCount?: number;
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

export function parseCustomerInsightMemoryCliArgs(argv: string[]): CustomerInsightMemoryCliArgs {
  let productId: string | undefined;
  let apply = false;
  let dryRun = false;
  let preview = false;
  let lookbackDays = CUSTOMER_INSIGHT_DEFAULT_LOOKBACK_DAYS;
  let minInquiryCount: number | undefined;

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
    if (token === "--min-inquiry-count" || token.startsWith("--min-inquiry-count=")) {
      const read = readFlagValue(argv, index, "--min-inquiry-count");
      minInquiryCount = parsePositiveInt(read.value, "--min-inquiry-count");
      index += read.consumed;
      continue;
    }
    throw new MemoryValidationError(`Unknown argument: ${token}`);
  }

  if (!productId) {
    throw new MemoryValidationError("--product-id is required");
  }

  const allowWrite = apply && !dryRun && !preview;
  return {
    productId,
    apply: allowWrite,
    preview,
    dryRun: !allowWrite,
    lookbackDays,
    minInquiryCount,
  };
}
