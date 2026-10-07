// Replies collector, SMS half (ADR-0339): the gammu `inbox` of the dev box's modem,
// READ-ONLY. ⛔ `Processed` is never written — the modem (and this table) is shared with
// MineREAL, whose own reader owns that flag.
//
// What 2026-10-07 taught (contract README ⑧):
//   • A long SMS arrives as several rows tied by the UDH (050003RRTTSS / 060804RRRRTTSS).
//   • gammu left `TextDecoded` EMPTY on the 2nd part, while the 1st part's `TextDecoded`
//     held the WHOLE message (joining it with part 2 doubled the tail). The per-part truth
//     is `Text`: UCS-2 hex — although `Coding` said Default_No_Compression. So `Text` is
//     decoded first, whatever `Coding` claims; `TextDecoded` is only the fallback.
//   • Coding '8bit' rows are WAP-push / MMS notifications, not a person writing.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GammuDbConfig } from "../sms/modemLane.js";

const execFileP = promisify(execFile);

export interface InboxRow {
  readonly id: number;
  /** Unix seconds — read with UNIX_TIMESTAMP(), so the DB's local time zone cannot shift it. */
  readonly at: number;
  readonly sender: string;
  readonly udh: string;
  readonly coding: string;
  readonly textDecoded: string;
  /** The raw `Text` column (hex). */
  readonly textHex: string;
}

export interface SentRow {
  readonly id: number;
  readonly seq: number;
  readonly at: number;
  readonly dest: string;
  readonly text: string;
}

export interface AssembledSms {
  /** 'sms:<lowest inbox ID>' — stable however late the other parts arrive. */
  readonly key: string;
  readonly from: string;
  readonly receivedAt: string;
  readonly text: string;
  /** Some parts never arrived (only emitted once the wait window is over). */
  readonly partial: boolean;
}

/** UCS-2 BE hex → string. "" for anything that is not even-length hex. */
export function decodeUcs2Hex(hex: string): string {
  const h = hex.trim();
  if (!h || h.length % 4 !== 0 || !/^[0-9a-fA-F]+$/.test(h)) return "";
  const b = Buffer.from(h, "hex");
  b.swap16();
  return b.toString("utf16le");
}

/** Concatenation info from a UDH, or null for a single-part SMS. */
export function parseUdh(udh: string): { ref: string; total: number; seq: number } | null {
  const u = udh.trim().toUpperCase();
  let m = /^050003([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})/.exec(u);
  if (!m) m = /^060804([0-9A-F]{4})([0-9A-F]{2})([0-9A-F]{2})/.exec(u);
  if (!m) return null;
  return { ref: m[1]!, total: parseInt(m[2]!, 16), seq: parseInt(m[3]!, 16) };
}

/** One part's own text: `Text` (UCS-2 hex) first, `TextDecoded` only when that is not hex. */
export function rowText(r: Pick<InboxRow, "textDecoded" | "textHex">): string {
  return decodeUcs2Hex(r.textHex) || r.textDecoded;
}

/** How long a multipart group may wait for a missing part before it is sent as is. */
export const PART_WAIT_SEC = 600;
/** Parts of one message arrive within this span; a reused UDH ref later is a new message. */
const GROUP_SPAN_SEC = 6 * 3600;

/**
 * Inbox rows → whole messages. Pure. A group still missing parts is held back until
 * PART_WAIT_SEC after its newest part, then emitted as `partial` (a lost part must not
 * hide the reply forever).
 */
