import { AuthModalProvider } from "@/components/auth/AuthModalProvider";
import { getConfiguredOAuthProviders } from "@/lib/auth/providerRegistry";

type AuthProvidersShellProps = {
  children: React.ReactNode;
};

export default function AuthProvidersShell({ children }: AuthProvidersShellProps) {
  const socialProviders = getConfiguredOAuthProviders().map((provider) => ({
    id: provider.id,
    displayName: provider.displayName,
  }));

  return <AuthModalProvider socialProviders={socialProviders}>{children}</AuthModalProvider>;
}
