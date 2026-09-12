/**
 * One-shot Gemini Search Grounding smoke — never prints API keys.
 *   npx tsx scripts/ra1c3-gemini-grounding-smoke.ts
 */
import { hostname } from "node:os";
import { loadLocalEnv } from "./loadLocalEnv";

loadLocalEnv();

async function main() {
  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    "";
  const credentialEnv = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()
    ? "GOOGLE_GENERATIVE_AI_API_KEY"
    : process.env.GEMINI_API_KEY?.trim()
      ? "GEMINI_API_KEY"
      : process.env.GOOGLE_API_KEY?.trim()
        ? "GOOGLE_API_KEY"
        : null;
  const model =
    process.env.MARKETING_RESEARCH_GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  const base = (
    process.env.GEMINI_API_BASE_URL?.trim() ||
    "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/$/, "");

  console.log(
    JSON.stringify(
      {
        host: hostname(),
        credentialEnv,
        credentialPresent: Boolean(apiKey),
        credentialLen: apiKey.length,
        model,
        base,
      },
      null,
      2,
    ),
  );

  if (!apiKey) process.exit(2);

  const url = `${base}/models/${encodeURIComponent(model)}:generateContent`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "부산 출발 크루즈 처음 탑승 준비에 대해 사람들이 실제로 찾는 질문과 참고할 공개 출처 URL을 알려주세요. 추측하지 말고 검색 근거가 있는 것만.",
          },
        ],
      },
    ],
    tools: [{ google_search: {} }],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const rawText = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(rawText) as Record<string, unknown>;
  } catch {
    json = null;
  }

  const candidates = Array.isArray(json?.candidates) ? (json!.candidates as unknown[]) : [];
  const candidate = (candidates[0] ?? null) as Record<string, unknown> | null;
  const gm = (candidate?.groundingMetadata ?? null) as Record<string, unknown> | null;
  const chunks = Array.isArray(gm?.groundingChunks) ? (gm!.groundingChunks as unknown[]) : [];
  const supports = Array.isArray(gm?.groundingSupports)
    ? (gm!.groundingSupports as unknown[])
    : [];
  const queries = Array.isArray(gm?.webSearchQueries) ? gm!.webSearchQueries : [];
  const parts = ((candidate?.content as { parts?: Array<{ text?: string }> } | undefined)?.parts ??
    []) as Array<{ text?: string }>;
  const answer = parts
    .map((p) => p.text || "")
    .join("\n")
    .slice(0, 500);
  const err = json?.error as { code?: number; status?: string; message?: string } | undefined;

  console.log(
    JSON.stringify(
      {
        httpStatus: res.status,
        ok: res.ok,
        finishReason: candidate?.finishReason ?? null,
        hasGroundingMetadata: Boolean(gm),
        webSearchQueries: queries,
        groundingChunkCount: chunks.length,
        groundingSupportCount: supports.length,
        chunkSample: chunks.slice(0, 5).map((c, i) => {
          const row = c as { web?: { uri?: string; title?: string }; retrievedContext?: { uri?: string; title?: string } };
          return {
            i,
            uri: row?.web?.uri || row?.retrievedContext?.uri || null,
            title: row?.web?.title || row?.retrievedContext?.title || null,
            keys: Object.keys((c as object) || {}),
            webKeys: row?.web ? Object.keys(row.web) : [],
          };
        }),
        supportSample: supports.slice(0, 2).map((s) => {
          const row = s as {
            segment?: { text?: string };
            groundingChunkIndices?: number[];
          };
          return {
            segmentText: row?.segment?.text?.slice?.(0, 120) ?? null,
            indices: row?.groundingChunkIndices ?? null,
            keys: Object.keys((s as object) || {}),
          };
        }),
        answerPreview: answer,
        error: err
          ? {
              code: err.code,
              status: err.status,
              message: String(err.message || "").slice(0, 200),
            }
          : null,
        topLevelKeys: json ? Object.keys(json) : [],
        candidateKeys: candidate ? Object.keys(candidate) : [],
        groundingKeys: gm ? Object.keys(gm) : [],
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
