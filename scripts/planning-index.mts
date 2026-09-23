// ⭐⭐ A KÖZÖS DOKSIK GENERÁLT INDEXE — ADR-nként külön fájl, és a két index SOHA nem kézi.
//
// A MÉRT KIVÁLTÓ (2026-09-22). Egy szál egyetlen este HÁROMSZOR nem tudott landolni ugyanazzal
// a dokumentum-blokkal: kétszer az ADR-szám csúszott el (a foglalás íráskor történik, de csak a
// push véglegesíti — köztük 10–20 perc kapu-futás), a harmadik körben SZABAD szám mellett is
// elbukott a rebase, mert mindketten ugyanannak a fájlnak a VÉGÉRE fűztünk (`INDEX.md`).
// Terhelés az origin/main-en: 12 ADR / 24 óra, 16 commit a `DECISIONS.md`-re, 17 az `INDEX.md`-re.
// És az ütközés nem mindig derült ki: az `ADR-0033` két különböző döntés, mindkettő beolvadt.
//
// ── A SZERKEZET ────────────────────────────────────────────────────────────────────────────
//   `_planning/decisions/NNNN-slug.md`  — EGY ADR = EGY fájl. Külön fájlok nem ütköznek.
//   `_planning/decisions/README.md`     — a döntési napló preambuluma (az index feje).
//   `_planning/DECISIONS.md`            — GENERÁLT rövid index (szám · cím · link), újabb elöl.
//   `_planning/memory/INDEX.md`         — GENERÁLT: minden jegyzet első `# ` címéből.
// ⭐ Amit senki nem szerkeszt, az nem tud ütközni: a két index ütközését a `land.sh` a
//    `rebase-resolve` paranccsal ÚJRAGENERÁLÁSSAL oldja fel.
//
// ── PARANCSOK ──────────────────────────────────────────────────────────────────────────────
//   build                 a két index újraírása a forrásokból
//   check [--staged]      frissesség + duplikált ADR-szám + fájlnév↔fejléc egyezés (kapu)
//   next                  a következő szabad ADR-szám (origin/main ÉS a munkafa alapján)
//   split <legacy.md>     EGYSZERI migráció: a régi egyfájlos napló szétdarabolása
//   verify-split <legacy> a darabolás BÁJTRA hű-e (minden blokk ↔ pontosan egy fájl)
//   rebase-resolve        a land hívja rebase-konfliktusban; 0 = feloldva, 2 = nem az övé,
//                         1 = HANGOS megállás (emberi döntés kell)
//
// ⛔ A MIGRÁCIÓ ÁTMENETE. A migráció landolásakor futó szálak a RÉGI, egyfájlos `DECISIONS.md`-t
//    szerkesztik. A rebase-ük ütközik, és egy vak újragenerálás a szerkesztésüket NÉMÁN eldobná.
//    Ezért a `rebase-resolve` a visszajátszott commit régi-alakú változását BLOKK-SZINTEN átviszi
//    a megfelelő ADR-fájlba — és megáll, ha ugyanazt az ADR-t a main is módosította közben.

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const DEC_DIR_REL = "_planning/decisions";
const DEC_INDEX_REL = "_planning/DECISIONS.md";
const DEC_HEADER_REL = `${DEC_DIR_REL}/README.md`;
const MEM_DIR_REL = "_planning/memory";
const MEM_INDEX_REL = `${MEM_DIR_REL}/INDEX.md`;
const GENERATED = [DEC_INDEX_REL, MEM_INDEX_REL];

// The one KNOWN duplicate on main: two different decisions both numbered 0033. Renumbering the
// later one is an owner decision (2026-09-23: "később rendezzük, most megjelölöm"). Every OTHER
// duplicate fails the gate. Remove the entry once the owner has decided.
const KNOWN_DUPLICATES = new Set(["ADR-0033"]);

const HEADING_RE = /^## (ADR-(\d{4})(\/b| utószál)?) — (.+)$/;
const ADR_FILE_RE = /^(\d{4})(-b|-utoszal)?-[a-z0-9-]+\.md$/;
const GENERATED_MARK = "<!-- GENERÁLT FÁJL (scripts/planning-index.mts build) — ne szerkeszd kézzel. -->";

// ── Sources: the working tree, or the git index (the STAGED content — what a commit carries).
interface Source {
  list(dirRel: string): string[]; // file names directly inside dirRel
  read(rel: string): string | null;
}

