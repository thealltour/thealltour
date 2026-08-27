/**
 * Mutable runtime env overlay for values filled after process start
 * (e.g. HERMES_HOME/.env). Next.js may ignore dynamic process.env writes
 * for keys not present in .env* at boot — reads must consult this store.
 * Never log secret values from this module.
 */

const overlay = new Map<string, string>();

export function resetRuntimeEnvOverlayForTests(): void {
  overlay.clear();
}

export function setRuntimeEnvOverlayValue(key: string, value: string): void {
  overlay.set(key, value);
}

/** Best-effort write to process.env + overlay. Overlay is source of truth for fills. */
export function fillRuntimeEnvIfMissing(key: string, value: string): void {
  const existing = readRuntimeEnvValue(key);
  if (existing?.trim()) return;
  overlay.set(key, value);
  try {
    if (!process.env[key]?.trim()) {
      process.env[key] = value;
    }
  } catch {
    // Next may freeze or proxy process.env — overlay still holds the value.
  }
}

export function readRuntimeEnvValue(key: string): string | undefined {
  const fromOverlay = overlay.get(key);
  if (fromOverlay !== undefined) return fromOverlay;
  try {
    return process.env[key];
  } catch {
    return undefined;
  }
}

export function isRuntimeEnvValuePresent(key: string): boolean {
  return Boolean(readRuntimeEnvValue(key)?.trim());
}

/**
 * Snapshot for credential/status readers. Overlay wins over process.env.
 * Does not include secret material beyond whatever is already in env/overlay.
 */
export function getRuntimeEnvBag(): Record<string, string | undefined> {
  const bag: Record<string, string | undefined> = {};
  try {
    for (const key of Object.keys(process.env)) {
      bag[key] = process.env[key];
    }
  } catch {
    // ignore
  }
  for (const [key, value] of overlay) {
    bag[key] = value;
  }
  return bag;
}
