/**
 * Bounded parallelism for channel composers.
 *
 * Six channels composed strictly one after another put the whole production run
 * behind the slowest Hermes call. Each composer is mostly waiting on the
 * inference gateway rather than burning local CPU, so a small amount of overlap
 * shortens the run without adding load the Pi cannot absorb. The cap stays low
 * on purpose: concurrent Hermes spawns are the one thing that can push this box
 * into swap.
 */

export const PUBLISHABLE_COMPOSER_CONCURRENCY_DEFAULT = 2;

/** Hard ceiling regardless of env — 4 cores shared with the web app. */
export const PUBLISHABLE_COMPOSER_CONCURRENCY_MAX = 3;

export function resolvePublishableComposerConcurrency(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): number {
  const raw = Number(env.MARKETING_COMPOSER_CONCURRENCY?.trim() || Number.NaN);
  if (!Number.isFinite(raw)) return PUBLISHABLE_COMPOSER_CONCURRENCY_DEFAULT;
  const value = Math.trunc(raw);
  if (value < 1) return 1;
  return Math.min(value, PUBLISHABLE_COMPOSER_CONCURRENCY_MAX);
}

/**
 * Runs tasks with at most `concurrency` in flight, resolving in input order.
 * A rejection propagates once the already-started tasks settle, so a failing
 * composer never leaves an unhandled rejection behind.
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const limit = Math.max(1, Math.trunc(concurrency));
  const results = new Array<T>(tasks.length);
  let next = 0;
  let firstError: unknown = null;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= tasks.length) return;
      try {
        results[index] = await tasks[index]!();
      } catch (error) {
        firstError ??= error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()));
  if (firstError) throw firstError;
  return results;
}