const worktreeSource: Source = {
  list(dirRel) {
    const abs = path.join(ROOT, dirRel);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
  },
  read(rel) {
    const abs = path.join(ROOT, rel);
    return fs.existsSync(abs) ? fs.readFileSync(abs, "utf8") : null;
  },
};

function stagedSource(): Source {
  const out = execFileSync("git", ["ls-files", "-s", "-z", "--", DEC_DIR_REL, MEM_DIR_REL, DEC_INDEX_REL], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 << 20,
  });
  const blobs = new Map<string, string>(); // rel -> sha
  for (const rec of out.split("\0")) {
    if (!rec) continue;
    const m = /^\d+ ([0-9a-f]+) (\d)\t(.+)$/.exec(rec);
    if (m && m[2] === "0") blobs.set(m[3], m[1]);
  }
  // One `git cat-file --batch` for all blobs instead of ~420 processes.
  const shas = [...new Set(blobs.values())];
  const res = spawnSync("git", ["cat-file", "--batch"], { cwd: ROOT, input: shas.join("\n") + "\n", maxBuffer: 256 << 20 });
  if (res.status !== 0) throw new Error("git cat-file --batch failed");
  const buf = res.stdout;
  const bySha = new Map<string, string>();
  let off = 0;
  while (off < buf.length) {
    const nl = buf.indexOf(10, off);
    const [sha, , size] = buf.subarray(off, nl).toString("utf8").split(" ");
    const len = Number(size);
    bySha.set(sha, buf.subarray(nl + 1, nl + 1 + len).toString("utf8"));
    off = nl + 1 + len + 1;
  }
  return {
    list(dirRel) {
      const pre = dirRel + "/";
      return [...blobs.keys()].filter((r) => r.startsWith(pre) && !r.slice(pre.length).includes("/")).map((r) => r.slice(pre.length));
    },
    read(rel) {
      const sha = blobs.get(rel);
      return sha === undefined ? null : (bySha.get(sha) ?? null);
    },
  };
}

// ── Legacy (single-file) log parsing ────────────────────────────────────────────────────────
interface LegacyBlock {
  label: string; // "ADR-0036/b"
  key: string; // label + "#" + occurrence (0033 occurs twice)
  raw: string; // exact bytes from heading to the next heading
  content: string; // raw minus the trailing separator/blank lines, ending in exactly one \n
}

export function isLegacy(text: string): boolean {
  return /^## ADR-\d{4}/m.test(text);
}

// The trailing `---` separator and blank lines belong to the LOG, not to the decision. Anything
// else in the tail is content — and trimming it would be a silent loss, so it throws.
export function normalizeBlock(raw: string): string {
  const lines = raw.split("\n");
  while (lines.length && /^(---)?\s*$/.test(lines[lines.length - 1])) lines.pop();
  const content = lines.join("\n") + "\n";
  const tail = raw.slice(content.length - 1);
  if (!raw.startsWith(content.slice(0, -1)) || !/^(\s|---)*$/.test(tail)) {
    throw new Error("normalizeBlock: a levágott vég nem csak elválasztó — tartalomvesztés lenne");
  }
  return content;
}

export function parseLegacy(text: string): { preamble: string; blocks: LegacyBlock[] } {
  const starts: number[] = [];
  const re = /^## ADR-/gm;
  for (let m = re.exec(text); m; m = re.exec(text)) starts.push(m.index);
  const preamble = starts.length ? text.slice(0, starts[0]) : text;
  const seen = new Map<string, number>();
  const blocks: LegacyBlock[] = starts.map((s, i) => {
    const raw = text.slice(s, i + 1 < starts.length ? starts[i + 1] : text.length);
    const heading = raw.slice(0, raw.indexOf("\n") === -1 ? raw.length : raw.indexOf("\n"));
    const h = HEADING_RE.exec(heading);
    if (!h) throw new Error(`ismeretlen ADR-fejléc-alak: ${heading}`);
    const n = seen.get(h[1]) ?? 0;
    seen.set(h[1], n + 1);
    return { label: h[1], key: `${h[1]}#${n}`, raw, content: normalizeBlock(raw) };
  });
  return { preamble, blocks };
}

// ── ADR file naming ─────────────────────────────────────────────────────────────────────────
export function slugify(title: string): string {
  const ascii = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii.length <= 48) return ascii || "adr";
  const cut = ascii.slice(0, 48);
  const dash = cut.lastIndexOf("-");
  return (dash > 20 ? cut.slice(0, dash) : cut).replace(/-+$/, "");
}

