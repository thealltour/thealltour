import type { Metadata } from "next";
import { CorporateSegmentLayout } from "@/components/corporate/CorporateSegmentLayout";
import { getCorporateSegment } from "@/lib/corporate/content";

const segment = getCorporateSegment("public-institutions");

export const metadata: Metadata = {
  title: segment.title,
  description: segment.description,
};

export default function CorporatePublicInstitutionsPage() {
  return <CorporateSegmentLayout segment={segment} />;
}
