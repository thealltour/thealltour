import "server-only";

const THREADS_GRAPH_BASE = "https://graph.threads.net/v1.0";

export type PublishToThreadsInput = {
  text: string;
  imageUrl?: string;
};

export type PublishToThreadsResult = {
  id: string;
  permalink: string | null;
  creationId: string;
};

export class ThreadsClientError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus = 500) {
    super(message);
    this.name = "ThreadsClientError";
    this.httpStatus = httpStatus;
  }
}

function requireThreadsConfig(): { accessToken: string; userId: string } {
  const accessToken = process.env.THREADS_ACCESS_TOKEN?.trim();
  const userId = process.env.THREADS_USER_ID?.trim();
  if (!accessToken || !userId) {
    throw new ThreadsClientError(
      "THREADS_ACCESS_TOKEN 또는 THREADS_USER_ID가 설정되어 있지 않습니다.",
      500,
    );
  }
  return { accessToken, userId };
}

async function readThreadsJson(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { error: { message: raw.slice(0, 300) } };
  }
}

function threadsErrorMessage(payload: Record<string, unknown>, fallback: string): string {
  const error = payload.error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  if (typeof payload.message === "string" && payload.message.trim()) return payload.message.trim();
  return fallback;
}

async function threadsPost(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${THREADS_GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, { method: "POST" });
  const payload = await readThreadsJson(response);
  if (!response.ok) {
    throw new ThreadsClientError(
      threadsErrorMessage(payload, `Threads API 요청에 실패했습니다. (${response.status})`),
      response.status >= 400 && response.status < 600 ? response.status : 502,
    );
  }
  return payload;
}

async function threadsGet(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const url = new URL(`${THREADS_GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const response = await fetch(url, { method: "GET" });
  const payload = await readThreadsJson(response);
  if (!response.ok) {
    throw new ThreadsClientError(
      threadsErrorMessage(payload, `Threads API 조회에 실패했습니다. (${response.status})`),
      response.status >= 400 && response.status < 600 ? response.status : 502,
    );
  }
  return payload;
}

export async function publishToThreads(input: PublishToThreadsInput): Promise<PublishToThreadsResult> {
  const text = input.text.trim();
  if (!text) {
    throw new ThreadsClientError("게시할 본문이 비어 있습니다.", 400);
  }

  const { accessToken, userId } = requireThreadsConfig();
  const imageUrl = input.imageUrl?.trim();
  const mediaType = imageUrl ? "IMAGE" : "TEXT";

  const containerParams: Record<string, string> = {
    media_type: mediaType,
    text,
    access_token: accessToken,
  };
  if (imageUrl) containerParams.image_url = imageUrl;

  const container = await threadsPost(`/${encodeURIComponent(userId)}/threads`, containerParams);
  const creationId = typeof container.id === "string" ? container.id.trim() : "";
  if (!creationId) {
    throw new ThreadsClientError("Threads 컨테이너 id를 받지 못했습니다.", 502);
  }

  const published = await threadsPost(`/${encodeURIComponent(userId)}/threads_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
  const mediaId = typeof published.id === "string" ? published.id.trim() : "";
  if (!mediaId) {
    throw new ThreadsClientError("Threads 게시 id를 받지 못했습니다.", 502);
  }

  let permalink: string | null = null;
  try {
    const media = await threadsGet(`/${encodeURIComponent(mediaId)}`, {
      fields: "id,permalink",
      access_token: accessToken,
    });
    permalink = typeof media.permalink === "string" && media.permalink.trim() ? media.permalink.trim() : null;
  } catch {
    permalink = null;
  }

  return { id: mediaId, permalink, creationId };
}
