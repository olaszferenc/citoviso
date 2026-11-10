// Messenger watcher (ADR-0430 F2) — DEBIAN BOX, the Galaxy S10. The twin of the MMS relay
// for what happens AFTER a Viber / WhatsApp outreach:
//   ① asks the queue's host which chats are due for a re-read (POST /api/messenger/watch);
//   ② reads each chat on the phone WITHOUT typing (s10_send.py status): our message's receipt
//      (WhatsApp "Kézbesítve"/"Megnézve", Viber grey/cyan double tick), the lead's last-seen line,
//      the incoming bubbles' texts;
//   ③ types the operator's queued answers into their chats (s10_send.py send --channel … --text);
//   ⑤ reads the Viber / WhatsApp presence of numbers waiting for approval (no message);
//   ④ reports everything back (POST /api/messenger/report): receipts land on mms_outbox, incoming
//      texts join the reply flow (ADR-0339), a restricted account trips the brake.
// The phone's screen is shared: every s10_send.py call takes ~/.cache/s10-ui.lock and refuses
// to touch the screen during a call (citoviso-callbot owns calls).
//
// Runs from the MAIN tree via citoviso-messenger-watch.timer (every 10 minutes). Env: the MMS
// relay's SMS_RELAY_URL / SMS_RELAY_SECRET; unset → exits quietly.
//
//   tsx scripts/messenger-watch.mts [--dry-run]

import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { config } from "../src/config.js";
import type { AnswerReport, ChatReport, WatchList } from "../src/mms/messenger.js";

const execFileP = promisify(execFile);
const BASE = (process.env.SMS_RELAY_URL ?? "").replace(/\/$/, "");
const SECRET = config.smsRelaySecret;
const DRY = process.argv.includes("--dry-run");
const SCRIPT = path.resolve(process.cwd(), "scripts", "s10-a11y", "s10_send.py");

if (!BASE || !SECRET) {
  console.log("[messenger-watch] SMS_RELAY_URL / SMS_RELAY_SECRET nincs beállítva — nincs teendő.");
  process.exit(0);
}

async function api(pathname: string, body: unknown): Promise<Record<string, unknown>> {
  const resp = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`${pathname} → HTTP ${resp.status}`);
  return (await resp.json()) as Record<string, unknown>;
}

/** One s10_send.py run → its JSON line (exit 1 still prints one). */
async function s10(args: string[]): Promise<Record<string, unknown>> {
  try {
    const { stdout } = await execFileP("python3", [SCRIPT, ...args], { timeout: 120_000 });
    return JSON.parse(stdout.trim().split("\n").pop() ?? "{}") as Record<string, unknown>;
  } catch (err) {
    const out = (err as { stdout?: string }).stdout ?? "";
    try {
      return JSON.parse(out.trim().split("\n").pop() ?? "") as Record<string, unknown>;
    } catch {
      return { ok: false, error: (err as Error).message.slice(0, 300) };
    }
  }
}

