import type { BlogPostBuildMeta } from "@/lib/blog/blogPost.types";

export type BlogPostGenerateModalProps = {
  open: boolean;
  productId: string | null;
  productTitle: string;
  onClose: () => void;
  onCopied?: () => void;
};

export type BlogPostModalFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      post: string;
      meta: BlogPostBuildMeta;
      titleCandidates: string[];
      ctaCandidates: string[];
    };
