/**
 * MemoryIngestionSource contract.
 *
 * Do not load raw customer PII (phone, email, passport, address, password, token)
 * into MemoryDocument.content. Inquiry/review sources must emit aggregate insights only.
 *
 * ProductMemorySource is implemented in productMemorySource.ts.
 * ReviewMemorySource is implemented in reviewMemorySource.ts.
 * CustomerInsightMemorySource is implemented in customerInsightMemorySource.ts.
 * PerformanceMemorySource is implemented in performanceMemorySource.ts.
 * ContentMemorySource is implemented in contentMemorySource.ts.
 */

export type { MemoryDocument, MemoryIngestionSource } from "@/lib/marketing/memory/types";
