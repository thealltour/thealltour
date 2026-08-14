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

export type ThreadReply = {
  id: string;
  text: string;
  username: string;
  timestamp: string | null;
};

export type PostThreadReplyResult = {
  id: string;
  creationId: string;
};

const MAX_REPLY_PAGES = 3;

export class ThreadsClientError extends Error {
  readonly httpStatus: number;

  constructor(message: string, httpStatus = 500) {
    super(message);
    this.name = "ThreadsClientError";
    this.httpStatus = httpStatus;
  }
}

export type RefreshThreadsTokenResult = {
  accessToken: string;
  tokenType: string | null;
  expiresIn: number;
  expiresAt: string;
};

const THREADS_REFRESH_TOKEN_URL = "https://graph.threads.net/refresh_access_token";
const TOKEN_CACHE_MS = 5 * 60 * 1000;
const DEFAULT_TOKEN_TTL_SEC = 60 * 24 * 60 * 60;

let accessTokenCache: { value: string; loadedAt: number } | null = null;

export function clearThreadsAccessTokenCache(): void {
  accessTokenCache = null;
}

/** DB에 저장된 갱신 토큰을 우선하고, 없으면 THREADS_ACCESS_TOKEN 환경변수를 사용합니다. */
export async function resolveThreadsAccessToken(): Promise<string | null> {
  if (accessTokenCache && Date.now() - accessTokenCache.loadedAt < TOKEN_CACHE_MS) {
    return accessTokenCache.value;
  }

  try {
    const { getStoredThreadsAccessToken } = await import("@/lib/threads/threadTokenStore");
    const stored = await getStoredThreadsAccessToken();
    if (stored) {
      accessTokenCache = { value: stored, loadedAt: Date.now() };
      return stored;
    }
  } catch {
    // 테이블 미적용·조회 실패 시 환경변수로 폴백
  }

  const fromEnv = process.env.THREADS_ACCESS_TOKEN?.trim() || null;
  if (fromEnv) {
    accessTokenCache = { value: fromEnv, loadedAt: Date.now() };
  }
  return fromEnv;
}

async function requireThreadsConfig(): Promise<{ accessToken: string; userId: string }> {
  const accessToken = await resolveThreadsAccessToken();
  const userId = process.env.THREADS_USER_ID?.trim();
  if (!accessToken || !userId) {
    throw new ThreadsClientError(
      "THREADS_ACCESS_TOKEN 또는 THREADS_USER_ID가 설정되어 있지 않습니다.",
      500,
    );
  }
  return { accessToken, userId };
}

