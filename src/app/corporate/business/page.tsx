import type { Metadata } from "next";
import { CorporateSegmentLayout } from "@/components/corporate/CorporateSegmentLayout";
import { getCorporateSegment } from "@/lib/corporate/content";

const segment = getCorporateSegment("business");

export const metadata: Metadata = {
  title: segment.title,
  description: segment.description,
};

export default function CorporateBusinessPage() {
  return <CorporateSegmentLayout segment={segment} />;
}
