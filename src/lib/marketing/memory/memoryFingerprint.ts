import { createHash } from "node:crypto";

export function memoryFingerprint(input: {
  memoryType: string;
  sourceType: string | null;
  sourceId: string | null;
  title: string | null;
  content: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        memoryType: input.memoryType,
        sourceType: input.sourceType ?? "",
        sourceId: input.sourceId ?? "",
        title: input.title ?? "",
        content: input.content,
      }),
    )
    .digest("hex");
}