export function fileNameFor(content: string): string {
  const h = HEADING_RE.exec(content.slice(0, content.indexOf("\n")));
  if (!h) throw new Error("fileNameFor: nem ADR-fejléc");
  const suffix = h[3] === "/b" ? "-b" : h[3] === " utószál" ? "-utoszal" : "";
  return `${h[2]}${suffix}-${slugify(h[4])}.md`;
}

interface AdrFile {
  file: string;
  label: string;
  num: number;
  suffixed: boolean;
  title: string;
}

function readAdrFiles(src: Source, problems: string[]): AdrFile[] {
  const out: AdrFile[] = [];
  for (const file of src.list(DEC_DIR_REL).sort()) {
    if (file === "README.md") continue;
    if (!ADR_FILE_RE.test(file)) {
      problems.push(`${DEC_DIR_REL}/${file}: a fájlnév nem NNNN-slug.md alakú`);
      continue;
    }
    const text = src.read(`${DEC_DIR_REL}/${file}`) ?? "";
    const first = text.slice(0, text.indexOf("\n") === -1 ? text.length : text.indexOf("\n"));
    const h = HEADING_RE.exec(first);
    if (!h) {
      problems.push(`${DEC_DIR_REL}/${file}: az első sor nem „## ADR-NNNN — Cím" alakú`);
      continue;
    }
    const fm = ADR_FILE_RE.exec(file)!;
    const fileSuffix = fm[2] === "-b" ? "/b" : fm[2] === "-utoszal" ? " utószál" : "";
    if (fm[1] !== h[2] || fileSuffix !== (h[3] ?? "")) {
      problems.push(`${DEC_DIR_REL}/${file}: a fájlnév száma (${fm[1]}${fileSuffix}) ≠ a fejléc száma (${h[1]})`);
    }
    out.push({ file, label: h[1], num: Number(h[2]), suffixed: Boolean(h[3]), title: h[4] });
  }
  return out;
}

// ── Generators ──────────────────────────────────────────────────────────────────────────────
export function buildDecisionsIndex(src: Source, problems: string[]): string {
  const header = src.read(DEC_HEADER_REL);
  if (header === null) problems.push(`${DEC_HEADER_REL} hiányzik (a döntési napló feje)`);
  const files = readAdrFiles(src, problems);
  // Newest first; within a number the base decision precedes its /b or utószál sibling.
  files.sort((a, b) => b.num - a.num || Number(a.suffixed) - Number(b.suffixed) || a.file.localeCompare(b.file));
  const lines = files.map((f) => `- [${f.label}](decisions/${f.file}) — ${f.title}`);
  const howto = [
    "> **Hol a szöveg?** Minden ADR a SAJÁT fájljában él: `_planning/decisions/NNNN-slug.md`. Ez a lap",
    "> csak index (újabb elöl). Teljes szövegű keresés: `grep -rn \"…\" _planning/decisions/`.",
    "> **Új ADR:** `npx tsx scripts/planning-index.mts next` adja a számot → új fájl `## ADR-NNNN — Cím`",
    "> első sorral → `npx tsx scripts/planning-index.mts build`. Ezt a lapot kézzel ne szerkeszd.",
    "> **Rebase-ütközés ebben a fájlban?** (pl. a régi, egyfájlos naplóban szerkesztettél) →",
    "> `npx tsx scripts/planning-index.mts rebase-resolve` → `git rebase --continue`. A régi alakú",
    "> szerkesztésedet a saját ADR-fájljába viszi; ha ugyanazt az ADR-t a main is módosította, megáll.",
  ].join("\n");
  return `${(header ?? "").trimEnd()}\n\n${howto}\n\n${GENERATED_MARK}\n\n${lines.join("\n")}\n`;
}

function noteTitle(file: string, text: string): string {
  let body = text;
  let fmDescription = "";
  if (body.startsWith("---\n")) {
    const end = body.indexOf("\n---", 4);
    if (end !== -1) {
      fmDescription = /^description:\s*(.+)$/m.exec(body.slice(4, end))?.[1]?.trim() ?? "";
      body = body.slice(end + 4);
    }
  }
  const h1 = /^# (.+)$/m.exec(body)?.[1]?.trim();
  return (h1 || fmDescription || file.replace(/\.md$/, "")).replace(/\s+/g, " ");
}

