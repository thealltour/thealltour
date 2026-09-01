#!/usr/bin/env node
/**
 * Mint a local-only admin session for STEP 3-8 verification when bootstrap
 * ADMIN_ID/ADMIN_PASSWORD are not configured. Uses the same JWT + admin_sessions
 * path as /api/admin/login.
 */
import { createRequire } from "node:module";

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

import { loadLocalEnv } from "./loadLocalEnv";
loadLocalEnv();

import { ADMIN_AUTH_COOKIE } from "../src/lib/adminAuth";
import { createAdminSessionWithToken } from "../src/lib/adminSessionStore";
import type { AdminSessionPayload } from "../src/lib/adminSession";

export async function mintVerificationAdminSession(
  profile: "bootstrap" | "manager",
): Promise<{ cookieHeader: string; session: AdminSessionPayload }> {
  const session: AdminSessionPayload =
    profile === "bootstrap"
      ? {
          role: "admin",
          permissions: ["*"],
          isBootstrapAdmin: true,
          username: "step-3-8-verification",
        }
      : {
          role: "manager",
          permissions: [
            "dashboard.view",
            "inquiries.manage",
            "products.manage",
            "tools.view",
          ],
          isBootstrapAdmin: false,
          username: "step-3-8-verification-manager",
        };

  const { token } = await createAdminSessionWithToken(session, {
    userAgent: "step-3-8-verification-probe",
  });

  return {
    cookieHeader: `${ADMIN_AUTH_COOKIE}=${token}`,
    session,
  };
}
