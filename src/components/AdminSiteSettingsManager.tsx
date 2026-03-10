"use client";

import { useEffect, useState } from "react";
import type { SiteSettings } from "@/lib/siteSettings";
import AdminRecommendedSearchManager from "@/components/admin/AdminRecommendedSearchManager";

type SettingsSectionId = "channel" | "company" | "products-hero" | "about" | "golf-hero" | "recommended-search";

const SETTINGS_TABS: { id: SettingsSectionId; label: string }[] = [
  { id: "channel", label: "연락·채널" },
  { id: "company", label: "회사 정보" },
  { id: "products-hero", label: "패키지상품 히어로" },
  { id: "about", label: "About 페이지" },
  { id: "golf-hero", label: "골프 히어로" },
  { id: "recommended-search", label: "추천 검색어" },
];

type HeroRegionConfig = {
  id: string;
  label: string;
  searchKeyword: string;
};

const DEFAULT_HERO_REGIONS: HeroRegionConfig[] = [
  { id: "japan", label: "일본 골프·패키지", searchKeyword: "일본" },
  { id: "se-asia", label: "동남아 골프·휴양", searchKeyword: "동남아" },
  { id: "europe", label: "유럽 여행", searchKeyword: "유럽" },
  { id: "domestic", label: "국내·제주", searchKeyword: "국내" },
];

const DEFAULT_GOLF_HERO_REGIONS: HeroRegionConfig[] = [
  { id: "golf-japan", label: "일본 골프투어", searchKeyword: "일본 골프" },
  { id: "golf-se-asia", label: "동남아 골프투어", searchKeyword: "동남아 골프" },
  { id: "golf-domestic", label: "국내 골프/파크골프", searchKeyword: "국내 골프" },
];

const EMPTY_SETTINGS: SiteSettings = {
  kakao_channel_url: "",
  instagram_url: "",
  kakao_chat_url: "",
  company_name: "",
  ceo_name: "",
  address: "",
  business_reg_no: "",
  tourism_reg_no: "",
  mail_order_reg_no: "",
  main_phone: "",
  main_email: "",
  products_hero_headline: "",
  products_hero_subcopy: "",
  products_hero_regions: "",
  golf_hero_headline: "",
  golf_hero_subcopy: "",
  golf_hero_regions: "",
  home_region_card_ids: "[]",
  about_kicker: "",
  about_title: "",
  about_paragraph1: "",
  about_paragraph2: "",
  about_cta_label: "",
  about_cta_href: "",
};

