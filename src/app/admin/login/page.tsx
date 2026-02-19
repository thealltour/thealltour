import Image from "next/image";
import Link from "next/link";
import AdminLoginForm from "@/components/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[#f8fbff] px-6 py-10 text-[#0f172a] md:px-10">
      <main className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe]">
        <Link href="/" className="mb-4 inline-flex items-center">
          <Image
            src="/thealltour-logo.png"
            alt="더올투어 로고"
            width={150}
            height={96}
            className="h-auto w-[130px]"
            sizes="130px"
          />
        </Link>
        <div className="mb-6 space-y-2">
          <p className="text-sm font-semibold tracking-wide text-[#2563eb]">THEALL TOUR ADMIN</p>
          <h1 className="text-2xl font-bold">관리자 로그인</h1>
          <p className="text-sm text-slate-600">
            관리자 아이디와 비밀번호를 입력하면 문의 관리 페이지에 접속할 수 있습니다.
          </p>
        </div>
        <AdminLoginForm />
      </main>
    </div>
  );
}
