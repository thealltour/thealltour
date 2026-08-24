/** Mini PC /embed/batch limit is 100. Keep this at or below that cap. */
export const MEMORY_EMBED_BATCH_SIZE = 50;
export const MEMORY_INGEST_BATCH_SIZE = 50;
export const MEMORY_INGEST_MAX_DOCUMENTS = 1000;
export const MEMORY_PROVIDER_ABORT_AFTER = 2;

export const AI_MEMORY_TABLE = "ai_memory";
export const AI_MEMORY_LOOKUP_COLUMNS = "id, memory_type, title, content, source_type, source_id";
