import type { ThreadCopy, ThreadsMarketingMode } from "@/lib/threads/threadCopy.types";

export type ThreadsGenerateModalProps = {
  open: boolean;
  productId: string | null;
  productTitle: string;
  onClose: () => void;
  onPublished?: (permalink: string | null) => void;
};

export type ThreadsGenerateApiResponse =
  | {
      ok: true;
      productId: string;
      marketingMode: ThreadsMarketingMode;
      copy: ThreadCopy;
      draftContent: string;
      heroImageUrl: string | null;
    }
  | { ok: false; message: string };

export type ThreadsPublishApiResponse =
  | {
      ok: true;
      productId: string;
      targetKeyword: string;
      publishedAt: string;
      threads: { id: string; permalink: string | null; creationId: string };
      logId: null;
    }
  | { ok: false; message: string };
