import SignupForm from "@/components/SignupForm";
import SiteHeader from "@/components/SiteHeader";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f3f8ff] to-white text-[#0f172a]">
      <SiteHeader activeTab="signup" />

      <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12 md:px-10">
        <section className="rounded-3xl bg-[#1d4ed8] p-10 text-white shadow-xl">
          <p className="mb-3 text-sm font-semibold tracking-wide text-blue-100">THEALL TOUR MEMBERSHIP</p>
          <h1 className="text-3xl font-bold md:text-4xl">회원가입</h1>
          <p className="mt-3 text-sm text-blue-100 md:text-base">
            여행후기 작성과 맞춤형 혜택 안내를 위해 회원가입을 진행해 주세요.
          </p>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-md ring-1 ring-[#dbeafe] md:p-10">
          <SignupForm />
        </section>
      </main>
    </div>
  );
}
