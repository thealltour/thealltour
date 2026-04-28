import type { BandHookBuildMeta } from "@/lib/blog/blogPost.types";

export type BandHookGenerateModalProps = {
  open: boolean;
  productId: string | null;
  productTitle: string;
  onClose: () => void;
  onCopied?: () => void;
};

export type BandHookModalFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      text: string;
      meta: BandHookBuildMeta;
      hookCandidates: string[];
    };
