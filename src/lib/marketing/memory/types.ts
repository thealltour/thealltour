/**
 * Memory ingestion contract.
 *
 * Do not put phone, email, passport, address, password, or token values in
 * MemoryDocument.content. Future source adapters (inquiries, etc.) must store
 * aggregate insights only — never raw customer PII.
 *
 * `metadata` is runtime-only. public.ai_memory has no metadata column.
 */

export const KNOWN_MEMORY_TYPES = [
  "product_knowledge",
  "customer_insight",
  "review_insight",
  "performance_insight",
  "content_knowledge",
  "governance",
  "trend",
  "brand_knowledge",
] as const;

export type KnownMemoryType = (typeof KNOWN_MEMORY_TYPES)[number];
export type MemoryType = KnownMemoryType | (string & {});

export type MemoryDocument = {
  memoryType: MemoryType;
  title?: string | null;
  content: string;
  sourceType?: string | null;
  sourceId?: string | null;
  importance?: number | null;
  confidence?: number | null;
  expiresAt?: string | null;
  /** Runtime-only. Not persisted — ai_memory has no metadata column. */
  metadata?: Record<string, unknown>;
};

export type NormalizedMemoryDocument = {
  memoryType: string;
  title: string | null;
  content: string;
  sourceType: string | null;
  sourceId: string | null;
  importance: number | null;
  confidence: number | null;
  expiresAt: string | null;
  fingerprint: string;
  embeddingText: string;
};

export type MemoryWriteStatus = "inserted" | "updated" | "skipped" | "failed";

export type MemoryWriteResult = {
  status: MemoryWriteStatus;
  memoryId?: string;
  sourceType?: string | null;
  sourceId?: string | null;
  reason?: string;
};

export type MemoryIngestionResult = {
  total: number;
  /** Actual ai_memory INSERT count. Always 0 when dryRun. */
  inserted: number;
  /** Actual ai_memory UPDATE count. Always 0 when dryRun. */
  updated: number;
  skipped: number;
  failed: number;
  plannedInsert: number;
  plannedUpdate: number;
  plannedSkip: number;
  dryRun: boolean;
  elapsedMs: number;
  results: MemoryWriteResult[];
};

export type ExistingMemoryRow = {
  id: string;
  memoryType: string;
  title: string | null;
  content: string;
  sourceType: string | null;
  sourceId: string | null;
};

export type MemoryInsertRow = {
  memory_type: string;
  title: string | null;
  content: string;
  source_type: string | null;
  source_id: string | null;
  importance: number | null;
  confidence: number | null;
  embedding_model: string;
  embedding: number[];
  expires_at: string | null;
};

export type MemoryUpdateRow = {
  title: string | null;
  content: string;
  importance: number | null;
  confidence: number | null;
  embedding_model: string;
  embedding: number[];
  expires_at: string | null;
  updated_at: string;
};

export interface MemoryStore {
  findBySource(input: {
    memoryType: string;
    sourceType: string;
    sourceId: string;
  }): Promise<ExistingMemoryRow | null>;
  findSourcelessDuplicate(input: {
    memoryType: string;
    content: string;
  }): Promise<ExistingMemoryRow | null>;
  insert(row: MemoryInsertRow): Promise<{ id: string }>;
  update(id: string, row: MemoryUpdateRow): Promise<void>;
}

export type DedupeDecision =
  | { action: "insert" }
  | { action: "update"; existingId: string }
  | { action: "skip"; reason: "unchanged" | "duplicate"; existingId: string };

/**
 * Future source adapters implement this contract.
 * ProductMemorySource is in sources/productMemorySource.ts.
 * ReviewMemorySource is in sources/reviewMemorySource.ts.
 * CustomerInsightMemorySource is in sources/customerInsightMemorySource.ts.
 */
export interface MemoryIngestionSource<P = unknown> {
  readonly name: string;
  load(params: P): Promise<MemoryDocument[]>;
}

export type IngestMemoryDocumentsOptions = {
  documents: MemoryDocument[];
  dryRun?: boolean;
  embedInDryRun?: boolean;
  batchSize?: number;
  sourceName?: string;
  now?: Date;
  provider?: import("@/lib/marketing/semantic/types").EmbeddingProvider | null;
  store?: MemoryStore | null;
  logger?: MemoryIngestionLogger;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
};

export type MemoryIngestionLogger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
};
