#!/usr/bin/env node
/**
 * Hermes-Pi private Marketing Asset Transfer API (SV-8B2).
 *
 * Tailscale / loopback machine-to-machine only. Not a browser API.
 * Does NOT install/start systemd. Do not bind publicly without explicit config.
 *
 *   npm run marketing:asset-transfer
 */
import { createServer } from "node:http";
import { createRequire } from "node:module";

import { loadLocalEnv } from "./loadLocalEnv";

const require = createRequire(import.meta.url);
const Module = require("module") as {
  _resolveFilename: (request: string, parent: unknown, isMain: boolean, options?: unknown) => string;
};
const originalResolve = Module._resolveFilename.bind(Module);
const serverOnlyStub = require.resolve("./shims/server-only.js");
Module._resolveFilename = function resolveFilename(
  request: string,
  parent: unknown,
  isMain: boolean,
  options?: unknown,
) {
  if (request === "server-only") return serverOnlyStub;
  return originalResolve(request, parent, isMain, options);
};

loadLocalEnv();

async function main() {
  const { resolveMarketingAssetTransferListenConfig } = await import(
    "@/lib/marketing/assets/transport/server/config"
  );
  const { handleMarketingAssetTransferRequest } = await import(
    "@/lib/marketing/assets/transport/server/handler"
  );
  const { createMarketingMediaSourceCatalogRepository } = await import(
    "@/lib/marketing/assets/sourceCatalog/createSourceCatalogRepository"
  );
  const { readMarketingAssetTransferToken } = await import(
    "@/lib/marketing/assets/transport/server/auth"
  );

  if (!readMarketingAssetTransferToken(process.env)) {
    console.error("MARKETING_ASSET_TRANSFER_TOKEN is required");
    process.exit(1);
  }

  const listen = resolveMarketingAssetTransferListenConfig(process.env);
  const catalog = await createMarketingMediaSourceCatalogRepository({});

  const server = createServer((req, res) => {
    void handleMarketingAssetTransferRequest(req, res, {
      catalog,
      env: process.env,
      serviceVersion: "sv8b2",
    });
  });

  server.listen(listen.port, listen.host, () => {
    console.log(
      JSON.stringify({
        service: "marketing-asset-transfer",
        listening: `${listen.host}:${listen.port}`,
        note: "private Tailscale/loopback; no CORS; bearer auth required except /health",
      }),
    );
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`marketing asset transfer server failed: ${message}`);
  process.exit(1);
});
