import { redirect } from "next/navigation";

export default function AdminInboundSmsPage() {
  redirect("/theall_manager_only/sms?filter=unmatched");
}