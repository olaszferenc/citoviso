// Replies collector (ADR-XXXX) — reads the replies to our outreach where they land,
// on THIS Debian box, and posts them to the host that owns the leads:
//   --sms    the GSM modem's gammu `inbox` (shared with MineREAL)  → every 60 s
//   --email  the Zoho mailbox (INBOX + the Sent folder)            → every 120 s
// Both READ-ONLY (contract: assets/design-refs/console/valaszok/README.md): the gammu
// `Processed` flag is never written; IMAP is EXAMINE + UID SEARCH + BODY.PEEK only.
//
// The SERVER decides what is a reply (src/replies/store.ts matchReply): a sender we
// never reached out to is dropped there, not stored. This side only filters the
// obvious non-replies (our own BCC copies, bounces, DMARC reports, auto-replies) and
// keeps a small state file so a message is posted once, not every minute.
//
// Runs from the MAIN tree via citoviso-replies-{sms,email}.timer. Env (main-tree .env):
//   SMS_RELAY_URL / SMS_RELAY_SECRET — the same host + bearer as the SMS relay;
//   GAMMU_DB_USER / GAMMU_DB_PASSWORD — the gammu SQL store (--sms);
//   REPLIES_IMAP_URL > REGISTRY_IMAP_URL > SMTP_URL — the mailbox (--email).
// A failed POST leaves the state untouched: the next tick re-sends the same batch.
//
//   tsx scripts/replies-collect.mts --sms|--email [--dry]

import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "../src/config.js";
import { assembleInbox, oursBefore, readInbox, readSent } from "../src/replies/gammu.js";
import { ImapReader, imapCreds, imapDate, imapQuote, notAReply, parseInternalDate } from "../src/replies/imap.js";
import { parseMail, stripQuoted } from "../src/replies/mime.js";

const args = process.argv.slice(2);
const MODE = args.includes("--sms") ? "sms" : args.includes("--email") ? "email" : null;
const DRY = args.includes("--dry");
const BASE = (process.env.SMS_RELAY_URL ?? "").replace(/\/$/, "");
const SECRET = config.smsRelaySecret;
const STATE_DIR = process.env.REPLIES_STATE_DIR || path.join(os.homedir(), ".claude");
const DAY = 86_400;
const BATCH = 40;

if (!MODE) {
  console.error("használat: tsx scripts/replies-collect.mts --sms|--email [--dry]");
  process.exit(2);
}
if (!DRY && (!BASE || !SECRET)) {
  console.log(`[replies-${MODE}] SMS_RELAY_URL / SMS_RELAY_SECRET nincs beállítva — nincs teendő.`);
  process.exit(0);
}

interface Item {
  channel: "sms" | "email";
  key: string;
  from: string;
  fromName?: string | null;
  receivedAt: string;
  subject?: string | null;
  text: string;
  ours?: { at?: string | null; subject?: string | null; text?: string | null } | null;
}

interface IngestReply {
  accepted: string[];
  dropped: number;
  answered: number;
}

