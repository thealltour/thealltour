import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMemberSessionFromCookies } from "@/lib/memberSession";

export default async function MypageRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);
  if (!session) redirect("/login");

  return <>{children}</>;
}
