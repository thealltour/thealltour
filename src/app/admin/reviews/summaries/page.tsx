import { redirect } from "next/navigation";

export default function AdminReviewSummariesRedirectPage() {
  redirect("/theall_manager_only/review-summaries");
}
