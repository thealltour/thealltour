import { requireUuid } from "@/lib/marketing/context/validation";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";

export type ProductMemoryCliArgs = {
  productId: string;
  apply: boolean;
  preview: boolean;
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

export function parseProductMemoryCliArgs(argv: string[]): ProductMemoryCliArgs {
  let productId: string | undefined;
  let apply = false;
  let dryRun = false;
  let preview = false;

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
    throw new MemoryValidationError(`Unknown argument: ${token}`);
  }

  if (!productId) {
    throw new MemoryValidationError("--product-id is required");
  }

  return {
    productId,
    apply: apply && !dryRun,
    preview,
  };
}
