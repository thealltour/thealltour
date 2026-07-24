import { redirect } from "next/navigation";

/** 구 경로 북마크 호환 — 대시보드 kakao_sync 탭으로 이동 */
export default function AdminKakaoSyncAnalyticsPageRoute() {
  redirect("/theall_manager_only?tab=kakao_sync");
}
