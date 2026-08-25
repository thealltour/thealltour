/** Mini PC /embed/batch limit is 100. Keep this at or below that cap. */
export const MEMORY_EMBED_BATCH_SIZE = 50;
export const MEMORY_INGEST_BATCH_SIZE = 50;
export const MEMORY_INGEST_MAX_DOCUMENTS = 1000;
export const MEMORY_PROVIDER_ABORT_AFTER = 2;

export const AI_MEMORY_TABLE = "ai_memory";
export const AI_MEMORY_LOOKUP_COLUMNS = "id, memory_type, title, content, source_type, source_id";

export const PRODUCT_MEMORY_TYPE = "product_knowledge";
export const PRODUCT_MEMORY_SOURCE_TYPE = "product";
export const PRODUCT_MEMORY_SOURCE_NAME = "product";
/** AI context source confidence — first-party product catalog, not a truth probability. */
export const PRODUCT_MEMORY_CONFIDENCE = 0.95;
export const PRODUCT_MEMORY_IMPORTANCE_ACTIVE = 0.9;
export const PRODUCT_MEMORY_IMPORTANCE_INACTIVE = 0.45;
export const PRODUCT_MEMORY_DEFAULT_LIMIT = 20;
export const PRODUCT_MEMORY_MAX_LIMIT = 100;

export const REVIEW_MEMORY_TYPE = "review_insight";
export const REVIEW_MEMORY_SOURCE_TYPE = "product_review";
export const REVIEW_MEMORY_SOURCE_NAME = "review";
export const REVIEW_MEMORY_DEFAULT_LIMIT = 20;
export const REVIEW_MEMORY_MAX_LIMIT = 100;
export const REVIEW_MEMORY_MAX_SNIPPETS = 8;
export const REVIEW_MEMORY_MAX_SNIPPET_CHARS = 120;
export const REVIEW_MEMORY_MAX_TIPS = 5;
export const REVIEW_MEMORY_MAX_SUMMARY_CHARS = 800;
export const REVIEW_MEMORY_IMPORTANCE = 0.8;
export const REVIEW_MEMORY_IMPORTANCE_ENOUGH = 0.85;
export const REVIEW_MEMORY_IMPORTANCE_RICH = 0.9;
export const REVIEW_MEMORY_CONFIDENCE_LOW = 0.75;
export const REVIEW_MEMORY_CONFIDENCE_MID = 0.85;
export const REVIEW_MEMORY_CONFIDENCE_HIGH = 0.9;
export const REVIEW_MEMORY_MAX_BOOKINGS = 800;
export const REVIEW_MEMORY_MAX_RAW_REVIEWS = 400;
export const REVIEW_MEMORY_MAX_REVIEWS_PER_PRODUCT = 50;
