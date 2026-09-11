/**
 * Threads marketing PublicationAdapter (PUB-2).
 *
 * Wraps existing publishToThreads() — does not duplicate Graph HTTP logic.
 * TEXT + optional IMAGE only. No video/reel.
 *
 * Admin Threads routes remain a separate legacy path; this adapter is only for
 * the marketing PublicationOrchestrator.
 */

import "server-only";

import type { ResolvedAdapterCredential } from "@/lib/marketing/social/domain/credentials";
import type {
  PublicationAdapter,
  PublicationAdapterRuntime,
  PublicationRequest,
  PublicationResult,
} from "@/lib/marketing/social/publication/types";
import {
  publishToThreads,
  ThreadsClientError,
  type PublishToThreadsInput,
  type PublishToThreadsResult,
} from "@/lib/threads/threadsClient";

export type ThreadsPublishClient = (input: PublishToThreadsInput) => Promise<PublishToThreadsResult>;

function resolveThreadsAuth(credential: ResolvedAdapterCredential): {
  accessToken: string;
  userId: string;
} {
  const accessToken = credential.material.accessToken?.trim() || "";
  const userId = credential.material.userId?.trim() || "";
  if (!accessToken || !userId) {
    throw new Error("Threads adapter credential requires accessToken and userId material keys");
  }
  return { accessToken, userId };
}

function mapThreadsError(error: unknown): PublicationResult["error"] {
  if (error instanceof ThreadsClientError) {
    return {
      code: "THREADS_CLIENT_ERROR",
      message: error.message.slice(0, 240),
      retryable: error.httpStatus >= 500 || error.httpStatus === 429,
      providerCode: String(error.httpStatus),
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    code: "THREADS_ADAPTER_ERROR",
    message: message.slice(0, 240),
    retryable: false,
  };
}

/**
 * Canonical marketing Threads adapter. Call only via PublicationOrchestrator.
 */
export function createThreadsMarketingPublicationAdapter(deps?: {
  publish?: ThreadsPublishClient;
}): PublicationAdapter {
  const publishClient = deps?.publish ?? publishToThreads;
  return {
    kind: "publication_adapter",
    provider: "meta",
    channel: "threads",
    async publish(
      request: PublicationRequest,
      runtime?: PublicationAdapterRuntime,
    ): Promise<PublicationResult> {
      if (request.channel !== "threads" || request.provider !== "meta") {
        return {
          status: "failed",
          provider: "meta",
          channel: "threads",
          sideEffectPerformed: false,
          error: {
            code: "CHANNEL_MISMATCH",
            message: "Threads adapter only accepts meta/threads requests",
            retryable: false,
          },
        };
      }
      if (!runtime?.credential) {
        return {
          status: "failed",
          provider: "meta",
          channel: "threads",
          sideEffectPerformed: false,
          error: {
            code: "CREDENTIAL_REQUIRED",
            message: "Threads adapter requires PublicationAdapterRuntime.credential",
            retryable: false,
          },
        };
      }

      const text = request.marketingPost.body?.trim() || "";
      if (!text) {
        return {
          status: "failed",
          provider: "meta",
          channel: "threads",
          sideEffectPerformed: false,
          error: {
            code: "EMPTY_BODY",
            message: "Threads TEXT publication requires non-empty body",
            retryable: false,
          },
        };
      }

      try {
        const auth = resolveThreadsAuth(runtime.credential);
        const imageUrl = request.imageUrl?.trim() || undefined;
        const remote = await publishClient({
          text,
          imageUrl,
          auth,
        });
        return {
          status: "published",
          provider: "meta",
          channel: "threads",
          externalPostId: remote.id,
          externalUrl: remote.permalink,
          sideEffectPerformed: true,
          error: null,
        };
      } catch (error) {
        return {
          status: "failed",
          provider: "meta",
          channel: "threads",
          sideEffectPerformed: false,
          error: mapThreadsError(error),
        };
      }
    },
  };
}

/** Explicit non-goal marker for callers/docs/tests */
export const THREADS_MARKETING_ADAPTER_NOT_ADMIN_ROUTE =
  "threads_marketing_adapter_is_not_admin_threads_publish" as const;
