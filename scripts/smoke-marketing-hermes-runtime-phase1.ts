/**
 * Phase-1 smoke: cleared process TOKEN + launcher inject + gateway auth + specialist oneshot.
 * Does not print secret values.
 */
import { AI_RUNTIME_INFERENCE_GATEWAY_TOKEN_ENV as T } from "@/ai-runtime/integration/constants";
import { resolveHermesExecutable } from "@/lib/marketing/cron/resolveHermesExecutable";
import {
  buildHermesProfileArgv,
  buildHermesProfileSpawnEnv,
  collectMarketingHermesAliasPreflightIssues,
  collectMarketingHermesRegistryDrift,
  invokeMarketingHermesAgent,
  requireMarketingHermesRuntimeContract,
  resolveInferenceGatewayTokenForHermesChild,
} from "@/lib/marketing/hermesRuntime";

async function main(): Promise<void> {
  const saved = process.env[T];
  delete process.env[T];

  const token = resolveInferenceGatewayTokenForHermesChild({});
  const env = buildHermesProfileSpawnEnv({});
  console.log(
    JSON.stringify(
      {
        tokenPresent: Boolean(token),
        childEnvHasToken: Boolean(env[T]),
        hermesHomeSet: Boolean(env.HERMES_HOME),
        argvHasProfileFlag:
          buildHermesProfileArgv("instagram-visual-role-architect", "ping")[0] === "-p",
        hermesBinResolved: Boolean(resolveHermesExecutable(process.env)),
        vraRetries: requireMarketingHermesRuntimeContract("instagram-visual-role-architect")
          .failurePolicy.transportRetries,
        driftCount: collectMarketingHermesRegistryDrift().length,
        aliasIssueCount: collectMarketingHermesAliasPreflightIssues().length,
      },
      null,
      2,
    ),
  );

  if (!token) {
    console.error("gateway token unresolved with process.env cleared");
    process.exit(2);
  }

  const gatewayRes = await fetch("http://127.0.0.1:3000/api/ai-runtime/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "theallcloud/auto",
      messages: [{ role: "user", content: "Reply OK" }],
      max_tokens: 16,
    }),
  });
  const gatewayBody = await gatewayRes.text();
  console.log(
    JSON.stringify(
      {
        gatewayStatus: gatewayRes.status,
        gatewayAuthOk: gatewayRes.status !== 401 && gatewayRes.status !== 403,
        gatewayBodyChars: gatewayBody.length,
      },
      null,
      2,
    ),
  );
  if (gatewayRes.status === 401 || gatewayRes.status === 403) {
    process.exit(2);
  }

  // Cron/queue path: withTransportRetry uses the same inject. Prefer a fast specialist.
  try {
    const out = await invokeMarketingHermesAgent({
      profileId: "threads-copy-writer",
      prompt: "Reply with exactly: SMOKE_OK",
      timeoutMs: 120_000,
      withTransportRetry: true,
      transportMaxAttempts: 1, // smoke: prove inject path, not retry multiplication
      env: {},
    });
    const authFail = /401|unauthorized|TOKEN is not configured/i.test(out);
    console.log(
      JSON.stringify(
        {
          oneshotOk: out.trim().length > 0 && !authFail,
          stdoutChars: out.length,
          looksLikeAuthFail: authFail,
          preview: out.trim().slice(0, 80),
        },
        null,
        2,
      ),
    );
    if (authFail) process.exit(2);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const authFail = /401|unauthorized|TOKEN is not configured/i.test(message);
    console.log(
      JSON.stringify(
        {
          oneshotThrew: true,
          looksLikeAuthFail: authFail,
          messagePreview: message.slice(0, 240),
        },
        null,
        2,
      ),
    );
    // Timeout under load is not an auth failure; credential inject already proven via gateway.
    if (authFail) process.exit(2);
  }

  if (saved === undefined) delete process.env[T];
  else process.env[T] = saved;

  if (collectMarketingHermesRegistryDrift().length > 0) process.exit(3);
  if (collectMarketingHermesAliasPreflightIssues().length > 0) process.exit(4);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
