"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Product } from "@/types/product";
import type { FlyerDraftApiRecord, FlyerPersistedBootstrap, FlyerTemplateKey } from "@/lib/flyers/flyer.types";
import { FlyerGenerateModal } from "@/components/admin/products/modals/FlyerGenerateModal";
import { useAdminToast } from "@/components/admin/AdminToastProvider";

function recordToBootstrap(d: FlyerDraftApiRecord): FlyerPersistedBootstrap {
  return {
    id: d.id,
    shareSlug: d.shareSlug ?? "",
    updatedAt: d.updatedAt,
    draft: {
      templateKey: d.templateKey as FlyerTemplateKey,
      layoutOptions: d.layoutOptions,
      sections: d.sections,
      fields: d.fields,
      weather: d.weather,
      outfit: d.outfit,
      selectedImageUrls: d.imageUrls,
    },
  };
}

export default function AdminFlyerDraftPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useAdminToast();
  const rawId = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [bootstrap, setBootstrap] = useState<FlyerPersistedBootstrap | null>(null);

  const load = useCallback(async () => {
    if (!rawId?.trim()) {
      setError("유효한 유인물 ID가 없습니다.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fr = await fetch(`/api/admin/flyers/${encodeURIComponent(rawId.trim())}`);
      const fj = (await fr.json()) as { ok?: boolean; message?: string; draft?: FlyerDraftApiRecord };
      if (!fr.ok || !fj.ok || !fj.draft) {
        throw new Error(fj.message || "유인물을 불러오지 못했습니다.");
      }
      const d = fj.draft;
      const pr = await fetch(`/api/admin/products/${encodeURIComponent(d.productId)}`);
      const pj = (await pr.json()) as Product & { message?: string };
      if (!pr.ok || !pj?.id) {
        throw new Error((pj as { message?: string }).message || "상품을 불러오지 못했습니다.");
      }
      setProduct(pj as Product);
      setBootstrap(recordToBootstrap(d));
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오기에 실패했습니다.");
      setProduct(null);
      setBootstrap(null);
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main className="mx-auto max-w-lg py-20 text-center text-sm text-[var(--text-muted)]">
        유인물을 불러오는 중…
      </main>
    );
  }

  if (error || !product || !bootstrap) {
    return (
      <main className="mx-auto max-w-lg space-y-4 py-16">
        <p className="text-sm text-[var(--danger)]">{error ?? "데이터가 없습니다."}</p>
        <Link
          href="/theall_manager_only/products"
          className="inline-block rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--on-primary)]"
        >
          상품 관리로 돌아가기
        </Link>
      </main>
    );
  }

  return (
    <FlyerGenerateModal
      open
      product={product}
      persistedBootstrap={bootstrap}
      showToast={showToast}
      onClose={() => router.push("/theall_manager_only/products")}
    />
  );
}
