import "server-only";

import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import {
  parseMarketingAssetTransportMode,
  type MarketingAssetTransport,
} from "@/lib/marketing/assets/transport/contracts";
import { createHttpMarketingAssetTransport } from "@/lib/marketing/assets/transport/httpTransport";
import { createLocalMarketingAssetTransport } from "@/lib/marketing/assets/transport/localTransport";

export function createMarketingAssetTransport(input: {
  catalog: MarketingMediaSourceCatalogRepository;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): MarketingAssetTransport {
  const env = input.env ?? process.env;
  const mode = parseMarketingAssetTransportMode(env);
  if (mode === "http") {
    return createHttpMarketingAssetTransport({ env, fetchImpl: input.fetchImpl });
  }
  return createLocalMarketingAssetTransport({ catalog: input.catalog, env });
}
