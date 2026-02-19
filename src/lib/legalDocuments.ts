import { PRIVACY_POLICY_TEXT, SERVICE_TERMS_TEXT } from "@/content/legal";
import { supabase } from "@/lib/supabase";

export type LegalDocumentType = "terms" | "privacy";

export type LegalDocuments = {
  terms: string;
  privacy: string;
};

export const LEGAL_NOTICE_TITLES: Record<LegalDocumentType, string> = {
  terms: "__LEGAL__TERMS",
  privacy: "__LEGAL__PRIVACY",
};

const FALLBACK_LEGAL_DOCUMENTS: LegalDocuments = {
  terms: SERVICE_TERMS_TEXT,
  privacy: PRIVACY_POLICY_TEXT,
};

export async function getLegalDocuments(): Promise<LegalDocuments> {
  const termsResult = await supabase
    .from("notices")
    .select("content")
    .eq("title", LEGAL_NOTICE_TITLES.terms)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const privacyResult = await supabase
    .from("notices")
    .select("content")
    .eq("title", LEGAL_NOTICE_TITLES.privacy)
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const terms =
    !termsResult.error && typeof termsResult.data?.content === "string" && termsResult.data.content.trim()
      ? termsResult.data.content
      : FALLBACK_LEGAL_DOCUMENTS.terms;
  const privacy =
    !privacyResult.error &&
    typeof privacyResult.data?.content === "string" &&
    privacyResult.data.content.trim()
      ? privacyResult.data.content
      : FALLBACK_LEGAL_DOCUMENTS.privacy;

  return { terms, privacy };
}
