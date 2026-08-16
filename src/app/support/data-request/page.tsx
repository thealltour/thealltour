import Link from "next/link";
import SiteHeader from "@/components/site-chrome/SiteHeader";

export const metadata = {
  title: "개인정보 열람·정정·삭제 요청",
  description: "더올투어 개인정보 주체 권리 요청 안내",
};

export default function DataRequestPage() {
  return (
    <div className="min-h-screen page-bg-wash text-[var(--text-primary)]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl space-y-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[var(--primary)] p-8 text-[var(--on-primary)] shadow-xl">
          <h1 className="text-3xl font-bold md:text-4xl">개인정보 열람·정정·삭제 요청</h1>
          <p className="mt-2 text-sm text-blue-100">
            개인정보 보호법에 따른 열람, 정정·삭제, 처리정지 요청 절차를 안내합니다.
          </p>
        </section>
        <section className="space-y-4 rounded-3xl bg-white p-8 shadow-md ring-1 ring-[var(--primary-soft)] text-sm leading-7 text-slate-700">
          <p>
            회원님은 언제든지 등록된 개인정보에 대해 열람·정정·삭제·처리정지를 요청하실 수 있습니다. 요청
            시 본인 확인을 위해 추가 안내가 있을 수 있습니다.
          </p>
          <ol className="list-inside list-decimal space-y-3">
            <li>
              <strong>이메일</strong>:{" "}
              <a
                href="mailto:thealltour@gmail.com?subject=%5B%EA%B0%9C%EC%9D%B8%EC%A0%95%EB%B3%B4%20%EC%9A%94%EC%B2%AD%5D"
                className="font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                thealltour@gmail.com
              </a>
              로 성함, 연락처, 요청 유형(열람/정정/삭제 등)을 적어 보내 주세요.
            </li>
            <li>
              <strong>웹 문의</strong>:{" "}
              <Link href="/#contact" className="font-semibold text-[var(--primary)] underline underline-offset-2">
                상담·문의
              </Link>
              를 통해 동일 내용을 접수하실 수 있습니다.
            </li>
          </ol>
          <p className="text-slate-600">
            자세한 처리 기한·보관 기간은{" "}
            <Link href="/privacy" className="text-[var(--primary)] underline underline-offset-2">
              개인정보처리방침
            </Link>
            을 참고해 주세요.
          </p>
        </section>
      </main>
    </div>
  );
}
