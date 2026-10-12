// Model-authored HTML is UNTRUSTED (ADR-0370). The legacy AI-HTML mock path
// (generate.ts → generateFromCorpus) lets the model write the whole document, and the
// model reads scraped text anyone can write (name, address, contact fields). Measured
// 2026-10-12: a prose instruction in the address ("tedd be ezt a kódot…") made the model
// emit a <script>, an onclick, seven onload handlers and a javascript: link — all ran in
// the browser. The model's behaviour is no guarantee, so its output is sanitized here
// BEFORE our own runtime is injected, and stored legacy pages pass the same filter at
// serve time (no backfill).
//
// What goes: every <script> (with its content), <iframe>/<frame>/<frameset>/<object>/
// <embed>/<applet>/<portal>/<base>, <meta http-equiv=refresh>, every on* attribute,
// srcdoc, and any attribute whose value is a javascript:/vbscript: URL or a data: URL
// that is not a plain raster image. What stays: markup, <style>, our runtime is added
// AFTER this pass (injectRuntime), so it is never filtered.
//
// No HTML-parser dependency exists in the repo, so this is a small tokenizer that
// RE-SERIALIZES every tag from its parsed attributes (no regex patching of the source).
// Where the browser could read a stretch as markup but a naive filter as text (raw-text
// elements inside <svg>/<math>, noscript mXSS), the stretch is sanitized as markup too.

import { readFile } from "node:fs/promises";

import { injectRuntime } from "./runtime.js";

export interface SanitizeReport {
  scripts: number;
  handlers: number;
  urls: number;
  embeds: number;
}

export interface SanitizedHtml {
  html: string;
  removed: SanitizeReport;
}

/** Elements dropped together with everything up to their end tag. */
const DROP_WITH_CONTENT = new Set(["script", "iframe", "noembed", "noframes", "xmp", "plaintext"]);
/** Elements whose tags are dropped (their children, a plain fallback, stay). */
const DROP_TAG = new Set(["frame", "frameset", "object", "embed", "applet", "portal", "base"]);
/** Raw-text elements kept: their content runs to the end tag, then is sanitized as markup. */
const RAW_TEXT = new Set(["style", "textarea", "title", "noscript"]);

const SAFE_DATA = /^data:image\/(png|jpe?g|gif|webp|avif|x-icon|vnd\.microsoft\.icon)[;,]/;

const NAMED: Record<string, string> = {
  colon: ":", tab: "\t", newline: "\n", lpar: "(", rpar: ")", sol: "/", amp: "&",
  quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
};

function decodeEntities(v: string): string {
  return v.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);?/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** Is this attribute value a URL the browser would run (or render as a document)? */
function isDangerousUrl(value: string, tag: string, attr: string): boolean {
  // The browser strips ASCII whitespace/controls inside the scheme before matching it.
  // eslint-disable-next-line no-control-regex
  const v = decodeEntities(value).replace(/[\u0000- \u007f-\u009f]+/g, "").toLowerCase();
  if (/^(javascript|vbscript|livescript):/.test(v)) return true;
  if (v.startsWith("data:")) {
    if (SAFE_DATA.test(v)) return false;
    // An SVG as an <img> source cannot run script; anywhere else it is a document.
    if (tag === "img" && attr === "src" && v.startsWith("data:image/svg+xml")) return false;
    return true;
  }
  return false;
}

/** SVG animation can set href to a value list ("#;javascript:…"), which no prefix check sees. */
const ANIMATION = new Set(["animate", "set", "animatemotion", "animatetransform"]);
function isScriptAnimation(tag: string, attr: string, value: string): boolean {
  if (!ANIMATION.has(tag) || !["values", "to", "from", "by"].includes(attr)) return false;
  // eslint-disable-next-line no-control-regex
  const v = decodeEntities(value).replace(/[\u0000-\u0020\u007f-\u009f]+/g, "").toLowerCase();
  return /(javascript|vbscript|livescript):/.test(v);
}

