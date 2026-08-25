/**
 * MemoryIngestionSource contract.
 *
 * Do not load raw customer PII (phone, email, passport, address, password, token)
 * into MemoryDocument.content. Inquiry/review sources must emit aggregate insights only.
 *
 * ProductMemorySource is implemented in productMemorySource.ts.
 * ReviewMemorySource is implemented in reviewMemorySource.ts.
 * Inquiry/Performance/Content sources are not implemented in this STEP.
 */

export type { MemoryDocument, MemoryIngestionSource } from "@/lib/marketing/memory/types";
