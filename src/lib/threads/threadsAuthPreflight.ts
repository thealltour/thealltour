/**
 * Non-publishing Threads auth preflight (PUB-3).
 * Fetches profile fields only — never creates containers or posts.
 */

import "server-only";

import { ThreadsClientError } from "@/lib/threads/threadsClient";

const THREADS_GRAPH_BASE = "https://graph.threads.net/v1.0";

export type ThreadsAuthPreflightInput = {
  accessToken: string;
  userId: string;
  /** Optional fetch override for tests */
  fetchImpl?: typeof fetch;
};

export type ThreadsAuthPreflightResult = {
  ok: boolean;
  remoteAuthVerified: boolean;
  accountIdentityValid: boolean;
  remoteUserId: string | null;
  username: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { error: { message: raw.slice(0, 300) } };
  }
}

function errorMessage(payload: Record<string, unknown>, fallback: string): string {
  const error = payload.error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim().slice(0, 240);
  }
  return fallback;
}

/**
 * GET /{user-id}?fields=id,username — authentication + identity check only.
 */
export async function preflightThreadsAuth(
  input: ThreadsAuthPreflightInput,
): Promise<ThreadsAuthPreflightResult> {
  const accessToken = input.accessToken.trim();
  const userId = input.userId.trim();
  if (!accessToken || !userId) {
    return {
      ok: false,
      remoteAuthVerified: false,
      accountIdentityValid: false,
      remoteUserId: null,
      username: null,
      errorCode: "MISSING_LOCAL_CREDENTIAL",
      errorMessage: "accessToken and userId are required for Threads auth preflight",
    };
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(`${THREADS_GRAPH_BASE}/${encodeURIComponent(userId)}`);
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", accessToken);

  try {
    const response = await fetchImpl(url, { method: "GET" });
    const payload = await readJson(response);
    if (!response.ok) {
      return {
        ok: false,
        remoteAuthVerified: false,
        accountIdentityValid: false,
        remoteUserId: null,
        username: null,
        errorCode: "REMOTE_AUTH_REJECTED",
        errorMessage: errorMessage(
          payload,
          `Threads auth preflight failed (${response.status})`,
        ),
      };
    }

    const remoteUserId = typeof payload.id === "string" ? payload.id.trim() : "";
    const username = typeof payload.username === "string" ? payload.username.trim() : null;
    const accountIdentityValid = Boolean(remoteUserId) && remoteUserId === userId;
    return {
      ok: accountIdentityValid,
      remoteAuthVerified: true,
      accountIdentityValid,
      remoteUserId: remoteUserId || null,
      username,
      errorCode: accountIdentityValid ? null : "IDENTITY_MISMATCH",
      errorMessage: accountIdentityValid
        ? null
        : "Remote Threads id does not match bound userId",
    };
  } catch (error) {
    const message =
      error instanceof ThreadsClientError
        ? error.message
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      ok: false,
      remoteAuthVerified: false,
      accountIdentityValid: false,
      remoteUserId: null,
      username: null,
      errorCode: "PREFLIGHT_NETWORK_ERROR",
      errorMessage: message.slice(0, 240),
    };
  }
}
