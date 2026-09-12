/**
 * RA-1C4 OpenRouter free-pool + web plugin smoke.
 * Never prints API keys / Authorization values.
 *
 *   npx tsx scripts/ra1c4-openrouter-web-smoke.ts
 */
import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { loadLocalEnv } from "./loadLocalEnv";

loadLocalEnv();

const OPENROUTER_BASE =
  process.env.OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1";
const MODEL = "openrouter/free";

function keyMeta(key: string) {
  return {
    present: Boolean(key),
    len: key.length,
    sha8: key ? createHash("sha256").update(key).digest("hex").slice(0, 8) : null,
  };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() || "";
  console.log(
    JSON.stringify(
      {
        host: hostname(),
        credential_env: "OPENROUTER_API_KEY",
        credential: keyMeta(apiKey),
        base: OPENROUTER_BASE,
        model_requested: MODEL,
        plugin: { id: "web", max_results: 5 },
      },
      null,
      2,
    ),
  );
  if (!apiKey) process.exit(2);

  const body = {
    model: MODEL,
    messages: [
      {
        role: "user",
        content:
          "부산 출발 크루즈 처음 탑승 준비에 대해 사람들이 실제로 찾는 질문과 참고할 공개 웹 출처를 알려주세요. 추측 금지. URL 인용 포함.",
      },
    ],
    plugins: [{ id: "web", max_results: 5 }],
  };

  const res = await fetch(`${OPENROUTER_BASE.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER?.trim() || "https://thealltour.local",
      "X-Title": process.env.OPENROUTER_APP_TITLE?.trim() || "thealltour-ra1-research",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });

  const rawText = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    json = null;
  }

  const error = json?.error as { message?: string; code?: unknown; metadata?: unknown } | undefined;
  const choices = Array.isArray(json?.choices) ? (json!.choices as unknown[]) : [];
  const message = (choices[0] as { message?: Record<string, unknown> } | undefined)?.message ?? null;
  const annotations = Array.isArray(message?.annotations) ? (message!.annotations as unknown[]) : [];
  const usage = (json?.usage as Record<string, unknown> | undefined) ?? null;

  const citationUrls: string[] = [];
  const citationShapeSample: unknown[] = [];
  for (const [i, ann] of annotations.entries()) {
    if (!ann || typeof ann !== "object") continue;
    const row = ann as Record<string, unknown>;
    citationShapeSample.push({
      i,
      keys: Object.keys(row),
      type: row.type ?? null,
      nestedKeys:
        row.url_citation && typeof row.url_citation === "object"
          ? Object.keys(row.url_citation as object)
          : [],
      url:
        typeof (row.url_citation as { url?: string } | undefined)?.url === "string"
          ? (row.url_citation as { url: string }).url
          : typeof row.url === "string"
            ? row.url
            : null,
      title:
        typeof (row.url_citation as { title?: string } | undefined)?.title === "string"
          ? (row.url_citation as { title: string }).title
          : typeof row.title === "string"
            ? row.title
            : null,
      hasContent: Boolean(
        (row.url_citation as { content?: string } | undefined)?.content || row.content,
      ),
    });
    const url =
      typeof (row.url_citation as { url?: string } | undefined)?.url === "string"
        ? (row.url_citation as { url: string }).url
        : typeof row.url === "string"
          ? row.url
          : null;
    if (url) citationUrls.push(url);
  }

  console.log(
    JSON.stringify(
      {
        httpStatus: res.status,
        ok: res.ok,
        error: error
          ? {
              message: String(error.message || "").slice(0, 300),
              code: error.code ?? null,
              metadataKeys:
                error.metadata && typeof error.metadata === "object"
                  ? Object.keys(error.metadata as object)
                  : [],
            }
          : null,
        model_in_response: json?.model ?? null,
        id: json?.id ?? null,
        provider: json?.provider ?? null,
        annotation_count: annotations.length,
        citation_urls: citationUrls.slice(0, 8),
        citation_shape_sample: citationShapeSample.slice(0, 5),
        content_preview: String(message?.content || "").slice(0, 400),
        usage,
        top_level_keys: json ? Object.keys(json) : [],
        message_keys: message ? Object.keys(message) : [],
        raw_error_snippet: !res.ok ? rawText.slice(0, 500) : null,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      fatal: true,
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
    }),
  );
  process.exit(1);
});
