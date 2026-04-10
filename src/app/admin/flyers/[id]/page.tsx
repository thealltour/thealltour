import Link from "next/link";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminFlyerDraftPage from "@/components/admin/flyers/AdminFlyerDraftPage";

export default function AdminFlyerDraftRoutePage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] px-6 py-10 text-[var(--text-primary)] md:px-10">
      <main className="mx-auto w-full max-w-[1400px] space-y-4">
        <nav className="text-sm">
          <Link href="/theall_manager_only/products" className="text-[var(--primary)] hover:underline">
            ← 상품 관리
          </Link>
        </nav>
        <AdminToastProvider>
          <AdminFlyerDraftPage />
        </AdminToastProvider>
      </main>
    </div>
  );
}
