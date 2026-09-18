/**
 * Extract first JSON object from LLM stdout (fenced or raw).
 */

export function extractJsonObject(text: string): unknown {
  const trimmed = (text ?? "").trim();
  if (!trimmed) throw new Error("empty_llm_response");

  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = fence ? fence[1]!.trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("llm_response_missing_json_object");
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    throw new Error("llm_response_invalid_json");
  }
}
