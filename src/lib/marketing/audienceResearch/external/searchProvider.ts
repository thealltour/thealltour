export type ResearchSearchHit = {
  title: string;
  url: string;
  snippet: string;
  provider: string;
  rank: number;
  publishedAt: string | null;
};

export type ResearchSearchOptions = {
  maxResults?: number;
  timeoutMs?: number;
  language?: string;
  signal?: AbortSignal;
};

export type ResearchSearchProvider = {
  readonly id: string;
  readonly enabled: boolean;
  search(query: string, options?: ResearchSearchOptions): Promise<ResearchSearchHit[]>;
};

export type ResearchSearchProviderStatus = {
  providerId: string;
  enabled: boolean;
  credentialPresent: boolean;
  reason: string | null;
};
