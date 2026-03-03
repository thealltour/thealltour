# 햄버거 메뉴(드로어/시트) JSX — 전체 복사용

아래 블록을 그대로 복사해 사용할 수 있습니다.  
원본: `src/components/MobileFloatingMenu.tsx` (createPortal로 body에 렌더되는 부분)

---

## 드로어 컨테이너 + 메뉴 리스트 + 로그인/로그아웃 영역 (isOpen일 때만 렌더)

```jsx
<div className="mt-2 w-[min(80vw,17rem)] rounded-2xl border border-site-border bg-[#0F172A]/98 p-2 shadow-md shadow-black/40 backdrop-blur-md">
  <ul className="flex flex-col gap-1">
    {menuItems.map((item) => {
      const isPathActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
      const isActive = activeTab === item.key || isPathActive;
      const isPending = pendingKey === item.key;
      const isPressed = pressedKey === item.key;
      const isNavigationLocked = pendingKey !== null && pendingKey !== item.key;

      return (
        <li key={item.href}>
          {item.key === "quote" ? (
            <button
              type="button"
              aria-current={isActive ? "page" : undefined}
              aria-disabled={isNavigationLocked}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[clamp(14px,3.5vw,16px)] font-semibold leading-tight transition-colors duration-150 ${
                isActive
                  ? "border border-[rgba(184,150,46,0.65)] bg-gradient-to-r from-[#1B2431] to-[#162133] text-site-primary"
                  : "border border-white/8 bg-transparent text-site-secondary hover:bg-white/4 hover:border-white/20"
              } ${isNavigationLocked ? "pointer-events-none opacity-50" : ""}`}
              onPointerDown={() => setPressedKey(item.key)}
              onPointerCancel={() => setPressedKey(null)}
              onPointerUp={() => setPressedKey(null)}
              onClick={() => {
                if (pendingKey) return;
                handleQuoteConsult();
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    isActive
                      ? "border-[rgba(184,150,46,0.7)] bg-[#162133]"
                      : "border-white/10 bg-[#111C2D]"
                  }`}
                >
                  <item.icon className="h-4 w-4 text-[#B8962E]" aria-hidden="true" />
                </span>
                <span>{item.label}</span>
              </span>
              {isPressed ? (
                <span className="h-2 w-2 rounded-full bg-[rgba(184,150,46,0.9)]" />
              ) : null}
            </button>
          ) : (
            <Link
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              aria-disabled={isNavigationLocked}
              className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-[clamp(14px,3.5vw,16px)] font-semibold leading-tight transition-colors duration-150 ${
                isActive
                  ? "border border-[rgba(184,150,46,0.65)] bg-gradient-to-r from-[#1B2431] to-[#162133] text-site-primary"
                  : "border border-white/8 bg-transparent text-site-secondary hover:bg-white/4 hover:border-white/20"
              } ${isNavigationLocked ? "pointer-events-none opacity-50" : ""}`}
              onPointerDown={() => setPressedKey(item.key)}
              onPointerCancel={() => setPressedKey(null)}
              onPointerUp={() => setPressedKey(null)}
              onClick={() => {
                if (pendingKey) return;
                triggerHapticFeedback();
                setPendingKey(item.key);
              }}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                    isActive
                      ? "border-[rgba(184,150,46,0.7)] bg-[#162133]"
                      : "border-white/10 bg-[#111C2D]"
                  }`}
                >
                  <item.icon className="h-4 w-4 text-[#B8962E]" aria-hidden="true" />
                </span>
                <span>{item.label}</span>
              </span>
              {isPending ? (
                <span className="text-[11px] font-semibold text-[rgba(184,150,46,0.9)]">
                  이동중...
                </span>
              ) : isPressed ? (
                <span className="h-2 w-2 rounded-full bg-[rgba(184,150,46,0.9)]" />
              ) : null}
            </Link>
          )}
        </li>
      );
    })}
  </ul>
  <div className="mt-2 border-t border-white/10 pt-2">
    {isLoggedIn ? (
      <button
        type="button"
        onClick={handleLogout}
        disabled={isLoggingOut}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-[rgba(184,150,46,0.5)] bg-[#162133] px-3 py-2.5 text-[clamp(14px,3.5vw,16px)] font-semibold text-[#B8962E] transition-colors duration-150 hover:bg-[rgba(184,150,46,0.12)] hover:border-[rgba(184,150,46,0.7)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        <span>{isLoggingOut ? "로그아웃 중..." : "로그아웃"}</span>
      </button>
    ) : (
      <Link
        href="/login"
        className="flex items-center justify-center gap-2 rounded-xl border border-[rgba(184,150,46,0.5)] bg-[#162133] px-3 py-2.5 text-[clamp(14px,3.5vw,16px)] font-semibold text-[#B8962E] transition-colors duration-150 hover:bg-[rgba(184,150,46,0.12)] hover:border-[rgba(184,150,46,0.7)]"
        onClick={() => triggerHapticFeedback()}
      >
        <LogIn className="h-4 w-4" aria-hidden="true" />
        <span>로그인</span>
      </Link>
    )}
  </div>
</div>
```

---

## createPortal 전체 (포지션 래퍼 포함)

```jsx
createPortal(
  <div className="fixed right-[max(12px,calc(env(safe-area-inset-right)+8px))] top-[max(64px,calc(env(safe-area-inset-top)+64px))] z-50 flex flex-col items-end lg:hidden">
    {isOpen ? (
      // ← 위 "드로어 컨테이너 + 메뉴 리스트 + 로그인/로그아웃 영역" 블록 전체
    ) : null}
  </div>,
  document.body,
);
```

---

## 참고: 사용 변수/핸들러

- `menuItems`: `{ href, label, key, icon }[]` (회사소개, 견적문의, 여행후기, 여행가이드, 고객센터, 패키지상품)
- `pathname`, `activeTab`, `isLoggedIn`
- `pendingKey`, `setPendingKey`, `pressedKey`, `setPressedKey`
- `handleQuoteConsult`, `handleLogout`, `triggerHapticFeedback`
- 아이콘: `lucide-react` — `Info`, `FileText`, `Map`, `LifeBuoy`, `PackageSearch`, `Star`, `LogIn`, `LogOut`
