/**
 * Marketing Hermes Agent Runtime Contract (Phase 1).
 *
 * Scope: profile identity, model alias/provider documentation, launcher timeout,
 * credential injection policy, and transport-level retry ownership.
 *
 * Explicitly NOT runtime-enforced here (domain / later phases):
 * - artifact fingerprint / stale lifecycle
 * - authority owns/reads/mustNotOwn
 * - materialize / editorial repair semantics
 * - SOUL content
 *
 * Optional `docs` is human/metadata only — the launcher must not interpret it.
 */

export type MarketingHermesAgentKind =
  | "department"
  | "specialist"
  | "legacy_channel_editor";

export type MarketingHermesInferenceGatewayCredentialMode =
  | "launcher_inject"
  | "profile_env_legacy";

export type MarketingHermesRuntimeContract = {
  profileId: string;
  kind: MarketingHermesAgentKind;
  runtime: {
    /** Must match `model.default` in ~/.hermes/profiles/<id>/config.yaml */
    modelAlias: string;
    /** Must match `model.provider` in the profile config.yaml */
    provider: string;
    /** Default oneshot timeout when callers do not override */
    timeoutMs: number;
  };
  credentials: {
    /**
     * How the inference gateway token is expected to reach the Hermes child.
     *
     * - `launcher_inject`: child gets `AI_RUNTIME_INFERENCE_GATEWAY_TOKEN` from the
     *   unified launcher (required for named `-p` profiles — they do NOT inherit
     *   parent `~/.hermes/.env`).
     * - `profile_env_legacy`: department bots that still keep a profile-local `.env`
     *   copy; launcher still injects when it can resolve a token (belt-and-suspenders).
     */
    inferenceGateway: MarketingHermesInferenceGatewayCredentialMode;
  };
  failurePolicy: {
    /**
     * Transport-level attempts (initial + retries) when the caller opts into
     * transport retry. Owned solely by the unified launcher retry path —
     * do not wrap that path in a second retry loop (avoids multiplicative retries).
     * Domain JSON/materialize repair is separate and must not multiply this.
     */
    transportRetries: number;
  };
  /**
   * Documentation / migration metadata only. Ignored by the launcher.
   */
  docs?: {
    /** e.g. Layout Director exists but production render is deterministic. */
    productionNote?: string;
  };
};