async function post(body: { items: Item[]; checked: string[]; answered?: { key: string; at: string }[] }): Promise<IngestReply> {
  if (DRY) {
    console.log(JSON.stringify(body, null, 2));
    return { accepted: body.items.map((i) => i.key), dropped: 0, answered: 0 };
  }
  const resp = await fetch(`${BASE}/api/replies/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`/api/replies/ingest → HTTP ${resp.status}`);
  const r = (await resp.json()) as Partial<IngestReply>;
  return { accepted: r.accepted ?? [], dropped: Number(r.dropped ?? 0), answered: Number(r.answered ?? 0) };
}

/** Post in batches (the endpoint's body cap); `checked` rides on the last one. */
async function postAll(items: Item[], checked: string[], answered: { key: string; at: string }[] = []): Promise<IngestReply> {
  const out: IngestReply = { accepted: [], dropped: 0, answered: 0 };
  for (let i = 0; i < items.length || i === 0; i += BATCH) {
    const last = i + BATCH >= items.length;
    const r = await post({ items: items.slice(i, i + BATCH), checked: last ? checked : [], answered: last ? answered : [] });
    out.accepted.push(...r.accepted);
    out.dropped += r.dropped;
    out.answered += r.answered;
  }
  return out;
}

function loadState<T>(file: string, empty: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return empty;
  }
}

function saveState(file: string, s: unknown): void {
  if (DRY) return;
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(s, null, 1));
  fs.renameSync(tmp, file);
}

const hash = (s: string): string => createHash("sha256").update(s).digest("hex").slice(0, 16);

// ── SMS ──────────────────────────────────────────────────────────────────────────

interface SmsState {
  /** key → hash of what was last posted (a late part changes the text → re-post). */
  posted: Record<string, string>;
}

async function collectSms(): Promise<void> {
  if (!config.gammuDb.user) {
    console.log("[replies-sms] GAMMU_DB_USER nincs beállítva — nincs teendő.");
    return;
  }
  const file = path.join(STATE_DIR, "citoviso-replies-sms.json");
  const state = loadState<SmsState>(file, { posted: {} });
  const now = Math.floor(Date.now() / 1000);
  const msgs = assembleInbox(await readInbox(config.gammuDb, now - 30 * DAY), now);
  const fresh = msgs.filter((m) => state.posted[m.key] !== hash(m.text));
  const sent = fresh.length ? await readSent(config.gammuDb, [...new Set(fresh.map((m) => m.from))], now - 90 * DAY) : [];
  const items: Item[] = fresh.map((m) => {
    const ours = oursBefore(sent, m.from, Math.floor(Date.parse(m.receivedAt) / 1000));
    return { channel: "sms", key: m.key, from: m.from, receivedAt: m.receivedAt, text: m.text, ours: ours ? { at: ours.at, text: ours.text } : null };
  });
  const r = await postAll(items, ["sms"]);
  // Posted once is enough whether stored or dropped; forget what fell out of the window.
  const live = new Set(msgs.map((m) => m.key));
  const posted: Record<string, string> = {};
  for (const [k, v] of Object.entries(state.posted)) if (live.has(k)) posted[k] = v;
  for (const m of fresh) posted[m.key] = hash(m.text);
  saveState(file, { posted });
  console.log(`[replies-sms] ${msgs.length} üzenet a 30 napban, ${items.length} új → ${r.accepted.length} válasz, ${r.dropped} nem lead.`);
}

// ── E-mail ───────────────────────────────────────────────────────────────────────

interface PendingReply {
  key: string;
  address: string;
  receivedAt: string;
}

interface EmailState {
  uidValidity: number;
  lastUid: number;
  /** Accepted, not yet answered replies: watched in the Sent folder for 30 days. */
  pending: PendingReply[];
}

const SENT_FALLBACK = "Elk&APw-ld&APY-tt";
async function sentFolder(imap: ImapReader): Promise<string> {
  const all = await imap.list();
  return all.find((f) => /\\Sent\b/i.test(f.flags))?.name ?? SENT_FALLBACK;
}

async function collectEmail(): Promise<void> {
  const creds = imapCreds();
  if (!creds) {
    console.log("[replies-email] nincs IMAP-hitelesítő (REPLIES_IMAP_URL / SMTP_URL) — nincs teendő.");
    return;
  }
  const file = path.join(STATE_DIR, "citoviso-replies-email.json");
  const state = loadState<EmailState>(file, { uidValidity: 0, lastUid: 0, pending: [] });
  const imap = new ImapReader(creds);
  await imap.open();
  try {
    const validity = await imap.examine("INBOX");
    const fresh = validity !== state.uidValidity || !state.lastUid;
    const since = new Date(Date.now() - 14 * DAY * 1000);
    const uids = (await imap.uidSearch(fresh ? `SINCE ${imapDate(since)}` : `UID ${state.lastUid + 1}:*`)).filter((u) => fresh || u > state.lastUid);
    const maxUid = Math.max(fresh ? 0 : state.lastUid, ...uids);

    // Headers first: the inbox is mostly our own BCC copies — those bodies are not fetched.
    const heads = await imap.uidFetch(uids, "(UID INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT AUTO-SUBMITTED X-AUTOREPLY)])");
    const wanted = heads
      .filter((h) => {
        const p = parseMail(Buffer.concat([h.literals[0] ?? Buffer.alloc(0), Buffer.from("\r\n")]));
        return p.from.address && !notAReply(p.from.address, p.subject, p.autoSubmitted, creds);
      })
      .map((h) => h.uid);
    const full = await imap.uidFetch(wanted, "(UID INTERNALDATE BODY.PEEK[])");
    const mails = full.map((f) => ({ uid: f.uid, at: parseInternalDate(f.internalDate), mail: parseMail(f.literals[0] ?? Buffer.alloc(0)) }));

    // What each reply answers: its In-Reply-To in the Sent folder.
    const sent = await sentFolder(imap);
    await imap.examine(sent);
    const items: Item[] = [];
    for (const { uid, at, mail } of mails) {
      const text = stripQuoted(mail.text);
      if (!text) continue;
      let ours: Item["ours"] = null;
      if (mail.inReplyTo) {
        const hit = await imap.uidSearch(`HEADER Message-ID ${imapQuote(mail.inReplyTo)}`);
        if (hit.length) {
          const [o] = await imap.uidFetch([hit[hit.length - 1]!], "(UID INTERNALDATE BODY.PEEK[])");
          if (o) {
            const om = parseMail(o.literals[0] ?? Buffer.alloc(0));
            const oat = om.date ?? parseInternalDate(o.internalDate);
            ours = { at: oat ? oat.toISOString() : null, subject: om.subject || null, text: om.text.replace(/\n{3,}/g, "\n\n").trim().slice(0, 1500) || null };
          }
        }
      }
      const receivedAt = (at ?? mail.date ?? new Date()).toISOString();
      items.push({
        channel: "email",
        key: `email:${mail.messageId || `uid:${validity}:${uid}`}`,
        from: mail.from.address,
        fromName: mail.from.name,
        receivedAt,
        subject: mail.subject || null,
        text,
        ours,
      });
    }

    // Auto-answered: a mail went from the Sent folder to that address after the reply.
    const cutoff = Date.now() - 30 * DAY * 1000;
    const pending = state.pending.filter((p) => Date.parse(p.receivedAt) > cutoff);
    const answered: { key: string; at: string }[] = [];
    for (const p of pending) {
      const recv = new Date(p.receivedAt);
      const hit = await imap.uidSearch(`TO ${imapQuote(p.address)} SINCE ${imapDate(recv)}`);
      if (!hit.length) continue;
      const dates = (await imap.uidFetch(hit, "(UID INTERNALDATE)")).map((f) => parseInternalDate(f.internalDate)).filter((d): d is Date => !!d && d > recv);
      if (dates.length) answered.push({ key: p.key, at: new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString() });
    }

    const r = await postAll(items, ["email"], answered);
    const done = new Set(answered.map((a) => a.key));
    const accepted = new Set(r.accepted);
    const nextPending = pending.filter((p) => !done.has(p.key) && !accepted.has(p.key));
    for (const it of items) if (accepted.has(it.key) && !done.has(it.key)) nextPending.push({ key: it.key, address: it.from, receivedAt: it.receivedAt });
    saveState(file, { uidValidity: validity, lastUid: maxUid, pending: nextPending });
    console.log(`[replies-email] ${uids.length} új levél, ${items.length} jelölt → ${r.accepted.length} válasz, ${r.dropped} nem lead; ${r.answered} automatikusan megválaszolva.`);
  } finally {
    await imap.close();
  }
}

try {
  if (MODE === "sms") await collectSms();
  else await collectEmail();
} catch (err) {
  // Network / mailbox trouble: one line, the next tick retries (the state did not move).
  console.error(`[replies-${MODE}] hiba (a következő kör újrapróbálja): ${(err as Error).message}`);
}
process.exit(0);
