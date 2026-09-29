// Ordered worker pool for the browser gates (ADR-0263, after ADR-0261).
//
// A browser gate measures many independent (page, viewport) units one after the other. The
// pool runs them on JOBS workers and hands the results back IN THE ORIGINAL ORDER, so the
// gate's output — every verdict line — is the same as the serial run's.
//
// What a unit prints while it runs goes through `out()` / `err()`: inside a pool unit the line
// is buffered with that unit (AsyncLocalStorage follows every await of the unit), and the gate
// replays it in order with `replay()`. Outside a unit the line is printed at once, so the same
// code runs serially (CIT_GATE_JOBS=1) or at top level unchanged.
//
// ⛔ A unit that threw has NO result — `settled.ok === false` — and the gate must treat it as a
// failure, never as a green (a measurement that did not happen proves nothing).
//
//   CIT_GATE_JOBS=<n>        workers per gate (default 4; 1 = the old serial behaviour)
//   CIT_GATE_POOL_TIMES=<f>  append one JSON line per pool (wall ms + every unit's ms) — where the time goes
//   CIT_GATE_HEARTBEAT=<f>   set by scripts/lib/gate-runner.mjs: touched after every FINISHED unit, so the
//                            runner's silence limit (ADR-XXXX) sees progress although the buffered output
//                            appears only at replay. It never changes the gate's output (verdict lines
//                            are the contract); a unit that never finishes never beats.

import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync, closeSync, openSync, utimesSync } from "node:fs";
import path from "node:path";

export type Line = { stream: "out" | "err"; text: string };
export type Settled<R> = { ok: true; value: R; lines: Line[] } | { ok: false; error: unknown; lines: Line[] };

const sink = new AsyncLocalStorage<Line[]>();

/** Progress signal for the gate runner's silence limit — a touch, no output. */
function heartbeat(): void {
  const f = process.env.CIT_GATE_HEARTBEAT;
  if (!f) return;
  try {
    const now = new Date();
    try {
      utimesSync(f, now, now);
    } catch {
      closeSync(openSync(f, "a"));
    }
  } catch {
    // A missed beat only risks a (loud) silence stop, never a wrong verdict.
  }
}

/** Workers per gate: CIT_GATE_JOBS, default 4, never below 1. */
export function gateJobs(): number {
  return Math.max(1, Math.floor(Number(process.env.CIT_GATE_JOBS)) || 4);
}

/** console.log — buffered with the running pool unit, printed at once outside one. */
export function out(text: string): void {
  const buf = sink.getStore();
  if (buf) buf.push({ stream: "out", text });
  else console.log(text);
}

/** console.error — buffered with the running pool unit, printed at once outside one. */
export function err(text: string): void {
  const buf = sink.getStore();
  if (buf) buf.push({ stream: "err", text });
  else console.error(text);
}

/** Print a unit's buffered lines, in the order it produced them. */
export function replay(lines: Line[]): void {
  for (const l of lines) (l.stream === "err" ? console.error : console.log)(l.text);
}

/**
 * Run `fn` over `items` on `jobs` workers; the result array is in the ORIGINAL item order.
 * `worker` (0 … jobs-1) lets a gate keep per-worker state (e.g. its own reused page).
 * Every item gets exactly one Settled entry — a missing one is impossible by construction
 * (the array is pre-filled with a "did not run" failure that only a finished unit replaces).
 */
export async function pool<T, R>(
  items: readonly T[],
  fn: (item: T, index: number, worker: number) => Promise<R>,
  jobs: number = gateJobs(),
): Promise<Settled<R>[]> {
  const results: Settled<R>[] = items.map(() => ({
    ok: false as const,
    error: new Error("a mérés nem futott le (nincs eredmény)"),
    lines: [],
  }));
  let next = 0;
  const ms: number[] = items.map(() => -1);
  const t0 = performance.now();
  async function worker(w: number): Promise<void> {
    while (next < items.length) {
      const i = next++;
      const lines: Line[] = [];
      const u0 = performance.now();
      try {
        const value = await sink.run(lines, () => fn(items[i]!, i, w));
        results[i] = { ok: true, value, lines };
      } catch (error) {
        results[i] = { ok: false, error, lines };
      }
      ms[i] = Math.round(performance.now() - u0);
      heartbeat();
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, jobs), items.length) }, (_, w) => worker(w)));
  const timesFile = process.env.CIT_GATE_POOL_TIMES;
  if (timesFile) {
    appendFileSync(
      timesFile,
      JSON.stringify({ script: path.basename(process.argv[1] ?? "?"), args: process.argv.slice(2), jobs, wallMs: Math.round(performance.now() - t0), unitMs: ms }) + "\n",
    );
  }
  return results;
}
