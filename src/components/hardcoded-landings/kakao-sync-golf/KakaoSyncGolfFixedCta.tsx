import { buttonVariants } from "@/components/ui/Button";
import { MOBILE_GOLF_AD_KAKAO_SYNC_AUTH_URL } from "@/lib/adminMobileGolfAds/types";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";

export function KakaoSyncGolfFixedCta() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
      <div className="pointer-events-auto w-full rounded-2xl border border-black/5 bg-white/95 p-2 shadow-[0_8px_28px_rgba(0,0,0,0.14)] backdrop-blur-sm">
        <a
          href={MOBILE_GOLF_AD_KAKAO_SYNC_AUTH_URL}
          className={buttonVariants({
            variant: "kakao",
            size: "lg",
            className:
              "min-h-[3.5rem] w-full text-base font-extrabold leading-snug tracking-tight shadow-md sm:text-lg",
          })}
        >
          {kakaoSyncGolfConfig.cta.label}
        </a>
      </div>
    </div>
  );
}