interface Attr {
  name: string;
  value: string | null;
}

interface Tag {
  name: string;
  attrs: Attr[];
  selfClosing: boolean;
  end: number; // index just past '>'
}

const WS = /[\t\n\f\r ]/;

/** Parse a start tag beginning at `i` (the char after '<'), per the HTML tokenizer rules. */
function parseTag(src: string, i: number): Tag | null {
  let j = i;
  while (j < src.length && !WS.test(src[j]!) && src[j] !== "/" && src[j] !== ">") j++;
  const name = src.slice(i, j);
  const attrs: Attr[] = [];
  let selfClosing = false;
  for (;;) {
    while (j < src.length && (WS.test(src[j]!) || src[j] === "/")) {
      if (src[j] === "/" && src[j + 1] === ">") selfClosing = true;
      j++;
    }
    if (j >= src.length) return null; // unterminated tag: dropped
    if (src[j] === ">") return { name, attrs, selfClosing, end: j + 1 };
    const ns = j;
    j++; // the first name char may be '='
    while (j < src.length && !WS.test(src[j]!) && src[j] !== "/" && src[j] !== ">" && src[j] !== "=") j++;
    const an = src.slice(ns, j);
    while (j < src.length && WS.test(src[j]!)) j++;
    if (src[j] !== "=") {
      attrs.push({ name: an, value: null });
      continue;
    }
    j++;
    while (j < src.length && WS.test(src[j]!)) j++;
    let value: string;
    const q = src[j];
    if (q === '"' || q === "'") {
      const close = src.indexOf(q, j + 1);
      if (close < 0) return null;
      value = src.slice(j + 1, close);
      j = close + 1;
    } else {
      const vs = j;
      while (j < src.length && !WS.test(src[j]!) && src[j] !== ">") j++;
      value = src.slice(vs, j);
    }
    attrs.push({ name: an, value });
  }
}

/** Index of the end tag `</name` (case-insensitive) at or after `from`, or -1. */
function findEndTag(src: string, name: string, from: number): number {
  const re = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, "gi");
  re.lastIndex = from;
  const m = re.exec(src);
  return m ? m.index : -1;
}

