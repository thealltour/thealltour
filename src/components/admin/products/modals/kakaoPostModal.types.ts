import type { KakaoPostBuildMeta } from "@/lib/blog/blogPost.types";

export type KakaoPostGenerateModalProps = {
  open: boolean;
  productId: string | null;
  productTitle: string;
  onClose: () => void;
  onCopied?: () => void;
};

export type KakaoPostModalFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      text: string;
      meta: KakaoPostBuildMeta;
      hookCandidates: string[];
    };