export default function AdminSiteSettingsManager() {
  const [settings, setSettings] = useState<SiteSettings>(EMPTY_SETTINGS);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("channel");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [heroRegions, setHeroRegions] = useState<HeroRegionConfig[]>(DEFAULT_HERO_REGIONS);
  const [golfHeroRegions, setGolfHeroRegions] = useState<HeroRegionConfig[]>(DEFAULT_GOLF_HERO_REGIONS);

  useEffect(() => {
    async function loadSettings() {
      try {
        setIsLoading(true);
        setErrorMessage("");
        const response = await fetch("/api/admin/site-settings", { cache: "no-store" });
        const result = (await response.json()) as Record<string, string> | { message?: string };
        if (!response.ok || !result || typeof result !== "object" || "message" in result) {
          const msg = (result as { message?: string }).message ?? "환경설정 조회에 실패했습니다.";
          setErrorMessage(msg ?? "환경설정 조회에 실패했습니다.");
          return;
        }
        const data = result as Record<string, string>;
        const nextSettings: SiteSettings = {
          kakao_channel_url: data.kakao_channel_url ?? "",
          instagram_url: data.instagram_url ?? "",
          kakao_chat_url: data.kakao_chat_url ?? "",
          company_name: data.company_name ?? "",
          ceo_name: data.ceo_name ?? "",
          address: data.address ?? "",
          business_reg_no: data.business_reg_no ?? "",
          tourism_reg_no: data.tourism_reg_no ?? "",
          mail_order_reg_no: data.mail_order_reg_no ?? "",
          main_phone: data.main_phone ?? "",
          main_email: data.main_email ?? "",
          products_hero_headline: data.products_hero_headline ?? "",
          products_hero_subcopy: data.products_hero_subcopy ?? "",
          products_hero_regions: data.products_hero_regions ?? "",
          golf_hero_headline: data.golf_hero_headline ?? "",
          golf_hero_subcopy: data.golf_hero_subcopy ?? "",
          golf_hero_regions: data.golf_hero_regions ?? "",
          home_region_card_ids: data.home_region_card_ids ?? "[]",
          about_kicker: data.about_kicker ?? "",
          about_title: data.about_title ?? "",
          about_paragraph1: data.about_paragraph1 ?? "",
          about_paragraph2: data.about_paragraph2 ?? "",
          about_cta_label: data.about_cta_label ?? "",
          about_cta_href: data.about_cta_href ?? "",
        };

        setSettings(nextSettings);

        const rawRegions = nextSettings.products_hero_regions;
        if (typeof rawRegions === "string" && rawRegions.trim()) {
          try {
            const parsed = JSON.parse(rawRegions) as HeroRegionConfig[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              const normalized = parsed
                .map((item) => ({
                  id: String(item.id ?? "").trim(),
                  label: String(item.label ?? "").trim(),
                  searchKeyword: String(item.searchKeyword ?? "").trim(),
                }))
                .filter((item) => item.id && item.label);
              if (normalized.length > 0) {
                setHeroRegions(normalized);
              }
            }
          } catch {
            // keep default
          }
        }

        const rawGolfRegions = nextSettings.golf_hero_regions;
        if (typeof rawGolfRegions === "string" && rawGolfRegions.trim()) {
          try {
            const parsed = JSON.parse(rawGolfRegions) as HeroRegionConfig[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              const normalized = parsed
                .map((item) => ({
                  id: String(item.id ?? "").trim(),
                  label: String(item.label ?? "").trim(),
                  searchKeyword: String(item.searchKeyword ?? "").trim(),
                }))
                .filter((item) => item.id && item.label);
              if (normalized.length > 0) {
                setGolfHeroRegions(normalized);
              }
            }
          } catch {
            // keep default
          }
        }
      } catch {
        setErrorMessage("환경설정 조회 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    loadSettings();
  }, []);

  async function handleSave() {
    try {
      setIsSaving(true);
      setMessage("");
      setErrorMessage("");
      const payload: SiteSettings = {
        ...settings,
        products_hero_regions: JSON.stringify(heroRegions),
        golf_hero_regions: JSON.stringify(golfHeroRegions),
      };

      const response = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setErrorMessage(result.message ?? "환경설정 저장에 실패했습니다.");
        return;
      }
      setMessage("환경설정을 저장했습니다.");
    } catch {
      setErrorMessage("환경설정 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl bg-[var(--card-muted)] p-4 ring-1 ring-[var(--border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold text-[var(--primary)]">사이트 환경설정</h3>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--on-primary)] transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? "저장 중..." : "환경설정 저장"}
        </button>
      </div>

      {/* 서브헤더: 섹션 탭 */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
        {SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              activeSection === tab.id
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-sm text-[var(--text-muted)]">환경설정을 불러오는 중입니다...</p> : null}
      {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
      {errorMessage ? <p className="text-sm text-[var(--danger)]">{errorMessage}</p> : null}

      <div className="min-h-[200px]">
        {activeSection === "channel" && (
          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
          카카오채널 URL
          <input
            type="url"
            value={settings.kakao_channel_url}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                kakao_channel_url: event.target.value,
              }))
            }
            placeholder="예: https://pf.kakao.com/..."
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
          <span className="text-xs font-normal text-[var(--text-muted)]">
            푸터 & 버튼에서 사용할 카카오채널 / 상담 URL 입니다.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
          인스타그램 URL
          <input
            type="url"
            value={settings.instagram_url}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                instagram_url: event.target.value,
              }))
            }
            placeholder="예: https://www.instagram.com/..."
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
          <span className="text-xs font-normal text-[var(--text-muted)]">푸터의 인스타그램 버튼에 사용됩니다.</span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)] md:col-span-2">
          카카오톡 상담 URL (플로팅 버튼)
          <input
            type="url"
            value={settings.kakao_chat_url}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                kakao_chat_url: event.target.value,
              }))
            }
            placeholder="예: https://pf.kakao.com/..."
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
          <span className="text-xs font-normal text-[var(--text-muted)]">
            화면 우측 하단 플로팅 상담 버튼 클릭 시 이동할 URL 입니다.
          </span>
        </label>
          </div>
        )}

        {activeSection === "company" && (
          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
          회사명
          <input
            type="text"
            value={settings.company_name}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                company_name: event.target.value,
              }))
            }
            placeholder="예: (주)더올투어"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
          대표자명
          <input
            type="text"
            value={settings.ceo_name}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                ceo_name: event.target.value,
              }))
            }
            placeholder="예: 김지호"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)] md:col-span-2">
          주소
          <input
            type="text"
            value={settings.address}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                address: event.target.value,
              }))
            }
            placeholder="예: 경기도 고양시 덕양구 ..."
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
          사업자등록번호
          <input
            type="text"
            value={settings.business_reg_no}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                business_reg_no: event.target.value,
              }))
            }
            placeholder="예: 645-88-03583"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
          관광사업등록번호
          <input
            type="text"
            value={settings.tourism_reg_no}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                tourism_reg_no: event.target.value,
              }))
            }
            placeholder="예: 제 0000-00호 / 미정 등"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
          통신판매업신고번호
          <input
            type="text"
            value={settings.mail_order_reg_no}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                mail_order_reg_no: event.target.value,
              }))
            }
            placeholder="예: 제 2024-고양덕양-0000호 / 미정 등"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
          대표번호
          <input
            type="text"
            value={settings.main_phone}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                main_phone: event.target.value,
              }))
            }
            placeholder="예: 02-0000-0000"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
          대표 이메일
          <input
            type="email"
            value={settings.main_email}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                main_email: event.target.value,
              }))
            }
            placeholder="예: thealltour@gmail.com"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
          </div>
        )}

        {activeSection === "products-hero" && (
          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)] md:col-span-2">
          패키지상품 히어로 헤드라인
          <textarea
            rows={2}
            value={settings.products_hero_headline}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                products_hero_headline: event.target.value,
              }))
            }
            placeholder="예: 패키지상품으로 원하시는 지역·예산에 맞춰 바로 상담까지 연결해 드려요."
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)] md:col-span-2">
          패키지상품 히어로 보조 설명
          <textarea
            rows={3}
            value={settings.products_hero_subcopy}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                products_hero_subcopy: event.target.value,
              }))
            }
            placeholder="예: 골프/패키지, 가족·지인·단체 여행까지..."
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <div className="md:col-span-2 space-y-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              패키지상품 히어로 지역 선택 옵션
            </p>
            <button
              type="button"
              onClick={() =>
                setHeroRegions((prev) => [
                  ...prev,
                  {
                    id: `region-${prev.length + 1}`,
                    label: "",
                    searchKeyword: "",
                  },
                ])
              }
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              옵션 추가
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            셀렉트 박스에 노출될 항목입니다. 표시 이름은 셀렉트·유입 상품명에 함께 사용되고, 검색
            키워드는 상품 목록 필터에 사용됩니다.
          </p>
          <div className="space-y-2">
            {heroRegions.map((region, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--card-muted)] p-2 text-[11px] md:grid-cols-[1.2fr_1fr_0.9fr_auto]"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-[var(--text-primary)]">표시 이름</span>
                  <input
                    type="text"
                    value={region.label}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHeroRegions((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, label: value } : item,
                        ),
                      );
                    }}
                    placeholder="예: 일본 골프·패키지"
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-[var(--text-primary)]">검색 키워드</span>
                  <input
                    type="text"
                    value={region.searchKeyword}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHeroRegions((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, searchKeyword: value } : item,
                        ),
                      );
                    }}
                    placeholder="예: 일본"
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-[var(--text-primary)]">URL 파라미터(id)</span>
                  <input
                    type="text"
                    value={region.id}
                    onChange={(event) => {
                      const value = event.target.value;
                      setHeroRegions((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, id: value } : item,
                        ),
                      );
                    }}
                    placeholder="예: japan"
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setHeroRegions((prev) => prev.filter((_, idx) => idx !== index))
                    }
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
          </div>
        )}

        {activeSection === "about" && (
          <div className="space-y-2 rounded-lg border border-[var(--border)] bg-[var(--card-muted)] p-3">
          <p className="text-xs font-bold text-[var(--primary)]">회사소개(About) 페이지 콘텐츠</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            랜딩 페이지로 대체하거나, 회사소개 문구를 수정할 때 사용합니다. CTA URL에 외부 랜딩 주소를
            입력하면 버튼 클릭 시 해당 페이지로 이동합니다.
          </p>
          <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
            상단 라벨(영문)
            <input
              type="text"
              value={settings.about_kicker}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  about_kicker: event.target.value,
                }))
              }
              placeholder="예: ABOUT THEALL TOUR"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
            메인 타이틀
            <input
              type="text"
              value={settings.about_title}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  about_title: event.target.value,
                }))
              }
              placeholder="예: 여행을 디자인해 드립니다"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
            소개 문단 1
            <textarea
              rows={3}
              value={settings.about_paragraph1}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  about_paragraph1: event.target.value,
                }))
              }
              placeholder="첫 번째 소개 문단을 입력하세요."
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
            소개 문단 2
            <textarea
              rows={3}
              value={settings.about_paragraph2}
              onChange={(event) =>
                setSettings((prev) => ({
                  ...prev,
                  about_paragraph2: event.target.value,
                }))
              }
              placeholder="두 번째 소개 문단을 입력하세요."
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
            />
          </label>
          <div className="flex flex-col space-y-2 md:space-y-0 md:grid md:grid-cols-[1.4fr_1.8fr] md:gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
              CTA 버튼 문구
              <input
                type="text"
                value={settings.about_cta_label}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    about_cta_label: event.target.value,
                  }))
                }
                placeholder="예: 맞춤 여행 상담 받기"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)]">
              CTA 이동 URL
              <input
                type="text"
                value={settings.about_cta_href}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    about_cta_href: event.target.value,
                  }))
                }
                placeholder="예: /#contact 또는 https://landing.thealltour.com/about"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
              />
              <span className="text-[11px] font-normal text-[var(--text-muted)]">
                http로 시작하면 새 탭에서 외부 랜딩 페이지를 엽니다. 비워두면 기본 문의 섹션(/#contact)으로 이동합니다.
              </span>
            </label>
          </div>
          </div>
        )}

        {activeSection === "golf-hero" && (
          <div className="flex flex-col space-y-3 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)] md:col-span-2">
          골프/파크골프 히어로 헤드라인
          <textarea
            rows={2}
            value={settings.golf_hero_headline}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                golf_hero_headline: event.target.value,
              }))
            }
            placeholder="예: 골프/파크골프 전문 맞춤 설계로 라운딩 동선을 깔끔하게 잡아드립니다."
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text-primary)] md:col-span-2">
          골프/파크골프 히어로 보조 설명
          <textarea
            rows={3}
            value={settings.golf_hero_subcopy}
            onChange={(event) =>
              setSettings((prev) => ({
                ...prev,
                golf_hero_subcopy: event.target.value,
              }))
            }
            placeholder="예: 선호하는 골프장, 라운딩 횟수, 동행 인원과 예산을 알려주시면..."
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-6 outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
          />
        </label>
        <div className="md:col-span-2 space-y-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              골프/파크골프 히어로 지역 선택 옵션
            </p>
            <button
              type="button"
              onClick={() =>
                setGolfHeroRegions((prev) => [
                  ...prev,
                  {
                    id: `golf-region-${prev.length + 1}`,
                    label: "",
                    searchKeyword: "",
                  },
                ])
              }
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              옵션 추가
            </button>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            골프/파크골프 전용 뷰에서 노출될 옵션입니다. 표시 이름은 유입 상품명에도 사용되고, 검색
            키워드는 골프 상품 목록 필터에 사용됩니다.
          </p>
          <div className="space-y-2">
            {golfHeroRegions.map((region, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border border-[var(--border)] bg-[var(--card-muted)] p-2 text-[11px] md:grid-cols-[1.2fr_1fr_0.9fr_auto]"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-[var(--text-primary)]">표시 이름</span>
                  <input
                    type="text"
                    value={region.label}
                    onChange={(event) => {
                      const value = event.target.value;
                      setGolfHeroRegions((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, label: value } : item,
                        ),
                      );
                    }}
                    placeholder="예: 일본 골프투어"
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-[var(--text-primary)]">검색 키워드</span>
                  <input
                    type="text"
                    value={region.searchKeyword}
                    onChange={(event) => {
                      const value = event.target.value;
                      setGolfHeroRegions((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, searchKeyword: value } : item,
                        ),
                      );
                    }}
                    placeholder="예: 일본 골프"
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-[var(--text-primary)]">URL 파라미터(id)</span>
                  <input
                    type="text"
                    value={region.id}
                    onChange={(event) => {
                      const value = event.target.value;
                      setGolfHeroRegions((prev) =>
                        prev.map((item, idx) =>
                          idx === index ? { ...item, id: value } : item,
                        ),
                      );
                    }}
                    placeholder="예: golf-japan"
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[color:color-mix(in_oklab,var(--primary)_20%,transparent)]"
                  />
                </div>
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setGolfHeroRegions((prev) => prev.filter((_, idx) => idx !== index))
                    }
                    className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-semibold text-[var(--text-muted)] hover:bg-[var(--surface-muted)]"
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
          </div>
        )}

        {activeSection === "recommended-search" && (
          <AdminRecommendedSearchManager />
        )}
      </div>
    </section>
  );
}