export async function refreshThreadsLongLivedToken(
  currentToken: string,
): Promise<RefreshThreadsTokenResult> {
  const token = currentToken.trim();
  if (!token) {
    throw new ThreadsClientError("갱신할 Threads 토큰이 비어 있습니다.", 400);
  }

  const url = new URL(THREADS_REFRESH_TOKEN_URL);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", token);

  const response = await fetch(url, { method: "GET" });
  const payload = await readThreadsJson(response);
  if (!response.ok) {
    throw new ThreadsClientError(
      threadsErrorMessage(payload, `Threads 토큰 갱신에 실패했습니다. (${response.status})`),
      response.status >= 400 && response.status < 600 ? response.status : 502,
    );
  }

  const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  if (!accessToken) {
    throw new ThreadsClientError("갱신 응답에 access_token이 없습니다.", 502);
  }

  const rawExpires = payload.expires_in;
  const expiresIn =
    typeof rawExpires === "number" && Number.isFinite(rawExpires)
      ? rawExpires
      : typeof rawExpires === "string" && Number.isFinite(Number(rawExpires))
        ? Number(rawExpires)
        : DEFAULT_TOKEN_TTL_SEC;
  if (expiresIn <= 0) {
    throw new ThreadsClientError("갱신 응답의 expires_in이 올바르지 않습니다.", 502);
  }

  const tokenType = typeof payload.token_type === "string" ? payload.token_type : null;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  return { accessToken, tokenType, expiresIn, expiresAt };
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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseThreadReplyNode(node: Record<string, unknown>): ThreadReply | null {
  const id = typeof node.id === "string" ? node.id.trim() : "";
  if (!id) return null;
  return {
    id,
    text: typeof node.text === "string" ? node.text : "",
    username: typeof node.username === "string" ? node.username.trim() : "",
    timestamp: typeof node.timestamp === "string" && node.timestamp.trim() ? node.timestamp.trim() : null,
  };
}

/** 1페이지 payload에서 최상위 + replies.data 1단만 평탄화 */
export function flattenThreadRepliesPayload(payload: Record<string, unknown>): ThreadReply[] {
  const out: ThreadReply[] = [];
  const seen = new Set<string>();
  const data = Array.isArray(payload.data) ? payload.data : [];

  for (const item of data) {
    const rec = asRecord(item);
    if (!rec) continue;
    const top = parseThreadReplyNode(rec);
    if (top && !seen.has(top.id)) {
      seen.add(top.id);
      out.push(top);
    }
    const nested = asRecord(rec.replies);
    const nestedData = nested && Array.isArray(nested.data) ? nested.data : [];
    for (const child of nestedData) {
      const childRec = asRecord(child);
      if (!childRec) continue;
      const nestedReply = parseThreadReplyNode(childRec);
      if (nestedReply && !seen.has(nestedReply.id)) {
        seen.add(nestedReply.id);
        out.push(nestedReply);
      }
    }
  }
  return out;
}

function pagingNextUrl(payload: Record<string, unknown>): string | null {
  const paging = asRecord(payload.paging);
  if (!paging) return null;
  const next = typeof paging.next === "string" ? paging.next.trim() : "";
  return next || null;
}

async function threadsGetAbsolute(urlString: string, accessToken: string): Promise<Record<string, unknown>> {
  const url = new URL(urlString);
  if (!url.searchParams.get("access_token")) {
    url.searchParams.set("access_token", accessToken);
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

export async function getThreadReplies(mediaId: string): Promise<ThreadReply[]> {
  const id = mediaId.trim();
  if (!id) {
    throw new ThreadsClientError("댓글을 조회할 mediaId가 비어 있습니다.", 400);
  }

  const { accessToken } = await requireThreadsConfig();
  const collected: ThreadReply[] = [];
  const seen = new Set<string>();

  let payload = await threadsGet(`/${encodeURIComponent(id)}/replies`, {
    fields: "id,text,username,timestamp,replies",
    access_token: accessToken,
  });

  for (let page = 1; page <= MAX_REPLY_PAGES; page += 1) {
    for (const reply of flattenThreadRepliesPayload(payload)) {
      if (seen.has(reply.id)) continue;
      seen.add(reply.id);
      collected.push(reply);
    }
    if (page === MAX_REPLY_PAGES) break;
    const next = pagingNextUrl(payload);
    if (!next) break;
    payload = await threadsGetAbsolute(next, accessToken);
  }

  return collected;
}

export async function postThreadReply(mediaId: string, text: string): Promise<PostThreadReplyResult> {
  const replyToId = mediaId.trim();
  const body = text.trim();
  if (!replyToId) {
    throw new ThreadsClientError("답글 대상 mediaId가 비어 있습니다.", 400);
  }
  if (!body) {
    throw new ThreadsClientError("답글 본문이 비어 있습니다.", 400);
  }

  const { accessToken, userId } = await requireThreadsConfig();
  const container = await threadsPost(`/${encodeURIComponent(userId)}/threads`, {
    media_type: "TEXT",
    text: body,
    reply_to_id: replyToId,
    access_token: accessToken,
  });
  const creationId = typeof container.id === "string" ? container.id.trim() : "";
  if (!creationId) {
    throw new ThreadsClientError("Threads 답글 컨테이너 id를 받지 못했습니다.", 502);
  }

  const published = await threadsPost(`/${encodeURIComponent(userId)}/threads_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
  const publishedId = typeof published.id === "string" ? published.id.trim() : "";
  if (!publishedId) {
    throw new ThreadsClientError("Threads 답글 id를 받지 못했습니다.", 502);
  }

  return { id: publishedId, creationId };
}

export async function publishToThreads(input: PublishToThreadsInput): Promise<PublishToThreadsResult> {
  const text = input.text.trim();
  if (!text) {
    throw new ThreadsClientError("게시할 본문이 비어 있습니다.", 400);
  }

  const { accessToken, userId } = await requireThreadsConfig();
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
