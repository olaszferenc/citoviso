// A minimal READ-ONLY IMAP client for the replies collector (ADR-XXXX). Byte-exact on
// literals (a mail body is counted in BYTES, so a utf8-decoded stream — as in
// src/domains/registryConfirmWatch.ts — would cut multi-byte text short). Only EXAMINE,
// UID SEARCH and UID FETCH with BODY.PEEK exist here: by construction it can never set a
// flag, move or delete a mail in the owner's mailbox.

import tls from "node:tls";
import { config } from "../config.js";

export interface ImapCreds {
  readonly host: string;
  readonly user: string;
  readonly pass: string;
}

/** Same rule as registryConfirmWatch.ts: the sending Zoho account IS the mailbox (smtppro → imappro). */
export function imapCreds(): ImapCreds | null {
  const explicit = process.env.REPLIES_IMAP_URL || process.env.REGISTRY_IMAP_URL;
  const raw = explicit || config.smtpUrl;
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const user = decodeURIComponent(u.username);
    const pass = decodeURIComponent(u.password);
    if (!user || !pass) return null;
    return { host: explicit ? u.hostname : u.hostname.replace(/^smtp/, "imap"), user, pass };
  } catch {
    return null;
  }
}

/** One FETCH response: the UID and every literal / quoted item keyed by its item name. */
export interface FetchItem {
  readonly uid: number;
  readonly internalDate: string | null;
  /** Literal payloads in order of appearance (BODY[...] sections). */
  readonly literals: readonly Buffer[];
}

const quote = (s: string): string => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

export class ImapReader {
  private sock: tls.TLSSocket | null = null;
  private buf = Buffer.alloc(0);
  private waiter: (() => void) | null = null;
  private tag = 0;
  private closed: Error | null = null;

  constructor(private readonly creds: ImapCreds, private readonly timeoutMs = 30_000) {}

  async open(): Promise<void> {
    const c = this.creds;
    this.sock = tls.connect(993, c.host, { servername: c.host });
    this.sock.on("data", (d: Buffer) => {
      this.buf = Buffer.concat([this.buf, d]);
      this.waiter?.();
    });
    const fail = (e: Error) => {
      this.closed = e;
      this.waiter?.();
    };
    this.sock.on("error", fail);
    this.sock.on("close", () => fail(new Error("IMAP kapcsolat lezárult")));
    await this.readLine(); // greeting
    await this.cmd(`LOGIN ${quote(c.user)} ${quote(c.pass)}`, "LOGIN");
  }

  private async more(): Promise<void> {
    if (this.closed) throw this.closed;
    await new Promise<void>((res, rej) => {
      const t = setTimeout(() => rej(new Error("IMAP időtúllépés")), this.timeoutMs);
      this.waiter = () => {
        clearTimeout(t);
        this.waiter = null;
        res();
      };
    });
    if (this.closed && !this.buf.length) throw this.closed;
  }

  private async readLine(): Promise<string> {
    for (;;) {
      const i = this.buf.indexOf("\r\n");
      if (i >= 0) {
        const line = this.buf.subarray(0, i).toString("utf8");
        this.buf = this.buf.subarray(i + 2);
        return line;
      }
      await this.more();
    }
  }

  private async readBytes(n: number): Promise<Buffer> {
    while (this.buf.length < n) await this.more();
    const out = Buffer.from(this.buf.subarray(0, n));
    this.buf = this.buf.subarray(n);
    return out;
  }

  /**
   * Send one command; collect its untagged responses as "logical lines" where every
   * {n} literal is replaced by a \u0000<index>\u0000 marker and kept as bytes.
   */
  private async cmd(command: string, label: string): Promise<{ lines: string[]; literals: Buffer[] }> {
    if (!this.sock) throw new Error("IMAP nincs megnyitva");
    const t = `r${++this.tag}`;
    this.sock.write(`${t} ${command}\r\n`);
    const lines: string[] = [];
    const literals: Buffer[] = [];
    let cur = "";
    for (;;) {
      const line = await this.readLine();
      const lit = /\{(\d+)\}$/.exec(line);
      if (lit) {
        cur += line.slice(0, lit.index) + `\u0000${literals.length}\u0000`;
        literals.push(await this.readBytes(Number(lit[1])));
        continue;
      }
      cur += line;
      if (cur.startsWith(`${t} `)) {
        // The command name is safe to echo; its arguments may hold the password.
        if (!/^\S+ OK/.test(cur)) throw new Error(`IMAP ${label} elutasítva: ${cur.slice(t.length + 1, t.length + 80)}`);
        return { lines, literals };
      }
      lines.push(cur);
      cur = "";
    }
  }

  /** Read-only open of a folder; returns its UIDVALIDITY. */
  async examine(folder: string): Promise<number> {
    const r = await this.cmd(`EXAMINE ${quote(folder)}`, "EXAMINE");
    const v = r.lines.map((l) => /UIDVALIDITY (\d+)/.exec(l)?.[1]).find(Boolean);
    return Number(v ?? 0);
  }

  /** Folder names as the server lists them (modified UTF-7, unchanged). */
  async list(): Promise<{ name: string; flags: string }[]> {
    const r = await this.cmd(`LIST "" "*"`, "LIST");
    return r.lines
      .map((l) => /^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (.+)$/.exec(l))
      .filter((m): m is RegExpExecArray => !!m)
      .map((m) => ({ flags: m[1]!, name: m[2]!.replace(/^"(.*)"$/, "$1").replace(/\\(["\\])/g, "$1") }));
  }

  async uidSearch(criteria: string): Promise<number[]> {
    const r = await this.cmd(`UID SEARCH ${criteria}`, "SEARCH");
    const l = r.lines.find((x) => x.startsWith("* SEARCH"));
    return (l ?? "").slice(8).trim().split(/\s+/).filter(Boolean).map(Number);
  }

  /** UID FETCH with BODY.PEEK items — never sets \Seen. */
  async uidFetch(uids: readonly number[], items: string): Promise<FetchItem[]> {
    if (!uids.length) return [];
    // BODY[...] and RFC822 / RFC822.TEXT set \Seen; only their .PEEK / .SIZE forms are allowed.
    if (/(?<!\.PEEK)\bBODY\[|\bRFC822(?!\.SIZE)\b/.test(items)) {
      throw new Error("IMAP FETCH csak BODY.PEEK-kel (olvasott jelzés nélkül)");
    }
    const r = await this.cmd(`UID FETCH ${uids.join(",")} ${items}`, "FETCH");
    const out: FetchItem[] = [];
    for (const l of r.lines) {
      if (!/^\* \d+ FETCH /.test(l)) continue;
      const uid = Number(/UID (\d+)/.exec(l)?.[1] ?? 0);
      const internalDate = /INTERNALDATE "([^"]+)"/.exec(l)?.[1] ?? null;
      const literals = [...l.matchAll(/\u0000(\d+)\u0000/g)].map((m) => r.literals[Number(m[1])]!);
      out.push({ uid, internalDate, literals });
    }
    return out;
  }

  async close(): Promise<void> {
    try {
      if (this.sock && !this.closed) await this.cmd("LOGOUT", "LOGOUT");
    } catch {
      // closing is best-effort
    } finally {
      this.sock?.end();
      this.sock = null;
    }
  }
}

/** IMAP SEARCH date: 7-Oct-2026. */
export function imapDate(d: Date): string {
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  return `${d.getUTCDate()}-${mon}-${d.getUTCFullYear()}`;
}

/** An IMAP quoted string for SEARCH arguments. */
export const imapQuote = quote;
