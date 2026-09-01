import type { AuthorityLevel, ResearchSourceType } from "@/lib/marketing/research/types/enums";

export type ResearchSource = {
  id: string;
  sourceType: ResearchSourceType;
  name: string;
  canonicalUrl?: string | null;
  provider?: string | null;
  authorityLevel?: AuthorityLevel | null;
  defaultCredibility?: number | null;
  locale?: string | null;
  country?: string | null;
  language?: string | null;
  isOfficial: boolean;
  isEnabled: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateResearchSourceInput = Omit<ResearchSource, "createdAt" | "updatedAt"> & {
  createdAt?: string;
  updatedAt?: string;
};
