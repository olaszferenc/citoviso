// The .hu confirmation relay to Neo (ADR-0401) — the dev-box runner of src/domains/cfmRelay.ts.
// Cron, every 2 minutes, from the main tree:
//   */2 * * * * cd /home/citoviso/citoviso && npx tsx scripts/cfm-relay.mts >> ~/.claude/cfm-relay.log 2>&1
// State: ~/.citoviso/cfm-relay.json · owner phone: ~/.config/citoviso/cfm-relay.json {"ownerPhone"}.
// Neo's hand-off: ~/neo/beerkezo/cfm-<domain>-<token8>.md + a prompt typed into his RC tmux.
// Neo's answer: ~/neo/jelentesek/cfm-<token8>.result (first line SIKER or NEM SIKER).

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { scanMailbox } from "../src/domains/registryConfirmWatch.js";
import { FALLBACK_MINUTES, runRelay, type RelayEntry, type RelayState } from "../src/domains/cfmRelay.js";
import { sendOperatorSms } from "../src/console/operatorSms.js";
import { smsQuietHours } from "../src/console/smsQuietHours.js";

const HOME = process.env.HOME ?? "/home/citoviso";
const STATE = `${HOME}/.citoviso/cfm-relay.json`;
const CONF = `${HOME}/.config/citoviso/cfm-relay.json`;
const INBOX = `${HOME}/neo/beerkezo`;
const RESULTS = `${HOME}/neo/jelentesek`;
const WATCHDOG = `${HOME}/.claude/rc-watchdog-state.json`;

function load<T>(p: string, empty: T): T {
  try {
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return empty;
  }
}

/** Neo's live RC session → its tmux name (rc-<sid8>), from the watchdog's state. */
function neoTmux(): string | null {
  const s = load<Record<string, unknown>>(WATCHDOG, {});
  const sessions = (s.sessions ?? s) as Record<string, { title?: string; good_title?: string; retired?: boolean }>;
  for (const [sid, v] of Object.entries(sessions)) {
    const t = `${v?.good_title ?? ""} ${v?.title ?? ""}`;
    if (v && !v.retired && /Neo az Inas/.test(t)) {
      const name = `rc-${sid.slice(0, 8)}`;
      try {
        execFileSync("tmux", ["has-session", "-t", name], { stdio: "ignore" });
        return name;
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function handToNeo(token: string, e: RelayEntry): Promise<boolean> {
  const t8 = token.slice(0, 8);
  const resultFile = `${RESULTS}/cfm-${t8}.result`;
  mkdirSync(INBOX, { recursive: true });
  const taskFile = `${INBOX}/cfm-${e.domain}-${t8}.md`;
  writeFileSync(
    taskFile,
    `# .hu megerősítés — ${e.domain}\n\n` +
      `Állandó feladat (ADR-0401, tulaj 2026-10-22). A link a kódot is előtölti:\n${e.link}\n\n` +
      `1. Tiszta fülön nyisd meg; kép: ${RESULTS}/cfm-${e.domain}-<HHMM>-1.png\n` +
      `2. Ellenőrizd: a domain ${e.domain}, a regisztráló Olasz Ferenc.\n` +
      `3. Kód (ha nincs előtöltve: a link ?code= részében a vessző utáni érték), a 2 checkbox, EGYSZER „Megerősítés”. „Elutasítás” SOHA.\n` +
      `4. Csak a „Sikeres beküldés” szöveg = SIKER; kép: …-2.png\n` +
      `5. Írd ide az eredményt: ${resultFile} — első sor SIKER vagy NEM SIKER, utána az oldal szövege.\n` +
      `Ha ${FALLBACK_MINUTES} percen belül nincs SIKER, a tulaj SMS-t kap a linkkel.\n`,
  );
  const tmux = neoTmux();
  if (!tmux) return false;
  const prompt = `Domain-relé: új .hu megerősítés (${e.domain}). A feladat: ${taskFile} — olvasd el és hajtsd végre, az eredményt a ${resultFile} fájlba írd.`;
  execFileSync("tmux", ["send-keys", "-t", tmux, "-l", prompt]);
  execFileSync("tmux", ["send-keys", "-t", tmux, "Enter"]);
  return true;
}

function readResult(token: string): "SIKER" | "NEM SIKER" | null {
  const f = `${RESULTS}/cfm-${token.slice(0, 8)}.result`;
  if (!existsSync(f)) return null;
  const first = readFileSync(f, "utf8").split("\n")[0].trim().toUpperCase();
  if (first.startsWith("NEM SIKER")) return "NEM SIKER";
  if (first.startsWith("SIKER")) return "SIKER";
  return null;
}

async function smsOwner(text: string): Promise<boolean> {
  const phone = load<{ ownerPhone?: string }>(CONF, {}).ownerPhone;
  if (!phone) {
    console.error(`[cfm-relay] nincs ownerPhone a ${CONF}-ban — a tartalék SMS NEM ment ki.`);
    return false;
  }
  // Quiet hours: NOT handed to the night digest (that flushes on prod, from prod's own ledger) —
  // the relay keeps the case open and sends it on the first run after the window.
  if (smsQuietHours(new Date())) return false;
  await sendOperatorSms({ tag: "registry-confirm", to: phone, text });
  return true;
}

const state = load<RelayState>(STATE, {});
const { links } = await scanMailbox();
const log = await runRelay(links, state, { now: () => new Date(), handToNeo, readResult, smsOwner });
mkdirSync(dirname(STATE), { recursive: true });
writeFileSync(STATE, JSON.stringify(state, null, 2));
const stamp = new Date().toISOString();
for (const l of log) console.log(`${stamp} ${l}`);
process.exit(0);
