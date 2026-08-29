"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import AuthModal from "@/components/auth/AuthModal";
import type { SocialProviderOption } from "@/components/auth/SocialLoginButtons";
import { sanitizeNextPath } from "@/lib/auth/redirect";
import { trackAuthModalOpen } from "@/lib/analytics/trackAuthEvents";

export type AuthModalMode = "login" | "signup";

type OpenAuthOptions = {
  mode?: AuthModalMode;
  next?: string;
  error?: string | null;
};

type AuthModalContextValue = {
  isOpen: boolean;
  mode: AuthModalMode;
  openAuth: (options?: OpenAuthOptions) => void;
  closeAuth: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    return {
      isOpen: false,
      mode: "login" as AuthModalMode,
      openAuth: () => {},
      closeAuth: () => {},
    };
  }
  return ctx;
}

type AuthModalProviderProps = {
  children: ReactNode;
  socialProviders: SocialProviderOption[];
};

export function AuthModalProvider({ children, socialProviders }: AuthModalProviderProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthModalMode>("login");
  const [nextPath, setNextPath] = useState("/");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const trackedOpenRef = useRef(false);

  const openAuth = useCallback(
    (options?: OpenAuthOptions) => {
      const resolvedNext = sanitizeNextPath(options?.next ?? pathname ?? "/");
      const nextMode = options?.mode ?? "login";
      setNextPath(resolvedNext);
      setMode(nextMode);
      setErrorCode(options?.error ?? null);
      setIsOpen(true);
      trackedOpenRef.current = false;
    },
    [pathname],
  );

  const closeAuth = useCallback(() => {
    setIsOpen(false);
    setErrorCode(null);
  }, []);

  useEffect(() => {
    if (!isOpen || trackedOpenRef.current) return;
    trackedOpenRef.current = true;
    trackAuthModalOpen({ mode, nextPath });
  }, [isOpen, mode, nextPath]);

  const value = useMemo(
    () => ({
      isOpen,
      mode,
      openAuth,
      closeAuth,
    }),
    [isOpen, mode, openAuth, closeAuth],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal
        isOpen={isOpen}
        onClose={closeAuth}
        mode={mode}
        onModeChange={setMode}
        nextPath={nextPath}
        errorCode={errorCode}
        socialProviders={socialProviders}
      />
    </AuthModalContext.Provider>
  );
}
