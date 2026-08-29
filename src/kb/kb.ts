// Knowledge base loader + renderer (ADR-0045, 03-INVARIANTS §J).
//
// Entries live in the repo (kb/entries/<slug>/entry.hu.md — Hungarian source,
// English slugs/anchors) so the pre-commit gate can version and lint them.
// Translations will come from the kb_translation table (slice ③); this module
// serves the Hungarian source and is the single place a language switch will land.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
// Shared with the tenant admin document/message search (ADR-0084) — one folding
// rule in one place, so a fix reaches every search surface at once.
import { fold } from "../text/fold.js";

const ENTRIES_DIR = path.resolve(import.meta.dirname, "../../kb/entries");

export interface KbEntry {
  readonly id: string;
  readonly title: string;
  readonly audience: "tenant" | "operator";
  readonly anchors: readonly string[];
  readonly updated: string;
  readonly body: string;
  /** First paragraph, plain text — the search-result teaser. */
  readonly snippet: string;
}

/** First paragraph as plain text — the search-result teaser (also used on the
 *  translated overlay, so it must derive from the body, not the frontmatter). */
export function makeSnippet(body: string): string {
  const firstPara =
    body.split(/\n\s*\n/).find((b) => !b.startsWith("#") && !b.startsWith("!")) ?? "";
  return firstPara.replace(/\*\*/g, "").replace(/\s+/g, " ").slice(0, 160);
}

function parseEntry(id: string, raw: string): KbEntry | null {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  const body = m[2].trim();
  return {
    id,
    title: meta.title ?? id,
    audience: meta.audience === "operator" ? "operator" : "tenant",
    anchors: (meta.anchors ?? "").split(",").map((a) => a.trim()).filter(Boolean),
    updated: meta.updated ?? "",
    body,
    snippet: makeSnippet(body),
  };
}

// Short-TTL cache: entries change only with deploys in prod, but during local
// development an author should see an edit without restarting the server.
let cache: { at: number; entries: KbEntry[] } | null = null;
export function loadKbEntries(): KbEntry[] {
  if (cache && Date.now() - cache.at < 5000) return cache.entries;
  const entries: KbEntry[] = [];
  if (existsSync(ENTRIES_DIR)) {
    for (const slug of readdirSync(ENTRIES_DIR)) {
      const src = path.join(ENTRIES_DIR, slug, "entry.hu.md");
      if (!statSync(path.join(ENTRIES_DIR, slug)).isDirectory() || !existsSync(src)) continue;
      const entry = parseEntry(slug, readFileSync(src, "utf8"));
      if (entry) entries.push(entry);
    }
  }
  entries.sort((a, b) => a.title.localeCompare(b.title, "hu"));
  cache = { at: Date.now(), entries };
  return entries;
}

/** Resolve ?topic= over a (possibly localized) entry list — accepts an anchor
 *  (admin.photos) or an entry id (admin-photos). */
export function pickKbEntry(entries: readonly KbEntry[], topic: string): KbEntry | null {
  return (
    entries.find((e) => e.anchors.includes(topic)) ?? entries.find((e) => e.id === topic) ?? null
  );
}

/** Accent-insensitive substring search over title + body of the given entry list. */
export function filterKbEntries(entries: readonly KbEntry[], query: string): KbEntry[] {
  const q = fold(query.trim());
  if (!q) return [...entries];
  return entries.filter((e) => fold(`${e.title}\n${e.body}`).includes(q));
}

/** Absolute path of an entry asset, or null when the relative path escapes the
 *  entry's own directory — the HTTP route must never serve outside kb/entries/<id>/. */
export function kbAssetPath(id: string, rel: string): string | null {
  const dir = path.join(ENTRIES_DIR, id);
  const abs = path.resolve(dir, rel);
  return abs.startsWith(dir + path.sep) ? abs : null;
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function inline(s: string): string {
  return escHtml(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/**
 * Render the deliberately small KB markdown subset (documented in kb/README.md):
 * "## " headings, paragraphs, "- " and "1. " lists, **bold**, block-level images.
 * Relative image srcs resolve against assetBase (the session-gated /admin/kb/ route).
 */
export function renderKbBody(body: string, assetBase: string): string {
  const blocks = body.split(/\n\s*\n/);
  const out: string[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines[0].startsWith("## ")) {
      out.push(`<h3>${inline(lines[0].slice(3))}</h3>`);
      lines.shift();
      if (!lines.length) continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(lines[0]);
    if (img && lines.length === 1) {
      const src = /^(?:https?:)?\//.test(img[2]) ? img[2] : assetBase + img[2];
      out.push(
        `<figure style="margin:14px 0"><img src="${escHtml(src)}" alt="${escHtml(img[1])}" loading="lazy"></figure>`,
      );
      continue;
    }
    if (lines.every((l) => l.startsWith("- "))) {
      out.push(`<ul>${lines.map((l) => `<li>${inline(l.slice(2))}</li>`).join("")}</ul>`);
      continue;
    }
    if (lines.every((l) => /^\d+\.\s/.test(l))) {
      out.push(`<ol>${lines.map((l) => `<li>${inline(l.replace(/^\d+\.\s/, ""))}</li>`).join("")}</ol>`);
      continue;
    }
    out.push(`<p>${inline(lines.join(" "))}</p>`);
  }
  return out.join("");
}
