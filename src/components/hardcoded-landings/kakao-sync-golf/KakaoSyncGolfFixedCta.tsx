import { buttonVariants } from "@/components/ui/Button";
import { MOBILE_GOLF_AD_KAKAO_SYNC_AUTH_URL } from "@/lib/adminMobileGolfAds/types";
import { kakaoSyncGolfConfig } from "@/lib/hardcodedLandings/kakaoSyncGolf/config";

export function KakaoSyncGolfFixedCta() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center border-t border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] pt-3 backdrop-blur-sm">
      <div className="pointer-events-auto w-full max-w-md px-6">
        <a
          href={MOBILE_GOLF_AD_KAKAO_SYNC_AUTH_URL}
          className={buttonVariants({
            variant: "kakao",
            size: "lg",
            className:
              "min-h-[3.5rem] w-full text-base font-extrabold leading-snug tracking-tight shadow-lg sm:text-lg",
          })}
        >
          {kakaoSyncGolfConfig.cta.label}
        </a>
      </div>
    </div>
  );
}
