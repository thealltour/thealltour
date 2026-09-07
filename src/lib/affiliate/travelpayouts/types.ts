export type TravelpayoutsPartnerLinkResult = {
  affiliateUrl: string;
  subId: string;
  hostname: string;
};

export type CreateTravelpayoutsPartnerLinkInput = {
  targetUrl: string;
  subId: string;
  allowedHosts?: string[];
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injected config for tests. */
  config?: {
    apiToken: string;
    partnerId: string;
    projectId: string;
  };
};
