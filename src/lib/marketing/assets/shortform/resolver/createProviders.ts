import type { MarketingMediaSourceCatalogRepository } from "@/lib/marketing/assets/sourceCatalog/repository";
import type { ResolverFetchImpl } from "@/lib/marketing/assets/shortform/resolver/http";
import { createInternalCatalogSourceProvider } from "@/lib/marketing/assets/shortform/resolver/providers/internalCatalog";
import { createPexelsSourceProvider } from "@/lib/marketing/assets/shortform/resolver/providers/pexels";
import { createPixabaySourceProvider } from "@/lib/marketing/assets/shortform/resolver/providers/pixabay";
import type { ShortformSourceProvider } from "@/lib/marketing/assets/shortform/resolver/provider";
import {
  createFileSourceSearchCache,
  createMemorySourceSearchCache,
  type SourceSearchCache,
} from "@/lib/marketing/assets/shortform/resolver/searchCache";

export type ShortformResolverProviders = {
  internal: ShortformSourceProvider;
  pexels: ShortformSourceProvider;
  pixabay: ShortformSourceProvider;
};

/**
 * Wire production providers. Missing API keys → provider status disabled (not fatal).
 * Pixabay always requires a compliant cache (file or injected).
 */
export function createShortformResolverProviders(input: {
  catalog: MarketingMediaSourceCatalogRepository;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetchImpl?: ResolverFetchImpl;
  searchCache?: SourceSearchCache | null;
  useFileCache?: boolean;
}): ShortformResolverProviders {
  const env = input.env ?? process.env;
  const cache =
    input.searchCache === null
      ? null
      : (input.searchCache ??
        (input.useFileCache === false
          ? createMemorySourceSearchCache()
          : createFileSourceSearchCache()));

  return {
    internal: createInternalCatalogSourceProvider({ catalog: input.catalog }),
    pexels: createPexelsSourceProvider({
      apiKey: env.PEXELS_API_KEY,
      fetchImpl: input.fetchImpl,
    }),
    pixabay: createPixabaySourceProvider({
      apiKey: env.PIXABAY_API_KEY,
      cache,
      fetchImpl: input.fetchImpl,
    }),
  };
}
