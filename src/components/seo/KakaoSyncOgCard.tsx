/**
 * /golf/kakao-sync 전용 1200×630 OG 카드.
 * 골프장 히어로, 전환 카피, 5만원 쿠폰을 한 프레임에 묶는다.
 */

import { OG_FONT } from "@/components/seo/ogCardShared";

type KakaoSyncOgCardProps = {
  logoDataUrl?: string | null;
  heroImageDataUrl?: string | null;
};

export function KakaoSyncOgCard({
  logoDataUrl,
  heroImageDataUrl,
}: KakaoSyncOgCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        overflow: "hidden",
        fontFamily: OG_FONT,
        background: "linear-gradient(135deg, #f6fbff 0%, #eef7fb 48%, #fff8df 100%)",
      }}
    >
      {heroImageDataUrl ? (
        <img
          src={heroImageDataUrl}
          alt=""
          width={1200}
          height={630}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "50% 35%",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(247,251,254,0.99) 0%, rgba(247,251,254,0.96) 43%, rgba(247,251,254,0.5) 67%, rgba(247,251,254,0.08) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 7,
          background: "linear-gradient(90deg, #1e5b8f 0%, #1e5b8f 62%, #fee500 62%, #fee500 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 120,
          top: 58,
          width: 650,
          height: 514,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "42px 48px",
          borderRadius: 30,
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(220,228,235,0.98)",
          boxShadow: "0 24px 60px rgba(12,25,41,0.16)",
        }}
      >
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            alt=""
            width={189}
            height={34}
            style={{
              height: 34,
              width: 189,
              objectFit: "contain",
              alignSelf: "flex-start",
              marginBottom: 26,
            }}
          />
        ) : (
          <div
            style={{
              fontSize: 21,
              fontWeight: 800,
              color: "#1e5b8f",
              marginBottom: 26,
            }}
          >
            더올투어
          </div>
        )}

        <div
          style={{
            alignSelf: "flex-start",
            display: "flex",
            padding: "8px 15px",
            borderRadius: 999,
            background: "#fff7bf",
            border: "1px solid #f3df52",
            color: "#5a4d00",
            fontSize: 16,
            fontWeight: 750,
            marginBottom: 18,
          }}
        >
          신규회원 전용 · 카카오 1초 가입
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 48,
            fontWeight: 850,
            color: "#0c1929",
            lineHeight: 1.12,
            letterSpacing: "-0.035em",
          }}
        >
          1인당 <span style={{ color: "#e0612a", marginLeft: 10 }}>5만 원</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 48,
            fontWeight: 850,
            color: "#0c1929",
            lineHeight: 1.12,
            letterSpacing: "-0.035em",
            marginTop: 5,
          }}
        >
          팀 전체 무제한 할인
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 20,
            fontSize: 21,
            fontWeight: 650,
            color: "#365365",
          }}
        >
          대표 1명만 가입 · 동반자 전원 자동 적용
        </div>
      </div>

      {/* Satori 호환 인라인 쿠폰 티켓 */}
      <div
        style={{
          position: "absolute",
          right: 140,
          bottom: 74,
          width: 288,
          height: 180,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "24px 24px 18px",
          borderRadius: 22,
          background: "linear-gradient(135deg, #0f2f47 0%, #1e5b8f 100%)",
          border: "3px solid #d7b64a",
          boxShadow: "0 18px 42px rgba(15,47,71,0.28)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#f6e8ae",
              letterSpacing: "0.08em",
            }}
          >
            THEALLTOUR COUPON
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              marginTop: 8,
              fontSize: 38,
              fontWeight: 850,
              letterSpacing: "-0.03em",
            }}
          >
            50,000원
          </div>
          <div style={{ marginTop: 2, fontSize: 16, fontWeight: 650, color: "#f6e8ae" }}>
            1인당 · 팀 전체 무제한
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 10,
            borderTop: "1px dashed rgba(246,232,174,0.55)",
            fontSize: 13,
            fontWeight: 650,
            color: "#f6e8ae",
          }}
        >
          카카오 간편가입 즉시 발급
        </div>
      </div>
    </div>
  );
}
