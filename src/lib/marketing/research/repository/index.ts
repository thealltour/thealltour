export * from "@/lib/marketing/research/repository/contracts";
export {
  createInMemoryResearchRepository,
  InMemoryResearchRepository,
} from "@/lib/marketing/research/repository/inMemoryResearchRepository";
export {
  createResearchRepository,
  isResearchRepositoryConfigured,
} from "@/lib/marketing/research/repository/createResearchRepository";
export type { ResearchDbClient } from "@/lib/marketing/research/repository/dbClient";
