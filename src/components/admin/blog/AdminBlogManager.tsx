"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { AtSign, ExternalLink, Loader2, RefreshCw, Save } from "lucide-react";
import type { RssPost } from "@/lib/rss.types";
import {
  createEmptyThreadReplyDestination,
  parseThreadReplyDestinations,
  serializeThreadReplyDestinations,
  type ThreadReplyDestination,
} from "@/lib/threads/threadReplyDestinations";
import ThreadsBlogGenerateModal from "@/components/admin/blog/ThreadsBlogGenerateModal";

type AdminBlogManagerProps = {
  initialPosts: RssPost[];
  initialDestinationsJson: string;
  rssConfigured: boolean;
};

export default function AdminBlogManager({
  initialPosts,
  initialDestinationsJson,
  rssConfigured,
}: AdminBlogManagerProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [destinations, setDestinations] = useState<ThreadReplyDestination[]>(() =>
    parseThreadReplyDestinations(initialDestinationsJson),
  );
  const [committedDestinations, setCommittedDestinations] = useState<ThreadReplyDestination[]>(() =>
    parseThreadReplyDestinations(initialDestinationsJson),
  );
  const [savingDest, setSavingDest] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threadsPost, setThreadsPost] = useState<RssPost | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const savedDestinations = committedDestinations;

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  const saveDestinations = useCallback(async () => {
    setSavingDest(true);
    setError(null);
    setMessage(null);
    try {
      const payload = serializeThreadReplyDestinations(destinations);
      const res = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_reply_destinations: payload }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data.message ?? `저장 실패 (${res.status})`);
        return;
      }
      const parsed = parseThreadReplyDestinations(payload);
      setDestinations(parsed);
      setCommittedDestinations(parsed);
      setMessage("유도 URL 목록을 저장했습니다.");
    } catch {
      setError("네트워크 오류로 저장하지 못했습니다.");
    } finally {
      setSavingDest(false);
    }
  }, [destinations]);

  const refreshPosts = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/blog/rss-posts", { credentials: "same-origin" });
      const data = (await res.json()) as { ok?: boolean; posts?: RssPost[]; message?: string };
      if (!res.ok || !data.ok || !Array.isArray(data.posts)) {
        setError(data.message ?? `RSS 새로고침 실패 (${res.status})`);
        return;
      }
      setPosts(data.posts);
      setMessage(`RSS ${data.posts.length}건을 불러왔습니다.`);
    } catch {
      setError("네트워크 오류로 RSS를 새로고침하지 못했습니다.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">자동답글 유도 URL</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              블로그 스레드 발행 시 댓글 키워드 매칭 답글에 넣을 링크입니다. 라벨과 URL을 자유롭게
              추가·수정·삭제하세요. 예: /blog, /golf/kakao-sync, https://thealltour.com/blog
            </p>
          </div>
          <button
            type="button"
            disabled={savingDest}
            onClick={() => void saveDestinations()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] hover:opacity-90 disabled:opacity-50"
          >
            {savingDest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            저장
          </button>
        </div>

        <div className="space-y-2">
          {destinations.map((dest, index) => (
            <div
              key={dest.id}
              className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
            >
              <input
                type="text"
                value={dest.label}
                onChange={(event) =>
                  setDestinations((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
                placeholder="표시 이름 (예: 블로그 홈)"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
              <input
                type="text"
                value={dest.url}
                onChange={(event) =>
                  setDestinations((prev) =>
                    prev.map((item, i) =>
                      i === index ? { ...item, url: event.target.value } : item,
                    ),
                  )
                }
                placeholder="https://... 또는 /blog"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)]"
              />
              <button
                type="button"
                onClick={() => setDestinations((prev) => prev.filter((_, i) => i !== index))}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface)]"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setDestinations((prev) => [...prev, createEmptyThreadReplyDestination()])
          }
          className="mt-3 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-muted)]"
        >
          + 유도 URL 추가
        </button>
      </section>

      {(message || error) && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            error
              ? "border-[var(--danger)]/40 bg-[var(--danger-bg)] text-[var(--danger)]"
              : "border-[var(--success)]/30 bg-[var(--success-bg)] text-[var(--success)]"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)]">RSS 블로그 글</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              환경설정의 네이버 블로그 URL(또는 BLOG_RSS_URL)에서 불러옵니다. 글마다 스레드를 만들고
              검수 후 발행할 수 있습니다.
            </p>
          </div>
          <button
            type="button"
            disabled={refreshing || !rssConfigured}
            onClick={() => void refreshPosts()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            새로고침
          </button>
        </div>

        {!rssConfigured ? (
          <p className="text-sm text-[var(--text-secondary)]">
            RSS가 설정되지 않았습니다. 환경설정에서 네이버 블로그 URL을 등록하거나 BLOG_RSS_URL을
            설정하세요.
          </p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">불러온 글이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {posts.map((post) => (
              <li
                key={post.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {post.thumbnail ? (
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-[var(--surface-muted)]">
                      <Image
                        src={post.thumbnail}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="80px"
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="h-14 w-20 shrink-0 rounded-md bg-[var(--surface-muted)]" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--text-primary)]">{post.title}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {post.pubDate || "날짜 없음"} · {post.source}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                      {post.summary}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <a
                    href={post.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    원문
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setThreadsPost(post);
                      setModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  >
                    <AtSign className="h-3.5 w-3.5 text-[var(--primary)]" />
                    스레드
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ThreadsBlogGenerateModal
        open={modalOpen}
        postTitle={threadsPost?.title ?? ""}
        postLink={threadsPost?.link ?? ""}
        destinations={savedDestinations}
        onClose={() => {
          setModalOpen(false);
          setThreadsPost(null);
        }}
        onPublished={() => {
          setMessage("Threads에 게시했습니다. 자동답글은 크론이 키워드 댓글에 반응합니다.");
        }}
      />
    </div>
  );
}