export function assembleInbox(rows: readonly InboxRow[], nowSec: number): AssembledSms[] {
  const singles: InboxRow[][] = [];
  const groups = new Map<string, InboxRow[]>();
  for (const r of [...rows].sort((a, b) => a.id - b.id)) {
    if (r.coding === "8bit") continue;
    const u = parseUdh(r.udh);
    if (!u || u.total < 2) {
      singles.push([r]);
      continue;
    }
    // Same sender + ref + total, close in time = one message.
    let placed = false;
    for (const [k, g] of groups) {
      if (!k.startsWith(`${r.sender}|${u.ref}|${u.total}|`)) continue;
      if (Math.abs(r.at - g[0]!.at) > GROUP_SPAN_SEC) continue;
      if (g.some((x) => parseUdh(x.udh)!.seq === u.seq)) continue; // a duplicate part = a new message
      g.push(r);
      placed = true;
      break;
    }
    if (!placed) groups.set(`${r.sender}|${u.ref}|${u.total}|${r.id}`, [r]);
  }
  const out: AssembledSms[] = [];
  for (const [r] of singles) {
    const text = rowText(r!).trim();
    if (text) out.push({ key: `sms:${r!.id}`, from: r!.sender, receivedAt: new Date(r!.at * 1000).toISOString(), text, partial: false });
  }
  for (const g of groups.values()) {
    const total = parseUdh(g[0]!.udh)!.total;
    const newest = Math.max(...g.map((x) => x.at));
    const complete = g.length >= total;
    if (!complete && nowSec - newest < PART_WAIT_SEC) continue;
    const parts = [...g].sort((a, b) => parseUdh(a.udh)!.seq - parseUdh(b.udh)!.seq);
    const text = parts.map(rowText).join("").trim();
    if (!text) continue;
    const first = Math.min(...g.map((x) => x.id));
    out.push({
      key: `sms:${first}`,
      from: g[0]!.sender,
      receivedAt: new Date(Math.min(...g.map((x) => x.at)) * 1000).toISOString(),
      text,
      partial: !complete,
    });
  }
  return out.sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
}

/** Our last message to `dest` before `beforeSec` — what the reply answers. Pure. */
export function oursBefore(sent: readonly SentRow[], dest: string, beforeSec: number): { at: string; text: string } | null {
  const mine = sent.filter((s) => s.dest === dest && s.at <= beforeSec);
  if (!mine.length) return null;
  const lastId = mine.reduce((a, b) => (b.at > a.at ? b : a)).id;
  const parts = mine.filter((s) => s.id === lastId).sort((a, b) => a.seq - b.seq);
  const text = parts.map((p) => p.text).join("").trim();
  return text ? { at: new Date(parts[0]!.at * 1000).toISOString(), text } : null;
}

// ── the real reader (mysql CLI, like src/sms/modemLane.ts — no driver in the tree) ──

async function q(c: GammuDbConfig, sql: string): Promise<string[][]> {
  const { stdout } = await execFileP("mysql", ["-h", c.host, "-u", c.user, "-N", "-B", c.name, "-e", sql], {
    env: { ...process.env, MYSQL_PWD: c.password }, // not on the command line (ps)
    maxBuffer: 32 * 1024 * 1024,
  });
  return stdout
    .split("\n")
    .filter((l) => l.length)
    .map((l) => l.split("\t"));
}

/** Text columns travel hex-encoded: a tab or newline in an SMS must not break the row. */
const fromHex = (h: string | undefined): string => Buffer.from(h ?? "", "hex").toString("utf8");

export async function readInbox(c: GammuDbConfig, sinceSec: number): Promise<InboxRow[]> {
  const since = Math.floor(sinceSec);
  const rows = await q(
    c,
    `SELECT ID, UNIX_TIMESTAMP(ReceivingDateTime), SenderNumber, IFNULL(UDH,''), Coding, HEX(IFNULL(TextDecoded,'')), IFNULL(Text,'') ` +
      `FROM inbox WHERE ReceivingDateTime >= FROM_UNIXTIME(${since}) ORDER BY ID`,
  );
  return rows.map((r) => ({
    id: Number(r[0]),
    at: Number(r[1]),
    sender: r[2] ?? "",
    udh: r[3] ?? "",
    coding: r[4] ?? "",
    textDecoded: fromHex(r[5]),
    textHex: r[6] ?? "",
  }));
}

export async function readSent(c: GammuDbConfig, dests: readonly string[], sinceSec: number): Promise<SentRow[]> {
  const safe = dests.filter((d) => /^\+?\d{6,20}$/.test(d));
  if (!safe.length) return [];
  const rows = await q(
    c,
    `SELECT ID, SequencePosition, UNIX_TIMESTAMP(SendingDateTime), DestinationNumber, HEX(IFNULL(TextDecoded,'')) ` +
      `FROM sentitems WHERE DestinationNumber IN (${safe.map((d) => `'${d}'`).join(",")}) ` +
      `AND SendingDateTime >= FROM_UNIXTIME(${Math.floor(sinceSec)})`,
  );
  return rows.map((r) => ({ id: Number(r[0]), seq: Number(r[1]), at: Number(r[2]), dest: r[3] ?? "", text: fromHex(r[4]) }));
}
