import { redirect } from "next/navigation";

export default function MyPageIndexPage() {
  redirect("/mypage/dashboard");
}