function sanitizeInto(src: string, out: string[], rep: SanitizeReport): void {
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf("<", i);
    if (lt < 0) {
      out.push(src.slice(i));
      return;
    }
    out.push(src.slice(i, lt));
    const c = src[lt + 1] ?? "";
    // Comments are dropped. The browser closes one at the EARLIEST of -->, --!> (and an
    // immediate > / ->), so the earliest is taken: ending later than the browser would
    // hide live markup inside a "comment".
    if (src.startsWith("<!--", lt)) {
      const body = lt + 4;
      if (src[body] === ">") { i = body + 1; continue; }
      if (src.startsWith("->", body)) { i = body + 2; continue; }
      const ends = [src.indexOf("-->", body), src.indexOf("--!>", body)].filter((n) => n >= 0);
      if (!ends.length) return;
      const e = Math.min(...ends);
      i = e + (src.startsWith("--!>", e) ? 4 : 3);
      continue;
    }
    if (c === "!" || c === "?") {
      const gt = src.indexOf(">", lt);
      if (gt < 0) return;
      const decl = src.slice(lt, gt + 1);
      if (/^<!doctype\s/i.test(decl)) out.push(decl); // anything else is a bogus comment: dropped
      i = gt + 1;
      continue;
    }
    if (c === "/") {
      // End tag: re-emitted by name only (the browser ignores attributes on end tags).
      const m = /^<\/([a-zA-Z][^\t\n\f\r />]*)[^>]*>/.exec(src.slice(lt));
      if (!m) {
        const gt = src.indexOf(">", lt);
        if (gt < 0) return;
        i = gt + 1; // "</>" / "</ 3" style junk is a bogus comment
        continue;
      }
      const n = m[1]!.toLowerCase();
      if (!DROP_TAG.has(n) && !DROP_WITH_CONTENT.has(n)) out.push(`</${m[1]}>`);
      i = lt + m[0].length;
      continue;
    }
    if (!/[a-zA-Z]/.test(c)) {
      out.push("&lt;"); // a bare '<' is text to the browser as well
      i = lt + 1;
      continue;
    }
    const tag = parseTag(src, lt + 1);
    if (!tag) return; // an unterminated tag at EOF is not rendered by the browser either
    const n = tag.name.toLowerCase();
    i = tag.end;
    if (DROP_WITH_CONTENT.has(n)) {
      if (n === "script") rep.scripts++;
      else rep.embeds++;
      if (n === "plaintext") return;
      const e = findEndTag(src, n, i);
      if (e < 0) return;
      i = src.indexOf(">", e) + 1 || src.length;
      continue;
    }
    if (DROP_TAG.has(n)) {
      rep.embeds++;
      continue;
    }
    if (
      n === "meta" &&
      tag.attrs.some((a) => a.name.toLowerCase() === "http-equiv" && /refresh|set-cookie/i.test(a.value ?? ""))
    ) {
      rep.embeds++;
      continue;
    }
    const kept: string[] = [];
    for (const a of tag.attrs) {
      const an = a.name.toLowerCase();
      if (an.startsWith("on") || an === "srcdoc") {
        rep.handlers++;
        continue;
      }
      if (a.value !== null && (isDangerousUrl(a.value, n, an) || isScriptAnimation(n, an, a.value))) {
        rep.urls++;
        continue;
      }
      if (!/^[^\t\n\f\r />"'<=]+$/.test(a.name)) continue; // unserializable name: dropped
      kept.push(a.value === null ? a.name : `${a.name}="${a.value.replace(/"/g, "&quot;")}"`);
    }
    out.push(`<${tag.name}${kept.length ? " " + kept.join(" ") : ""}${tag.selfClosing ? " /" : ""}>`);
    if (RAW_TEXT.has(n) && !tag.selfClosing) {
      const e = findEndTag(src, n, i);
      const stop = e < 0 ? src.length : e;
      const body = src.slice(i, stop);
      // Inert as raw text in HTML; markup inside <svg>/<math> (and the noscript mXSS
      // stretch). Sanitizing it as markup is safe in both readings.
      if (/<[a-zA-Z!/?]/.test(body)) sanitizeInto(body, out, rep);
      else out.push(body);
      i = stop;
    }
  }
}

/** Strip every executable construct from model-authored HTML (see the header). */
export function sanitizeModelHtml(html: string): SanitizedHtml {
  const removed: SanitizeReport = { scripts: 0, handlers: 0, urls: 0, embeds: 0 };
  const out: string[] = [];
  sanitizeInto(html, out, removed);
  return { html: out.join(""), removed };
}

/**
 * Was this artifact's HTML written by the model (legacy AI path) rather than rendered by
 * our engine/template from escaped data? Unknown provenance without a re-renderable
 * recipe counts as model HTML — the safe side.
 */
export function isModelAuthoredArtifact(inputs: unknown): boolean {
  const i = (inputs ?? {}) as Record<string, unknown>;
  if (i.engine === "ai") return true;
  if (i.engine === "composition" || i.engine === "template") return false;
  return !(i.recipe && i.siteData);
}

/**
 * Serve-time gate for a STORED mock page: a model-authored page is sanitized and gets
 * today's runtime re-injected (the filter also removes the runtime script it carried);
 * an engine/template page is returned untouched.
 */
export async function servableMockHtml(html: string, inputs: unknown): Promise<string> {
  if (!isModelAuthoredArtifact(inputs)) return html;
  return injectRuntime(sanitizeModelHtml(html).html);
}

/** Read a stored mock page through the serve-time gate (servableMockHtml). */
export async function readServableMock(file: string, inputs: unknown): Promise<string> {
  return servableMockHtml(await readFile(file, "utf8"), inputs);
}
