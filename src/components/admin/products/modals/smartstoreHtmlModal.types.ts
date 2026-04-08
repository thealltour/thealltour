import type { SmartstoreHtmlBuildMeta } from "@/lib/smartstore/smartstoreHtml.types";

export type SmartstoreHtmlGenerateModalProps = {
  open: boolean;
  productId: string | null;
  productTitle: string;
  onClose: () => void;
  /** 복사 성공 시 (토스트 등) */
  onCopied?: () => void;
};

export type SmartstoreHtmlModalFetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; html: string; meta: SmartstoreHtmlBuildMeta };
