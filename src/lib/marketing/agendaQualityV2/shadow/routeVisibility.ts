/**
 * Configured vs available route visibility for marketing_agenda_transformer.
 * Never logs secret values.
 */

import {
  getGeminiCredentialPresence,
  getNvidiaCredentialPresence,
  getOpenRouterCredentialPresence,
} from "@/ai-runtime/adapters/env-credential-resolver";
import { AI_MODEL_IDS } from "@/ai-runtime/registry/models";
import { ROLE_MODEL_ROUTES } from "@/ai-runtime/router/role-routes";
import { getRuntimeEnvBag } from "@/lib/runtimeEnvStore";

export type AgendaTransformerProviderAvailability = {
  provider: "gemini-main" | "openrouter" | "nvidia" | "gemini-secondary";
  modelId: string;
  credentialPresentInProcessEnv: boolean;
  routeUsable: boolean;
};

export type AgendaTransformerRouteVisibility = {
  configuredRoute: string[];
  availableRoute: string[];
  providers: AgendaTransformerProviderAvailability[];
};

export function resolveAgendaTransformerRouteVisibility(
  env: Record<string, string | undefined> = getRuntimeEnvBag(),
): AgendaTransformerRouteVisibility {
  const configuredRoute = [...ROLE_MODEL_ROUTES.marketing_agenda_transformer];
  const gemini = getGeminiCredentialPresence(env);
  const openrouter = getOpenRouterCredentialPresence(env);
  const nvidia = getNvidiaCredentialPresence(env);

  const providers: AgendaTransformerProviderAvailability[] = [
    {
      provider: "gemini-main",
      modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_PRIMARY,
      credentialPresentInProcessEnv: gemini,
      routeUsable: gemini,
    },
    {
      provider: "openrouter",
      modelId: AI_MODEL_IDS.OPENROUTER_FREE,
      credentialPresentInProcessEnv: openrouter,
      routeUsable: openrouter,
    },
    {
      provider: "nvidia",
      modelId: AI_MODEL_IDS.NVIDIA_NEMOTRON_3_ULTRA,
      credentialPresentInProcessEnv: nvidia,
      routeUsable: nvidia,
    },
    {
      provider: "gemini-secondary",
      modelId: AI_MODEL_IDS.GEMINI_FLASH_LITE_SECONDARY,
      credentialPresentInProcessEnv: gemini,
      routeUsable: gemini,
    },
  ];

  const usable = new Set(
    providers.filter((p) => p.routeUsable).map((p) => p.modelId),
  );
  const availableRoute = configuredRoute.filter((id) => usable.has(id));

  return { configuredRoute, availableRoute, providers };
}
