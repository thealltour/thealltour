"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import AuthModal from "@/components/auth/AuthModal";
import type { SocialProviderOption } from "@/components/auth/SocialLoginButtons";
import { sanitizeNextPath } from "@/lib/auth/redirect";

export type AuthModalMode = "login" | "signup";

type OpenAuthOptions = {
  mode?: AuthModalMode;
  next?: string;
  error?: string | null;
};

type AuthModalContextValue = {
  isOpen: boolean;
  openAuth: (options?: OpenAuthOptions) => void;
  closeAuth: () => void;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    return {
      isOpen: false,
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
  const [nextPath, setNextPath] = useState("/");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const openAuth = useCallback(
    (options?: OpenAuthOptions) => {
      const resolvedNext = sanitizeNextPath(options?.next ?? pathname ?? "/");
      setNextPath(resolvedNext);
      setErrorCode(options?.error ?? null);
      setIsOpen(true);
    },
    [pathname],
  );

  const closeAuth = useCallback(() => {
    setIsOpen(false);
    setErrorCode(null);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      openAuth,
      closeAuth,
    }),
    [isOpen, openAuth, closeAuth],
  );

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal
        isOpen={isOpen}
        onClose={closeAuth}
        nextPath={nextPath}
        errorCode={errorCode}
        socialProviders={socialProviders}
      />
    </AuthModalContext.Provider>
  );
}
