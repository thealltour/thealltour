import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseDepositPaymentLinks } from "@/lib/deposit/depositPaymentLinks";
import type { DepositPaymentLink } from "@/lib/deposit/depositPaymentLinks";
import { getSiteSettingsLive, type SiteSettings } from "@/lib/siteSettings";

export type DepositPageInfo = {
  inquiryId: string;
  customerName: string;
  productTitle: string | null;
  depositAmount: string;
  bankInfo: string;
  paymentLinks: DepositPaymentLink[];
  companyName: string;
  mainPhone: string;
};

function formatBankInfo(settings: SiteSettings): string {
  const parts = [
    settings.deposit_bank_name?.trim(),
    settings.deposit_bank_account?.trim(),
    settings.deposit_account_holder?.trim()
      ? `예금주: ${settings.deposit_account_holder.trim()}`
      : "",
  ].filter(Boolean);
  return parts.join(" ");
}

export async function getDepositPageInfo(inquiryId: string): Promise<DepositPageInfo | null> {
  const id = inquiryId.trim();
  if (!id) return null;

  const [{ data: inquiry }, settings] = await Promise.all([
    supabaseAdmin
      .from("inquiries")
      .select("id, name, product_title")
      .eq("id", id)
      .maybeSingle(),
    getSiteSettingsLive(),
  ]);

  if (!inquiry) return null;

  return {
    inquiryId: String(inquiry.id),
    customerName: String(inquiry.name ?? "고객"),
    productTitle:
      typeof inquiry.product_title === "string" ? inquiry.product_title : null,
    depositAmount: settings.deposit_amount_default?.trim() || "상담 후 안내",
    bankInfo: formatBankInfo(settings),
    paymentLinks: parseDepositPaymentLinks(
      settings.deposit_payment_links,
      settings.deposit_payment_link,
    ),
    companyName: settings.company_name?.trim() || "(주)더올투어",
    mainPhone: settings.main_phone?.trim() || "",
  };
}