export function buildMemoryIndex(src: Source): string {
  const notes = src.list(MEM_DIR_REL).filter((f) => f.endsWith(".md") && f !== "INDEX.md" && f !== "MEMORY.md");
  // Dated notes newest first, then the undated reference/feedback notes alphabetically.
  const dated = notes.filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f)).sort().reverse();
  const undated = notes.filter((f) => !/^\d{4}-\d{2}-\d{2}/.test(f)).sort();
  const lines = [...dated, ...undated].map((f) => `- [${f}](${f}) — ${noteTitle(f, src.read(`${MEM_DIR_REL}/${f}`) ?? "")}`);
  return [
    "# Citoviso — fejlődő vállalati memória (index)",
    "",
    "> Minden sor egy jegyzet a `_planning/memory/`-ban; a szöveg a jegyzet első `# ` címe.",
    "> **Új jegyzet: csak a fájlt írd meg** — ezt az indexet a `npx tsx scripts/planning-index.mts build`",
    "> állítja elő, és a `land.sh` ütközéskor újragenerálja. Kézzel ne fűzz a végére.",
    "",
    GENERATED_MARK,
    "",
    ...lines,
    "",
  ].join("\n");
}

function duplicateProblems(src: Source): string[] {
  const problems: string[] = [];
  const byLabel = new Map<string, string[]>();
  for (const f of readAdrFiles(src, [])) byLabel.set(f.label, [...(byLabel.get(f.label) ?? []), f.file]);
  for (const [label, files] of byLabel) {
    if (files.length > 1 && !KNOWN_DUPLICATES.has(label)) {
      problems.push(
        `DUPLIKÁLT ADR-SZÁM: ${label} ${files.length} fájlon — ${files.join(", ")}\n` +
          `     A későbbit számozd át: \`npx tsx scripts/planning-index.mts next\` adja a szabad számot; ` +
          `nevezd át a fájlt ÉS a fejlécét, és CSAK a SAJÁT hivatkozásaidat írd át (idegen ADR-hez ne nyúlj).`,
      );
    }
  }
  return problems;
}

// ── Commands ────────────────────────────────────────────────────────────────────────────────
function writeIfChanged(rel: string, text: string): boolean {
  const abs = path.join(ROOT, rel);
  if (fs.existsSync(abs) && fs.readFileSync(abs, "utf8") === text) return false;
  fs.writeFileSync(abs, text);
  return true;
}

function cmdBuild(): number {
  const problems: string[] = [];
  const dec = buildDecisionsIndex(worktreeSource, problems);
  if (problems.length) return report(problems);
  const changed = [writeIfChanged(DEC_INDEX_REL, dec), writeIfChanged(MEM_INDEX_REL, buildMemoryIndex(worktreeSource))];
  console.log(`planning-index: build kész — ${GENERATED.filter((_, i) => changed[i]).join(", ") || "nem változott semmi"}`);
  return 0;
}

function cmdCheck(staged: boolean): number {
  const src = staged ? stagedSource() : worktreeSource;
  const problems: string[] = [];
  const dec = buildDecisionsIndex(src, problems);
  if (src.read(DEC_INDEX_REL) !== dec) problems.push(`${DEC_INDEX_REL} ELAVULT vagy kézzel szerkesztett — futtasd: npx tsx scripts/planning-index.mts build`);
  if (src.read(MEM_INDEX_REL) !== buildMemoryIndex(src)) problems.push(`${MEM_INDEX_REL} ELAVULT vagy kézzel szerkesztett — futtasd: npx tsx scripts/planning-index.mts build`);
  problems.push(...duplicateProblems(src));
  if (problems.length) return report(problems);
  const n = readAdrFiles(src, []).length;
  if (n === 0) return report([`${DEC_DIR_REL}: NULLA ADR-fájl — üres halmazon a zöld hamis`]);
  console.log(`planning-index: ✅ ${n} ADR-fájl, a két index friss, nincs ismeretlen duplikátum${staged ? " (staged)" : ""}`);
  return 0;
}

