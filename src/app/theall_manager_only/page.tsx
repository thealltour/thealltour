import { redirect } from "next/navigation";

export default function ManagerOnlyPage() {
  redirect("/theall_manager_only/inquiries");
}
