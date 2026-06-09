import SiteHeader from "@/components/site-chrome/SiteHeader";
import { SectionBody } from "@/components/layout/SectionBody";
import { DepositPageContent } from "@/components/deposit/DepositPageContent";
import { getDepositPageInfo } from "@/lib/deposit/getDepositPageInfo";
import { notFound } from "next/navigation";

type DepositPageProps = {
  searchParams?: Promise<{ inquiryId?: string; ref?: string }>;
};

export default async function DepositPage({ searchParams }: DepositPageProps) {
  const query = (await searchParams) ?? {};
  const inquiryId = (query.inquiryId ?? query.ref)?.trim();
  if (!inquiryId) notFound();

  const info = await getDepositPageInfo(inquiryId);
  if (!info) notFound();

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white">
      <SiteHeader />
      <SectionBody className="py-10">
        <DepositPageContent info={info} />
      </SectionBody>
    </div>
  );
}