function cmdNext(): number {
  const nums: number[] = [];
  for (const f of worktreeSource.list(DEC_DIR_REL)) {
    const m = ADR_FILE_RE.exec(f);
    if (m) nums.push(Number(m[1]));
  }
  const tree = spawnSync("git", ["ls-tree", "--name-only", `origin/main:${DEC_DIR_REL}`], { cwd: ROOT, encoding: "utf8" });
  if (tree.status === 0) {
    for (const f of tree.stdout.split("\n")) {
      const m = ADR_FILE_RE.exec(f);
      if (m) nums.push(Number(m[1]));
    }
  }
  // Transition: a main that still carries the single-file log numbers its ADRs in the headings.
  const legacy = spawnSync("git", ["show", `origin/main:${DEC_INDEX_REL}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  if (legacy.status === 0) for (const m of legacy.stdout.matchAll(/^## ADR-(\d{4})/gm)) nums.push(Number(m[1]));
  if (tree.status !== 0 && legacy.status !== 0) console.error("⚠️  origin/main nem olvasható (nincs fetch?) — csak a munkafa alapján számolok");
  console.log(`ADR-${String(Math.max(0, ...nums) + 1).padStart(4, "0")}`);
  console.error("⚠️  A szám a LAND pillanatáig nem végleges: közvetlenül land előtt `git fetch` és futtasd újra.");
  return 0;
}

function cmdSplit(legacyPath: string): number {
  const text = fs.readFileSync(legacyPath, "utf8");
  const { preamble, blocks } = parseLegacy(text);
  const dir = path.join(ROOT, DEC_DIR_REL);
  fs.mkdirSync(dir, { recursive: true });
  const names = new Set<string>();
  for (const b of blocks) {
    const name = fileNameFor(b.content);
    if (names.has(name)) throw new Error(`split: fájlnév-ütközés: ${name}`);
    names.add(name);
    fs.writeFileSync(path.join(dir, name), b.content);
  }
  fs.writeFileSync(path.join(ROOT, DEC_HEADER_REL), normalizeBlock(preamble));
  console.log(`planning-index: split — ${blocks.length} ADR-fájl + README.md a ${DEC_DIR_REL}/ alá`);
  return 0;
}

// Byte-level proof of the split: every legacy block has EXACTLY one file with identical content,
// no file is left over, and the preamble survived. Order-independent (the log was not monotonic).
export function verifySplit(legacyText: string, src: Source): string[] {
  const problems: string[] = [];
  const { preamble, blocks } = parseLegacy(legacyText);
  const files = new Map<string, string>();
  for (const f of src.list(DEC_DIR_REL)) if (f !== "README.md") files.set(f, src.read(`${DEC_DIR_REL}/${f}`) ?? "");
  const used = new Set<string>();
  for (const b of blocks) {
    const name = fileNameFor(b.content);
    const got = files.get(name);
    if (got === undefined) problems.push(`hiányzik: ${name} (${b.label})`);
    else if (got !== b.content) problems.push(`TARTALOM ELTÉR: ${name} (${b.label})`);
    used.add(name);
  }
  for (const f of files.keys()) if (!used.has(f)) problems.push(`többlet-fájl, nincs eredetije: ${f}`);
  if ((src.read(DEC_HEADER_REL) ?? "") !== normalizeBlock(preamble)) problems.push("a preambulum (README.md) eltér");
  if (!problems.length) console.log(`planning-index: verify-split ✅ ${blocks.length} blokk ↔ ${files.size} fájl, bájtra egyezik`);
  return problems;
}

// ── Rebase conflict resolution (called by scripts/land.sh) ─────────────────────────────────
function git(args: string[], opts: { allowFail?: boolean } = {}): string | null {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) {
    if (opts.allowFail) return null;
    throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  }
  return r.stdout;
}

// Carry a legacy-format commit's per-block changes into the per-file layout. Returns problems;
// an empty list means every change landed in exactly the file it belongs to.
export function adoptLegacyChanges(baseText: string, theirsText: string): string[] {
  const problems: string[] = [];
  const base = new Map(parseLegacy(baseText).blocks.map((b) => [b.key, b]));
  const theirs = parseLegacy(theirsText).blocks;
  const dir = path.join(ROOT, DEC_DIR_REL);
  const current = new Map<string, string>();
  for (const f of worktreeSource.list(DEC_DIR_REL)) if (f !== "README.md") current.set(f, fs.readFileSync(path.join(dir, f), "utf8"));
  const writes: [string, string][] = [];
  for (const t of theirs) {
    const b = base.get(t.key);
    base.delete(t.key);
    if (b && b.content === t.content) continue;
    if (!b) {
      const name = fileNameFor(t.content);
      if (current.has(name) && current.get(name) !== t.content) problems.push(`${t.label}: új blokk, de a ${name} fájl már létezik MÁS tartalommal`);
      else writes.push([name, t.content]);
      continue;
    }
    // Changed block: the target is the file that still holds the BASE content. If none does,
    // main changed this ADR too — two edits of one decision is a human call, not a merge.
    const target = [...current.entries()].find(([, c]) => c === b.content)?.[0];
    if (!target) {
      problems.push(`${t.label}: a szál a régi DECISIONS.md-ben módosította, de közben a mainen is változott — kézi összefésülés kell`);
      continue;
    }
    const newName = fileNameFor(t.content);
    if (newName !== target) writes.push([target, ""]); // title/number edited → rename
    writes.push([newName, t.content]);
  }
  for (const gone of base.values()) problems.push(`${gone.label}: a szál TÖRÖLTE a blokkot — törlést nem viszek át gépiesen`);
  if (problems.length) return problems;
  for (const [name, content] of writes) {
    const rel = `${DEC_DIR_REL}/${name}`;
    if (content === "") git(["rm", "-q", "--", rel]);
    else {
      fs.writeFileSync(path.join(dir, name), content);
      git(["add", "--", rel]);
    }
  }
  const adopted = writes.filter(([, c]) => c !== "").map(([n]) => n);
  if (adopted.length) console.log(`planning-index: régi alakú szerkesztés átvéve → ${adopted.join(", ")}`);
  return [];
}

function cmdRebaseResolve(): number {
  const conflicted = (git(["diff", "--name-only", "--diff-filter=U"]) ?? "").split("\n").filter(Boolean);
  if (!conflicted.length) return report(["rebase-resolve: nincs ütköző fájl — nem ez a hívás helye"]);
  const foreign = conflicted.filter((f) => !GENERATED.includes(f));
  if (foreign.length) {
    console.error(`planning-index: nem generált fájl is ütközik (${foreign.join(", ")}) — ezt nem oldom fel gépiesen`);
    return 2;
  }
  if (conflicted.includes(DEC_INDEX_REL)) {
    const ours = git(["show", `HEAD:${DEC_INDEX_REL}`], { allowFail: true }) ?? "";
    if (isLegacy(ours)) {
      return report([
        "rebase-resolve: az origin/main még a RÉGI, egyfájlos DECISIONS.md-t hordozza (a migráció nincs fent) — " +
          "futtasd újra a splitet a friss mainről, a te blokkjaiddal együtt",
      ]);
    }
    const theirs = git(["show", `REBASE_HEAD:${DEC_INDEX_REL}`], { allowFail: true }) ?? "";
    if (isLegacy(theirs) && process.env.PLANNING_INDEX_SABOTAGE !== "skip-adopt") {
      const base = git(["show", `REBASE_HEAD^:${DEC_INDEX_REL}`], { allowFail: true }) ?? "";
      const problems = adoptLegacyChanges(base, theirs);
      if (problems.length) return report(problems);
    }
  }
  const problems: string[] = [];
  const dec = buildDecisionsIndex(worktreeSource, problems);
  if (problems.length) return report(problems);
  fs.writeFileSync(path.join(ROOT, DEC_INDEX_REL), dec);
  fs.writeFileSync(path.join(ROOT, MEM_INDEX_REL), buildMemoryIndex(worktreeSource));
  git(["add", "--", ...GENERATED]);
  console.log(`planning-index: rebase-ütközés feloldva újragenerálással (${conflicted.join(", ")})`);
  return 0;
}

function report(problems: string[]): number {
  console.error("⛔ planning-index:");
  for (const p of problems) console.error(`   · ${p}`);
  return 1;
}

function main(argv: string[]): number {
  const [cmd, ...rest] = argv;
  switch (cmd) {
    case "build":
      return cmdBuild();
    case "check":
      if (rest.some((a) => a !== "--staged")) return report([`ismeretlen kapcsoló: ${rest.join(" ")}`]);
      return cmdCheck(rest.includes("--staged"));
    case "next":
      return cmdNext();
    case "split":
      if (rest.length !== 1) return report(["használat: split <régi-DECISIONS.md>"]);
      return cmdSplit(rest[0]);
    case "verify-split": {
      if (rest.length !== 1) return report(["használat: verify-split <régi-DECISIONS.md>"]);
      const problems = verifySplit(fs.readFileSync(rest[0], "utf8"), worktreeSource);
      return problems.length ? report(problems) : 0;
    }
    case "rebase-resolve":
      return cmdRebaseResolve();
    default:
      return report([`ismeretlen parancs: ${cmd ?? "(nincs)"} — build | check [--staged] | next | split | verify-split | rebase-resolve`]);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("planning-index.mts")) {
  process.exit(main(process.argv.slice(2)));
}
