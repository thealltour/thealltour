import type { BlogPostBuildMeta, BlogPostType, BlogPostsThreePack } from "@/lib/blog/blogPost.types";

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
      posts: BlogPostsThreePack;
      metaByType: Record<BlogPostType, BlogPostBuildMeta>;
      titleCandidatesByType: Record<BlogPostType, string[]>;
      ctaCandidates: string[];
    };
