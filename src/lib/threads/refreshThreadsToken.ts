import "server-only";

import {
  clearThreadsAccessTokenCache,
  refreshThreadsLongLivedToken,
  resolveThreadsAccessToken,
} from "@/lib/threads/threadsClient";
import {
  insertThreadMarketingLog,
  saveThreadsAccessToken,
} from "@/lib/threads/threadTokenStore";

export type ThreadsTokenRefreshJobResult = {
  expiresAt: string;
  expiresIn: number;
};

function tokenSuffix(token: string): string {
  return token.length <= 4 ? "****" : token.slice(-4);
}

export async function runThreadsTokenRefresh(): Promise<ThreadsTokenRefreshJobResult> {
  const current = await resolveThreadsAccessToken();
  if (!current) {
    await insertThreadMarketingLog({
      event: "token_refresh",
      status: "error",
      message: "활성 Threads 토큰이 없습니다. THREADS_ACCESS_TOKEN 또는 DB 저장 토큰이 필요합니다.",
    });
    throw new Error("활성 Threads 토큰이 없습니다.");
  }

  try {
    const refreshed = await refreshThreadsLongLivedToken(current);
    await saveThreadsAccessToken({
      accessToken: refreshed.accessToken,
      expiresAt: refreshed.expiresAt,
    });
    clearThreadsAccessTokenCache();
    await insertThreadMarketingLog({
      event: "token_refresh",
      status: "ok",
      message: `장기 토큰 갱신 완료. 만료 ${refreshed.expiresAt} (expires_in=${refreshed.expiresIn}s)`,
      meta: {
        expires_in: refreshed.expiresIn,
        expires_at: refreshed.expiresAt,
        token_suffix: tokenSuffix(refreshed.accessToken),
      },
    });
    return { expiresAt: refreshed.expiresAt, expiresIn: refreshed.expiresIn };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await insertThreadMarketingLog({
      event: "token_refresh",
      status: "error",
      message,
    });
    throw error;
  }
}
