// Multi-template generation batch, STAGGERED so the batch shares one prompt cache (2026-10-05).
//
// WHY: the console used to start every picked template at once. Each one then wrote the
// SAME cache prefixes (fixed system prompts + the lead's source block / photos in the
// guards) in parallel, none of them could read another's — a cache entry is only readable
// once the call that writes it has started answering. Measured on 2026-10-04: a mock run
// right after another one of the same lead cost $0.27 instead of $0.41 (-35%), the parallel
// batch got none of it. So the FIRST template runs alone until its cache writers are done
// (the owner ruling: "wait for the first cache-writing call"), then the rest start together.
//
// The gate never blocks the batch: it opens on the leader's signal, on the leader settling
// (success OR failure — a failed leader must not sink the rest) or after `maxWaitMs`.

/** Upper bound on how long the followers wait for the leader's signal. */
export const STAGGER_MAX_WAIT_MS = 180_000;

/**
 * Run `count` jobs: job 0 first, the rest once job 0 calls `warm()` (or settles, or the
 * wait times out). Results come back in job order, allSettled-style.
 */
export async function runStaggered<T>(
  count: number,
  start: (index: number, warm: () => void) => Promise<T>,
  maxWaitMs: number = STAGGER_MAX_WAIT_MS,
): Promise<PromiseSettledResult<T>[]> {
  if (count <= 0) return [];
  let open!: () => void;
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const timer = setTimeout(open, maxWaitMs);
  const leader = Promise.resolve()
    .then(() => start(0, open))
    .finally(() => open());
  // A rejected leader is collected by allSettled below — but only AFTER the gate; mark it
  // handled now, or Node's unhandled-rejection default would take the process down.
  leader.catch(() => {});
  await gate;
  clearTimeout(timer);
  const followers = Array.from({ length: count - 1 }, (_, i) =>
    Promise.resolve().then(() => start(i + 1, () => {})),
  );
  return Promise.allSettled([leader, ...followers]);
}
