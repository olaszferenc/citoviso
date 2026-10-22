// THE .hu CONFIRMATION RELAY to Neo (ADR-0401, owner 2026-10-22: „odaadnám valamelyik virtuális
// kollégának", „ok indulhat Neo", „hát nem ez a dolga????").
//
// Runs on the DEV box (where Neo's session and Chrome live), every 2 minutes from cron:
//   ① a NEW cfm.drr.hu link in the mailbox → handed to Neo: a task file in ~/neo/beerkezo and a
//      prompt typed into his RC session. Neo opens it in his own Chrome, enters the e-mailed code
//      (the link's `?code=` pre-fills it), ticks the two boxes, presses „Megerősítés" ONCE, and
//      reports by writing the result file — first line SIKER or NEM SIKER.
//   ② no SIKER within FALLBACK_MINUTES (or NEM SIKER) → ONE SMS to the owner with the link: the
//      owner is the backstop, never the first hand. Quiet hours hold the SMS until morning.
//
// The prod watcher (registryConfirmWatch.ts) only MAILS the owner on a new link ("Neo intézi") —
// this relay owns the hand-off and the fallback. The decision is a pure function with the
// effects injected, so the guard measures it without a mailbox, a tmux or a real SMS.

import type { Finding } from "./registryConfirmWatch.js";

export const FALLBACK_MINUTES = 30;
/** A link older than this at first sight is not handed on (the registry gives 30 days; a week is plenty). */
export const RELAY_FRESH_HOURS = 24 * 7;

export interface RelayEntry {
  readonly link: string;
  readonly domain: string;
  readonly mailAt: string;
  /** null = seeded on the first run (old link, never handed on). */
  readonly handedAt: string | null;
  readonly result?: "SIKER" | "NEM SIKER";
  readonly fallbackAt?: string;
}
export type RelayState = Record<string, RelayEntry>;

export interface RelayDeps {
  now(): Date;
  /** Hand the task to Neo; false = Neo could not be reached (no live session). */
  handToNeo(token: string, e: RelayEntry): Promise<boolean>;
  /** Neo's verdict from his result file, or null while he has not written one. */
  readResult(token: string): "SIKER" | "NEM SIKER" | null;
  /** The owner fallback SMS; false = not sent now (quiet hours / no phone) — retried next run. */
  smsOwner(text: string): Promise<boolean>;
}

/** Prefer the Hungarian link that carries the code — it opens the form pre-filled. */
function pickLinks(found: readonly Finding[]): Map<string, Finding> {
  const best = new Map<string, Finding>();
  for (const f of found) {
    const cur = best.get(f.token);
    const score = (x: Finding): number => (x.link.includes("?code=") ? 2 : 0) + (x.link.includes("/hu/") ? 1 : 0);
    if (!cur || score(f) > score(cur) || (!cur.domain && f.domain)) best.set(f.token, { ...f, domain: f.domain ?? cur?.domain });
  }
  return best;
}

function mailTime(mailAt: string, fallback: Date): Date {
  const d = new Date(mailAt.replace(/^(\d{1,2})-([A-Za-z]{3})-(\d{4}) /, "$1 $2 $3 "));
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function runRelay(found: readonly Finding[], state: RelayState, deps: RelayDeps): Promise<string[]> {
  const now = deps.now();
  const log: string[] = [];
  const firstRun = Object.keys(state).length === 0;

  for (const [token, f] of pickLinks(found)) {
    if (state[token]) continue;
    const domain = f.domain ?? "?";
    const old = now.getTime() - mailTime(f.mailAt, now).getTime() > RELAY_FRESH_HOURS * 3600_000;
    if (firstRun || old) {
      state[token] = { link: f.link, domain, mailAt: f.mailAt, handedAt: null };
      log.push(`[cfm-relay] ${domain}: bejegyezve átadás nélkül (${firstRun ? "első futás" : "régi link"}).`);
      continue;
    }
    const entry: RelayEntry = { link: f.link, domain, mailAt: f.mailAt, handedAt: now.toISOString() };
    const ok = await deps.handToNeo(token, entry);
    state[token] = entry;
    log.push(ok ? `[cfm-relay] ${domain}: átadva Neónak.` : `[cfm-relay] ${domain}: Neo NEM érhető el — a tartalék SMS azonnal jár.`);
    if (!ok) state[token] = { ...entry, handedAt: new Date(0).toISOString() };
  }

  for (const [token, e] of Object.entries(state)) {
    if (!e.handedAt || e.result === "SIKER" || e.fallbackAt) continue;
    const r = deps.readResult(token);
    if (r && r !== e.result) {
      state[token] = { ...e, result: r };
      log.push(`[cfm-relay] ${e.domain}: Neo jelentése: ${r}.`);
      if (r === "SIKER") continue;
    }
    const late = now.getTime() - new Date(e.handedAt).getTime() >= FALLBACK_MINUTES * 60_000;
    if (r !== "NEM SIKER" && !late) continue;
    const why = r === "NEM SIKER" ? "Neo nem tudta megerositeni" : `Neo ${FALLBACK_MINUTES} perc alatt nem erositette meg`;
    // Operator SMS (ASCII, GSM-7) — outside the §B.18 customer-facing i18n scope.
    const sent = await deps.smsOwner(`Citoviso: .hu megerosites (${e.domain}): ${why}. Kattints te: ${e.link}`);
    if (sent) {
      state[token] = { ...state[token], fallbackAt: now.toISOString() };
      log.push(`[cfm-relay] ${e.domain}: tartalék SMS a tulajnak (${why}).`);
    }
  }
  return log;
}
