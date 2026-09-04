// Elek's OWN mailbox viewer — read-only by construction (ADR-0095 ④).
//
//   npx tsx elek/bin/mailbox.mts list [N]     # last N messages (default 10)
//   npx tsx elek/bin/mailbox.mts read <uid>   # headers + text body + links
//
// Hard-wired to elek@citoviso.com: this tool refuses any other account, so it
// can never be repurposed to read a human's mailbox. Only PEEK fetches — no
// flag changes, no deletes, no writes of any kind.

import tls from "node:tls";
import path from "node:path";

// Load the shared .env (Node built-in loader — same mechanism as src/config.ts).
try {
  (process as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.(
    path.resolve(import.meta.dirname, "..", "..", ".env"),
  );
} catch {
  // rely on ambient env
}

const HOST = process.env.ELEK_IMAP_HOST ?? "imappro.zoho.com";
const USER = process.env.ELEK_IMAP_USER ?? "";
const PASS = process.env.ELEK_IMAP_PASSWORD ?? "";

if (USER.toLowerCase() !== "elek@citoviso.com") {
  console.error("mailbox: csak az elek@citoviso.com fiók olvasható ezzel az eszközzel");
  process.exit(1);
}
if (!PASS) {
  console.error("mailbox: hiányzó ELEK_IMAP_PASSWORD (.env)");
  process.exit(1);
}

const [cmdName, argRaw] = process.argv.slice(2);
if (cmdName !== "list" && cmdName !== "read") {
  console.error("használat: mailbox.mts list [N] | read <uid>");
  process.exit(1);
}

const sock = tls.connect(993, HOST, { servername: HOST });
let buf = "";
let tagN = 0;
let resolver: ((s: string) => void) | null = null;
let curTag = "";
sock.setEncoding("utf8");
sock.on("data", (d: string) => {
  buf += d;
  if (
    resolver &&
    (buf.includes(`${curTag} OK`) || buf.includes(`${curTag} NO`) || buf.includes(`${curTag} BAD`))
  ) {
    const out = buf;
    buf = "";
    const r = resolver;
    resolver = null;
    r(out);
  }
});
function imap(c: string): Promise<string> {
  return new Promise((res) => {
    curTag = `A${++tagN}`;
    resolver = res;
    sock.write(`${curTag} ${c}\r\n`);
  });
}

/** Quoted-printable → UTF-8 (byte-accurate: multi-byte sequences must be
 *  assembled BEFORE the utf8 decode, or ö becomes Ã¶). */
function decodeQp(s: string): string {
  const joined = s.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(joined.charCodeAt(i) & 0xff);
    }
  }
  return Buffer.from(bytes).toString("utf8");
}

/** RFC 2047 encoded-word headers: =?utf-8?Q?...?= and =?utf-8?B?...?= */
function decodeHeader(s: string): string {
  return s.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, _cs, enc, data) => {
    if (enc.toUpperCase() === "B") {
      try {
        return Buffer.from(data, "base64").toString("utf8");
      } catch {
        return data;
      }
    }
    return decodeQp(data.replace(/_/g, " "));
  });
}

/** Best-effort text extraction: QP-decode, base64 text parts, strip tags. */
function extractText(raw: string): { text: string; links: string[] } {
  let body = raw;
  // base64 text part? decode the longest base64-looking block
  const b64 = raw.match(/\r\n\r\n([A-Za-z0-9+/=\r\n]{200,})/);
  if (b64 && !/[<>]/.test(b64[1].slice(0, 100))) {
    try {
      body = Buffer.from(b64[1].replace(/\s/g, ""), "base64").toString("utf8");
    } catch {
      /* keep raw */
    }
  }
  body = decodeQp(body);
  const links = [...body.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)].map((m) => m[0]);
  const text = body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { text, links: [...new Set(links)] };
}

await new Promise((r) => sock.once("secureConnect", r));
await new Promise((r) => setTimeout(r, 800));
buf = "";
const login = await imap(`LOGIN "${USER}" "${PASS}"`);
if (!login.includes(" OK")) {
  console.error("mailbox: IMAP-belépés elutasítva:", login.slice(0, 160));
  process.exit(1);
}
// SELECT (not EXAMINE) would allow writes — EXAMINE opens the mailbox READ-ONLY
// at the protocol level; the read-only promise is mechanical, not stylistic.
const sel = await imap("EXAMINE INBOX");
const count = Number(sel.match(/\* (\d+) EXISTS/)?.[1] ?? 0);

if (cmdName === "list") {
  const n = Math.min(Number(argRaw ?? 10) || 10, 50);
  const from = Math.max(1, count - n + 1);
  if (count === 0) {
    console.log("INBOX üres.");
  } else {
    const h = await imap(
      `FETCH ${from}:${count} (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])`,
    );
    const parts = h.split(/\* (\d+) FETCH/).slice(1);
    for (let i = 0; i < parts.length - 1; i += 2) {
      const seq = parts[i];
      const seg = parts[i + 1];
      const subj = decodeHeader(seg.match(/Subject: ([^\r\n]+)/i)?.[1] ?? "?");
      const fromH = decodeHeader(seg.match(/From: ([^\r\n]+)/i)?.[1] ?? "?");
      const date = seg.match(/Date: ([^\r\n]+)/i)?.[1] ?? "?";
      console.log(`#${seq} | ${date.slice(0, 22)} | ${fromH.slice(0, 40)} | ${subj.slice(0, 70)}`);
    }
    console.log(`(${count} üzenet összesen — olvasáshoz: mailbox.mts read <#>)`);
  }
} else {
  const seq = Number(argRaw);
  if (!seq || seq < 1 || seq > count) {
    console.error(`mailbox: nincs #${argRaw} (1..${count})`);
    process.exit(1);
  }
  const raw = await imap(`FETCH ${seq} (BODY.PEEK[])`);
  const subj = decodeHeader(raw.match(/Subject: ([^\r\n]+)/i)?.[1] ?? "?");
  const fromH = decodeHeader(raw.match(/From: ([^\r\n]+)/i)?.[1] ?? "?");
  const { text, links } = extractText(raw);
  console.log(`Tárgy: ${subj}`);
  console.log(`Feladó: ${fromH}`);
  console.log(`\n${text.slice(0, 3000)}`);
  if (links.length) {
    console.log("\nLinkek:");
    for (const l of links.slice(0, 20)) console.log(`  ${l}`);
  }
}
await imap("LOGOUT");
sock.end();
process.exit(0);
