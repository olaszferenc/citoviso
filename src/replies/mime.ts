// Just enough RFC 5322 / MIME for the replies collector (ADR-0339): headers with
// encoded-words, multipart walk, base64 / quoted-printable, charsets via TextDecoder —
// and the cut that keeps ONLY the reply's own text (contract README ⑧: the quoted part,
// i.e. our own mail, is not part of the reply).

import { QUOTE_LINE_PATTERNS, QUOTE_WRAP_FIRST, QUOTE_WRAP_SECOND } from "./quoteMarkers.js";

export interface ParsedMail {
  readonly from: { readonly name: string | null; readonly address: string };
  readonly to: string;
  readonly subject: string;
  readonly messageId: string;
  readonly inReplyTo: string;
  readonly references: readonly string[];
  readonly date: Date | null;
  readonly autoSubmitted: boolean;
  /** Plain text of the mail (text/plain preferred, else de-tagged text/html). */
  readonly text: string;
}

function decodeCharset(buf: Buffer, charset: string): string {
  const cs = (charset || "utf-8").trim().toLowerCase().replace(/^"|"$/g, "");
  try {
    return new TextDecoder(cs === "latin2" ? "iso-8859-2" : cs).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

function qpDecode(s: string, header = false): Buffer {
  const src = header ? s.replace(/_/g, " ") : s.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (c === "=" && /^[0-9A-Fa-f]{2}$/.test(src.slice(i + 1, i + 3))) {
      bytes.push(parseInt(src.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      for (const b of Buffer.from(c, "latin1")) bytes.push(b);
    }
  }
  return Buffer.from(bytes);
}

/** RFC 2047 encoded-words (=?utf-8?B?...?= / =?iso-8859-2?Q?...?=). */
export function decodeWords(s: string): string {
  return s
    .replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?)/g, "$1")
    .replace(/=\?([^?*]+)(?:\*[^?]*)?\?([BbQq])\?([^?]*)\?=/g, (_m, cs: string, enc: string, data: string) => {
      const buf = enc.toUpperCase() === "B" ? Buffer.from(data, "base64") : qpDecode(data, true);
      return decodeCharset(buf, cs);
    });
}

/** Split a raw entity into its (unfolded) headers and body bytes. */
function splitEntity(raw: Buffer): { headers: Map<string, string>; body: Buffer } {
  let i = raw.indexOf("\r\n\r\n");
  let sep = 4;
  if (i < 0) {
    i = raw.indexOf("\n\n");
    sep = 2;
  }
  const head = (i < 0 ? raw : raw.subarray(0, i)).toString("latin1");
  const body = i < 0 ? Buffer.alloc(0) : raw.subarray(i + sep);
  const headers = new Map<string, string>();
  for (const line of head.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const m = /^([!-9;-~]+):\s*(.*)$/.exec(line);
    if (m && !headers.has(m[1]!.toLowerCase())) headers.set(m[1]!.toLowerCase(), m[2]!);
  }
  return { headers, body };
}

/** A header value as text: raw bytes are UTF-8 in practice; encoded-words decoded. */
function headerText(v: string | undefined): string {
  if (!v) return "";
  return decodeWords(Buffer.from(v, "latin1").toString("utf8")).trim();
}

function param(v: string, name: string): string {
  const m = new RegExp(`;\\s*${name}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, "i").exec(v);
  return m ? (m[2] ?? m[1]!) : "";
}

function decodeBody(body: Buffer, cte: string, charset: string): string {
  const enc = cte.trim().toLowerCase();
  let bytes = body;
  if (enc === "base64") bytes = Buffer.from(body.toString("latin1").replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
  else if (enc === "quoted-printable") bytes = qpDecode(body.toString("latin1"));
  return decodeCharset(bytes, charset);
}

/** HTML → readable text (block tags become newlines, entities decoded). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_m, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** The best text part of an entity: text/plain wins over text/html; attachments are skipped. */
function bestText(raw: Buffer, depth = 0): { plain: string | null; html: string | null } {
  const { headers, body } = splitEntity(raw);
  const ct = headers.get("content-type") ?? "text/plain";
  const type = ct.split(";")[0]!.trim().toLowerCase();
  const disp = (headers.get("content-disposition") ?? "").toLowerCase();
  if (type.startsWith("multipart/") && depth < 8) {
    const boundary = param(ct, "boundary");
    if (!boundary) return { plain: null, html: null };
    const parts = body.toString("latin1").split(`--${boundary}`).slice(1);
    let plain: string | null = null;
    let html: string | null = null;
    for (const p of parts) {
      if (p.startsWith("--")) break;
      const sub = bestText(Buffer.from(p.replace(/^\r?\n/, ""), "latin1"), depth + 1);
      plain ??= sub.plain;
      html ??= sub.html;
    }
    return { plain, html };
  }
  if (disp.startsWith("attachment")) return { plain: null, html: null };
  const cte = headers.get("content-transfer-encoding") ?? "7bit";
  const charset = param(ct, "charset") || "utf-8";
  if (type === "text/plain") return { plain: decodeBody(body, cte, charset), html: null };
  if (type === "text/html") return { plain: null, html: decodeBody(body, cte, charset) };
  return { plain: null, html: null };
}

/** "Eszter Varga <a@b.hu>" → { name, address } (address lower-cased). */
export function parseAddress(v: string): { name: string | null; address: string } {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>/.exec(v);
  if (m) return { name: m[1]?.trim() || null, address: m[2]!.trim().toLowerCase() };
  return { name: null, address: v.trim().toLowerCase() };
}

const ids = (v: string): string[] => [...v.matchAll(/<[^>]+>/g)].map((m) => m[0]);

export function parseMail(raw: Buffer): ParsedMail {
  const { headers } = splitEntity(raw);
  const t = bestText(raw);
  const text = (t.plain ?? (t.html ? htmlToText(t.html) : "")).replace(/\r\n/g, "\n");
  const date = headers.get("date") ? new Date(headers.get("date")!) : null;
  return {
    from: parseAddress(headerText(headers.get("from"))),
    to: headerText(headers.get("to")),
    subject: headerText(headers.get("subject")),
    messageId: ids(headers.get("message-id") ?? "")[0] ?? "",
    inReplyTo: ids(headers.get("in-reply-to") ?? "")[0] ?? "",
    references: ids(headers.get("references") ?? ""),
    date: date && Number.isFinite(date.getTime()) ? date : null,
    autoSubmitted: /^auto-/i.test(headers.get("auto-submitted") ?? "") || !!headers.get("x-autoreply"),
    text,
  };
}

/**
 * The reply's OWN text: everything above the first quote marker. The markers come from
 * QUOTE_MARKERS (quoteMarkers.ts) — the attribution line ("On … wrote:", "… írta:",
 * "Am … schrieb X:", "… napsal(a):", "… написа:" …), the "-----Original Message-----"
 * banner, Outlook's "From: … Sent: …" block in every covered language, and ">"-prefixed
 * lines. ADR-XXXX: data, not one `if` per language.
 */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let cut = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (QUOTE_LINE_PATTERNS.some((m) => m.test(l)) || (/^\s*>/.test(l) && lines.slice(i).filter((x) => x.trim()).every((x) => /^\s*>/.test(x)))) {
      cut = i;
      break;
    }
    // Gmail wraps a long "On … wrote:" over two lines.
    if (QUOTE_WRAP_FIRST.test(l) && QUOTE_WRAP_SECOND.test(lines[i + 1] ?? "")) {
      cut = i;
      break;
    }
  }
  return lines
    .slice(0, cut)
    .filter((l) => !/^\s*>/.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
