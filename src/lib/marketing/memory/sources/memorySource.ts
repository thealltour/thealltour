/**
 * MemoryIngestionSource contract for STEP 1-8B adapters.
 *
 * Do not load raw customer PII (phone, email, passport, address, password, token)
 * into MemoryDocument.content. Inquiry/review sources must emit aggregate insights only.
 *
 * ProductMemorySource, InquiryMemorySource, ReviewMemorySource, PerformanceMemorySource,
 * and ContentMemorySource are not implemented in STEP 1-8A.
 */

export type { MemoryDocument, MemoryIngestionSource } from "@/lib/marketing/memory/types";
