// Knowledge-base doctrine gate (ADR-0045, 03-INVARIANTS §J).
//
// Default (lint) mode — wired into pre-commit NOW: structural validity of every
// kb/entries/<slug>/entry.hu.md (frontmatter fields, anchor grammar + global
// uniqueness, non-placeholder body, resolvable in-repo image refs, no external
// image URLs — §J.26).
//
// --coverage mode — goes into pre-commit together with the UI-anchor slice
// (ADR-0045 slice ②); until the views carry data-kb-anchor attributes it is red
// BY DESIGN: bijection between data-kb-anchor attributes in the admin views and
// KB entry anchors, plus the five admin tabs are mandatory coverage.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRIES_DIR = join(ROOT, "kb", "entries");
const VIEW_FILES = ["src/server/adminViews.ts", "src/server/moduleConfigViews.ts"];
const REQUIRED_ANCHORS = ["admin.overview", "admin.texts", "admin.photos", "admin.modules", "admin.account"];
const REQUIRED_FIELDS = ["id", "title", "audience", "anchors", "updated"];
const AUDIENCES = new Set(["tenant", "operator"]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ANCHOR_RE = /^[a-z]+(?:\.[a-z0-9_]+)+$/;
// A body below this is a stub, not a guide — a placeholder entry would turn the
// coverage gate green while leaving the owner without help (§J.24).
const MIN_BODY_CHARS = 400;

const coverage = process.argv.includes("--coverage");
let failures = 0;
function bad(msg: string): void {
  console.error(`  🔴 ${msg}`);
  failures++;
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } | null {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

// §J.24 label-drift corpus: a claim written as **„Label”** in an entry asserts that
// the UI shows that exact label — checked against the raw view sources, so renaming
// a button turns this gate red until the guide follows in the same commit. Plain
// „quotes” without bold are free prose (examples, labels living outside the views).
const viewSources = VIEW_FILES.map((rel) => {
  const p = join(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}).join("\n");
// Labels wrap across lines both in entries and in concatenated view strings —
// compare whitespace-normalized on both sides.
const normWs = (s: string): string => s.replace(/\s+/g, " ");
const corpus = normWs(viewSources);

const anchorOwner = new Map<string, string>();
const slugs = existsSync(ENTRIES_DIR)
  ? readdirSync(ENTRIES_DIR).filter((d) => statSync(join(ENTRIES_DIR, d)).isDirectory())
  : [];
if (!slugs.length) bad("kb/entries/ üres vagy hiányzik — legalább egy entry kell (§J.24)");

for (const slug of slugs) {
  const dir = join(ENTRIES_DIR, slug);
  if (!SLUG_RE.test(slug)) {
    bad(`${slug}: a slug nem angol kebab-case ([a-z0-9-], struktúra-rendelet)`);
    continue;
  }
  const srcPath = join(dir, "entry.hu.md");
  if (!existsSync(srcPath)) {
    bad(`${slug}: hiányzik az entry.hu.md (a magyar forrás az igazság)`);
    continue;
  }
  const parsed = parseFrontmatter(readFileSync(srcPath, "utf8"));
  if (!parsed) {
    bad(`${slug}: nincs frontmatter (--- blokk) az entry.hu.md elején`);
    continue;
  }
  const { meta, body } = parsed;
  for (const field of REQUIRED_FIELDS) if (!meta[field]) bad(`${slug}: hiányzó frontmatter-mező: ${field}`);
  if (meta.id && meta.id !== slug) bad(`${slug}: id ("${meta.id}") ≠ mappa-név`);
  if (meta.audience && !AUDIENCES.has(meta.audience)) bad(`${slug}: audience "${meta.audience}" (tenant|operator)`);
  if (meta.updated && !/^\d{4}-\d{2}-\d{2}$/.test(meta.updated)) bad(`${slug}: updated nem YYYY-MM-DD`);
  const anchors = (meta.anchors ?? "").split(",").map((a) => a.trim()).filter(Boolean);
  if (meta.anchors !== undefined && !anchors.length) bad(`${slug}: legalább egy anchor kell`);
  for (const anchor of anchors) {
    if (!ANCHOR_RE.test(anchor)) bad(`${slug}: anchor "${anchor}" nem pont-szeparált angol azonosító`);
    const owner = anchorOwner.get(anchor);
    if (owner) bad(`${slug}: anchor "${anchor}" már a(z) "${owner}" entryé (duplikátum)`);
    else anchorOwner.set(anchor, slug);
  }
  if (body.replace(/\s+/g, " ").trim().length < MIN_BODY_CHARS)
    bad(`${slug}: a törzs ${body.trim().length} karakter — placeholder-gyanús (< ${MIN_BODY_CHARS})`);
  for (const m of body.matchAll(/\*\*„([^”]+)”\*\*/g)) {
    const label = normWs(m[1]!);
    if (!corpus.includes(label))
      bad(`${slug}: a **„${label}”** felirat nincs a felületen (label-drift, §J.24)`);
  }
  for (const img of body.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
    const ref = img[1].split(/\s/)[0];
    if (/^https?:/i.test(ref)) {
      bad(`${slug}: külső képhivatkozás (${ref}) — a screenshot a repóban él (§J.26)`);
      continue;
    }
    if (!existsSync(join(dir, ref))) bad(`${slug}: törött képhivatkozás: ${ref}`);
  }
}

if (coverage) {
  // Anchors appear in the views either as literal attributes or through the
  // helpLink("…") helper (where the attribute itself is a template variable).
  const viewAnchors = new Set<string>();
  for (const m of viewSources.matchAll(/data-kb-anchor="([^"]+)"/g))
    if (!m[1]!.includes("${")) viewAnchors.add(m[1]!);
  for (const m of viewSources.matchAll(/helpLink\("([^"]+)"\)/g)) viewAnchors.add(m[1]!);
  for (const req of REQUIRED_ANCHORS)
    if (!viewAnchors.has(req)) bad(`coverage: kötelező admin-fül horgony nélkül a view-kban: ${req}`);
  for (const anchor of viewAnchors)
    if (!anchorOwner.has(anchor)) bad(`coverage: a view-beli "${anchor}" horgonyhoz nincs KB-entry (§J.24)`);
  for (const [anchor, slug] of anchorOwner)
    if (!viewAnchors.has(anchor)) bad(`coverage: a(z) "${slug}" entry "${anchor}" horgonya nincs kint a felületen — elérhetetlen súgó`);
}

if (failures) {
  console.error(`\nkb-check: 🔴 ${failures} hiba${coverage ? " (--coverage)" : ""}`);
  process.exit(1);
}
console.log(`kb-check: 🟢 ${slugs.length} entry, ${anchorOwner.size} anchor rendben${coverage ? " (+coverage)" : ""}`);
