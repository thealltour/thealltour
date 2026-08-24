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