try {
  const list = (await api("/api/messenger/watch", {})) as unknown as WatchList;
  const chats: ChatReport[] = [];
  const answers: AnswerReport[] = [];
  for (const c of list.chats ?? []) {
    const r = await s10(["status", "--to", c.to_phone, "--channel", c.channel]);
    const receipt = r.receipt === "sent" || r.receipt === "delivered" || r.receipt === "read" ? r.receipt : "";
    chats.push({
      id: c.id,
      ok: r.ok === true,
      receipt,
      lastSeen: typeof r.last_seen === "string" ? r.last_seen : undefined,
      incoming: Array.isArray(r.incoming) ? r.incoming.map(String) : [],
      restricted: r.restricted === true,
      error: typeof r.error === "string" ? r.error : undefined,
    });
    console.log(`[messenger-watch] ${c.channel} ${c.to_phone}: ${r.ok ? `${receipt || "?"} · ${(r.incoming as unknown[] | undefined)?.length ?? 0} bejövő` : `HIBA ${r.error}`}`);
  }
  for (const a of list.answers ?? []) {
    if (DRY) {
      console.log(`[messenger-watch] (dry-run) válasz → ${a.channel} ${a.to_phone}: ${a.text.slice(0, 60)}`);
      continue;
    }
    const r = await s10(["send", "--to", a.to_phone, "--channel", a.channel, "--text", a.text]);
    answers.push({ id: a.id, ok: r.ok === true, restricted: r.restricted === true, error: typeof r.error === "string" ? r.error : undefined });
    console.log(`[messenger-watch] válasz → ${a.channel} ${a.to_phone}: ${r.ok ? "kiment" : `HIBA ${r.error}`}`);
  }
  // ⑤ Presence of the numbers waiting for approval — read only, no message (the approval page groups by it).
  const presence: Record<string, unknown>[] = [];
  // Owner 2026-11-09: the bulk unknown-number lookups got first WhatsApp, then Viber restricted. While
  // ~/.config/citoviso/messenger-no-presence exists, NO presence lookup runs (⑤ and ⑥) — a new number is
  // opened only by the send itself. Chats and answers keep running.
  const noPresence = existsSync(path.join(homedir(), ".config", "citoviso", "messenger-no-presence"));
  if (noPresence && ((list.presence ?? []).length || (list.waPresence ?? []).length)) {
    console.log("[messenger-watch] jelenlét-nézés KI (messenger-no-presence) — új számot csak a küldés nyit meg.");
  }
  // Owner 2026-11-10 („miért nem ellenőrzünk?”): the Viber lookups are back, but slow — at most ONE number
  // per PRESENCE_EVERY_MS, only between 08:00 and 20:00 Budapest. 2026-11-09 the bulk lookups (822 reads,
  // 383 numbers in one morning) got the Viber account restricted; 1 per 3 min is ~20 an hour.
  const PRESENCE_EVERY_MS = 3 * 60_000;
  const stampFile = path.join(homedir(), ".cache", "citoviso-presence-at");
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Budapest" }).format(new Date()));
  const lastAt = (() => { try { return Number(readFileSync(stampFile, "utf8")) || 0; } catch { return 0; } })();
  const presenceSlot = !noPresence && hour >= 8 && hour < 20 && Date.now() - lastAt >= PRESENCE_EVERY_MS;
  const presenceNow = presenceSlot ? (list.presence ?? []).slice(0, 1) : [];
  if (presenceNow.length && !DRY) writeFileSync(stampFile, String(Date.now()));
  for (const phone of presenceNow) {
    const r = await s10(["presence", "--to", phone, ...(list.noWhatsapp ? ["--no-whatsapp"] : [])]);
    presence.push({
      phone,
      ok: r.ok === true,
      whatsapp: r.whatsapp,
      viber: r.viber,
      viberSeen: typeof r.viber_last_seen === "string" ? r.viber_last_seen : undefined,
      viberAgeDays: Number.isInteger(r.viber_age_days) ? r.viber_age_days : null,
    });
    console.log(`[messenger-watch] jelenlét ${phone}: ${r.ok ? `WhatsApp ${r.whatsapp} · Viber ${r.viber}${r.viber_last_seen ? ` (${r.viber_last_seen})` : ""}` : `HIBA ${r.error}`}`);
    // Spread the lookups (WhatsApp / Viber watch the tempo of unknown-number lookups).
    await new Promise((res) => setTimeout(res, 15_000 + Math.floor(Math.random() * 15_000)));
  }
  // ⑥ WhatsApp only where no Viber was found — the server hands out ≤ 1 number per 5 minutes (owner 2026-11-09).
  for (const phone of noPresence || hour < 8 || hour >= 20 ? [] : list.waPresence ?? []) {
    const r = await s10(["presence", "--to", phone, "--only-whatsapp"]);
    presence.push({ phone, ok: r.ok === true, whatsapp: r.whatsapp, viber: "skipped" });
    console.log(`[messenger-watch] WhatsApp-jelenlét ${phone}: ${r.ok ? `WhatsApp ${r.whatsapp}` : `HIBA ${r.error}`}`);
  }
  if (DRY) {
    console.log(`[messenger-watch] (dry-run) ${chats.length} csevegés, ${presence.length} jelenlét olvasva, jelentés nem ment fel.`);
  } else if (chats.length || answers.length || presence.length) {
    const rep = await api("/api/messenger/report", { chats, answers, presence });
    console.log(`[messenger-watch] jelentve: ${chats.length} csevegés, ${answers.length} válasz, ${presence.length} jelenlét, ${rep.replies ?? 0} bejövő üzenet a válaszok közé.`);
  } else {
    console.log("[messenger-watch] nincs esedékes csevegés.");
  }
} catch (err) {
  console.error(`[messenger-watch] hálózati hiba (a következő futás újrapróbálja): ${(err as Error).message}`);
  process.exit(0);
}
