"use client";

/**
 * 관리자 화면에서 Supabase에 올라간 파일 URL 삭제 요청.
 * 외부 URL·파싱 불가 URL은 서버에서 건너뜀.
 */
export async function deleteStorageUrlsClient(urls: string[]): Promise<{
  ok: boolean;
  deletedPaths: string[];
  skippedUrls: string[];
  errors: string[];
}> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { ok: true, deletedPaths: [], skippedUrls: [], errors: [] };
  }
  const res = await fetch("/api/admin/storage/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls: unique }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    deletedPaths?: string[];
    skippedUrls?: string[];
    errors?: string[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error ?? "스토리지 삭제 요청에 실패했습니다.");
  }
  return {
    ok: Boolean(data.ok),
    deletedPaths: data.deletedPaths ?? [],
    skippedUrls: data.skippedUrls ?? [],
    errors: data.errors ?? [],
  };
}
