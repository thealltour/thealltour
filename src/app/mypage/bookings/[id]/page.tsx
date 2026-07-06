import { isPortOneEnabled } from "@/lib/payments/portone/config";
import MyPageBookingDetailClient from "./MyPageBookingDetailClient";

export default function MyPageBookingDetailPage() {
  return <MyPageBookingDetailClient portOneEnabled={isPortOneEnabled()} />;
}
