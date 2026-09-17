// ⭐⭐ ONTOLÓGIA-FRISSESSÉG ŐR — a KÖTELEZŐEN OLVASOTT dokumentum elavulása NÉMÁN áll elő.
//
// A MÉRT LELET (2026-09-17). A `CLAUDE.md` §1 minden sessiont kötelez a `_planning/DOMAIN/`
// átolvasására domain-döntés (adatmodell, árazás, generálási szabály) előtt — vagyis ez a hat
// fájl a ház KANONIKUS IGAZSÁGA. Az automata desztilláló hetente ír egy review-t az `_inbox/`-ba
// (cron: `0 4 * * 0 … _tools/distill.sh`), amit EMBERNEK kell átvezetnie. Ez az emberi lépés
// **2026-07-12 óta egyszer sem történt meg**: mérve 9 feldolgozatlan review állt az inboxban,
// bennük 62 érdemi javaslat (PROMOTE/REFINE/DRIFT), és a `01-CALC-MODELS.md` ma reggelig a
// július 4-i, 22 soros vázban állt — miközben azóta ÉLŐ árazási motor épült (`src/pricing.ts`).
// Két hónapon át minden session két hónapos árazási modellt olvasott kötelező igazságként.
//
// ⛔ ÉS SEMMI NEM JELZETT. A `distill.sh` 6. lépése maga mondja ki: „Citoviso has no ticketing
// yet; if a notifier helper appears later, it fires" — nincs `notify.sh`, tehát a review
// leesik egy gitignore-olt könyvtárba, és ott marad. Ugyanaz a hibaosztály, amit a projekt
// memóriája így rögzít: *„a leltár-sor nem mérés, hanem egy régi mérés emléke"*.
//
// ⚠️ MIT NEM MÉR EZ AZ ŐR. Egy DOMAIN-fájl KORA önmagában NEM hiba: a `05-MODULES.md` július
// 10-e óta áll, és ha nincs róla új tudás, akkor ez helyes. A bukás feltétele ezért a KETTŐ
// EGYÜTT: van feldolgozatlan TUDÁS (érdemi javaslatot tartalmazó, párosítatlan review), ÉS
// az régóta áll. A DOMAIN-fájlok érdemi kora a LELET mellé megy — megnevezi a kárt.
//
// ⚠️ A GIT A FORRÁS, NEM AZ MTIME. Worktree-checkoutban minden fájl mtime-ja a checkout ideje
// (mérve: `_planning/DOMAIN/_inbox/applied/` ebben a fában „szept 16", a valódi commit július
// 12.). A fájl-kort tehát `git log --numstat -w` adja, és csak az ÉRDEMI (nem csak-whitespace)
// commit számít.
//
// ⛔ A KORPUSZ A FŐ FÁBAN ÉL. Az `_inbox/2026*.md` és a `.distill-manifest` GITIGNORE-OLT: a
// worktree-ben csak az üres `applied/` látszik. Egy őr, ami a saját fáját nézi, NULLA fájlt
// találna és ZÖLDET mondana — ez a legrosszabb fajta hamis zöld. Ezért a feloldás a
// `git rev-parse --git-common-dir`-ből megy a fő fához, az őr KIÍRJA, melyik utat mérte, és
// üres korpuszra SZÁNDÉKOSAN pirosra megy („0 találat = gyanú, nem siker").
//
//   npx tsx scripts/domain-inbox-freshness-check.mts              # kapu (exit 1 bukáskor)
//   npx tsx scripts/domain-inbox-freshness-check.mts --warn-only  # hangos, de sosem blokkol
//   npx tsx scripts/domain-inbox-freshness-check.mts --self-test  # piros ág + negatív kontroll
//   npx tsx scripts/domain-inbox-freshness-check.mts --inbox=<dir>

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ARGV = process.argv.slice(2);
const SELF_TEST = ARGV.includes("--self-test");
const WARN_ONLY = ARGV.includes("--warn-only");
const INBOX_ARG = ARGV.find((a) => a.startsWith("--inbox="))?.slice("--inbox=".length);

// ── KÜSZÖBÖK ─────────────────────────────────────────────────────────────────────────────
// Egyik sem önkényes; mindegyik alatt ott a mérés, amiből származik.
//
// CYCLE: a desztilláló HETI (crontab: `0 4 * * 0 … distill.sh`). Egy ciklus = 7 nap.
//
// WARN (> 1 ciklus): ha egy review-t nem vezettek át, mielőtt a KÖVETKEZŐ megérkezett, a
//   sor elkezdett nőni. Ez még nem adósság, csak az első jel.
//
// FAIL (> 3 ciklus = 21 nap): a projekt EGYETLEN dokumentált átvezetése 2026-07-12-én történt
//   (cef6736 + 5dc79a3), és a 20260704 / 20260705 / 20260712 review-kat vezette át — vagyis a
//   legrosszabb EGÉSZSÉGES átfutás 8 nap volt. A 21 nap ennek 2,6-szerese és 3 teljes ciklus:
//   olyan ritmusra, amit ez a projekt valaha demonstrált, SOHA nem tüzelne (2026-07-12-én a
//   legrégebbi feldolgozatlan 8 napos volt → zöld). A mai állapot ezzel szemben 60 napos.
const CYCLE_DAYS = 7;
const WARN_DAYS = 7;
const FAIL_DAYS = 21;

// Egy review-fájl neve a desztillálóból: `date -u +%Y%m%dT%H%M%SZ` + `.md`.
const REVIEW_NAME = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.md$/;
// Az applied/ példány neve tartalmazhat utólagos toldalékot; a bélyeg a horgony.
const STAMP_IN_NAME = /(\d{8}T\d{6}Z)/;
const MARK = "\u0001"; // git-log rekord-jelölő (látható escape — a nyers vezérlőkarakter forrásban törékeny)
const SECTION = /^##\s+(SUMMARY|PROMOTE|REFINE|DRIFT|SKIP|ARCHIVE)\b/;
const ACTIONABLE_SECTIONS = new Set(["PROMOTE", "REFINE", "DRIFT"]);
// A javaslat-fejléc rendszerint megnevezi a cél-fájlt: `### 03-INVARIANTS.md → §B …`
const TARGET_FILE = /\b(\d\d-[A-Z0-9-]+\.md)\b/;
// ⛔ FAIL-CLOSED HATÁR. A 401-es hibára futott desztillálás 113 bájtos, szekció NÉLKÜLI fájlt
// hagyott (`applied/20260705T020001Z.md`) — abban nincs elveszett tudás. A legkisebb VALÓDI
// review 3 829 bájt (20260816). Az 1 000 bájt a kettő közé esik: ami ennél NAGYOBB és mégsem
// ismerünk fel benne szekciót, az nem „üres", hanem ISMERETLEN FORMÁTUM → érdemi, fail-closed.
const EMPTY_RUN_MAX_BYTES = 1000;

let pass = 0;
const fails: string[] = [];
const warns: string[] = [];
function check(ok: boolean, name: string, detail = ""): void {
  if (ok) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const DAY_MS = 86_400_000;
const ageDays = (iso: string, now: number): number => Math.floor((now - Date.parse(iso)) / DAY_MS);

// ── 1. HOL A KORPUSZ ─────────────────────────────────────────────────────────────────────

export interface InboxLocation {
  readonly dir: string;
  readonly how: string;
  /** a SECOND corpus that also holds reviews — ambiguity we refuse to resolve silently */
  readonly alsoAt?: string;
}

/** Does this directory hold at least one review-looking `*.md` in its root? */
function hasReviewsFs(dir: string): boolean {
  try {
    return readdirSync(dir, { withFileTypes: true }).some((e) => e.isFile() && e.name.endsWith(".md"));
  } catch {
    return false;
  }
}

/** The shared main tree, via git's COMMON dir — right from every worktree, no hardcoded $HOME. */
function mainTreeInboxGit(root: string): string | null {
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const shared = path.join(path.dirname(common), "_planning/DOMAIN/_inbox");
    return existsSync(shared) ? shared : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the inbox. Order matters: an explicit override wins, then this tree (the main tree
 * case), then the shared main tree via git's COMMON dir — which is the one path that is right
 * from every worktree without hardcoding a home directory.
 */
export interface InboxProbe {
  readonly hasReviews: (dir: string) => boolean;
  readonly mainTreeInbox: (root: string) => string | null;
}

export function resolveInbox(root: string, override?: string, probe?: InboxProbe): InboxLocation {
  const hasReviews = probe?.hasReviews ?? hasReviewsFs;
  const mainTreeInbox = probe?.mainTreeInbox ?? mainTreeInboxGit;
  if (override) return { dir: path.resolve(override), how: "--inbox/DOMAIN_INBOX_DIR felülírás" };
  const here = path.join(root, "_planning/DOMAIN/_inbox");
  const shared = mainTreeInbox(root);
  // ⛔ KÉT KORPUSZ. Ma a worktree-ben csak az üres `applied/` van, tehát a fő fa nyer. De ha
  // valaki egyszer BECOMMITOL egy review-t a repó `_inbox/` gyökerébe, a „itt vannak" ág
  // nyerne, és a FŐ FA 9 feldolgozatlan review-ja NÉMÁN kiesne a mérésből. A kétértelműséget
  // nem találgatjuk el: kimondjuk.
  if (hasReviews(here)) {
    const alsoAt = shared && shared !== here && hasReviews(shared) ? shared : undefined;
    return { dir: here, how: "ez a fa (a review-k itt vannak)", alsoAt };
  }
  if (shared) {
    return { dir: shared, how: `fő fa (git-common-dir → ${path.dirname(path.dirname(path.dirname(shared)))})` };
  }
  return { dir: here, how: "ez a fa (fő fa nem volt feloldható)" };
}

// ── 2. MI VAN BENNE ──────────────────────────────────────────────────────────────────────

export interface Review {
  readonly file: string;
  readonly stamp: string;
  readonly iso: string;
  readonly bytes: number;
  /** PROMOTE/REFINE/DRIFT `###` headings — the knowledge that would be lost */
  readonly suggestions: number;
  /** DOMAIN files those headings name */
  readonly targets: readonly string[];
  /** no recognised section AND big enough to be a real review ⇒ unknown format, fail-closed */
  readonly unparsed: boolean;
}

export function parseReview(file: string, text: string): Omit<Review, "file"> | null {
  const m = REVIEW_NAME.exec(path.basename(file));
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  let section = "";
  let sectionsSeen = 0;
  let suggestions = 0;
  const targets = new Set<string>();
  for (const line of text.split("\n")) {
    const sec = SECTION.exec(line);
    if (sec) {
      section = sec[1];
      sectionsSeen++;
      continue;
    }
    if (!/^###\s+\S/.test(line)) continue;
    if (!ACTIONABLE_SECTIONS.has(section)) continue;
    suggestions++;
    const t = TARGET_FILE.exec(line);
    if (t) targets.add(t[1]);
  }
  const bytes = Buffer.byteLength(text);
  return {
    stamp: `${y}${mo}${d}T${h}${mi}${s}Z`,
    iso: `${y}-${mo}-${d}T${h}:${mi}:${s}Z`,
    bytes,
    suggestions,
    targets: [...targets].sort(),
    unparsed: sectionsSeen === 0 && bytes > EMPTY_RUN_MAX_BYTES,
  };
}

export interface Corpus {
  readonly pending: readonly Review[];
  readonly appliedStamps: ReadonlySet<string>;
  /** every `*.md` in the inbox root that the name-recogniser did NOT accept */
  readonly unrecognised: readonly string[];
  /** newest review anywhere (pending ∪ applied), by stamp */
  readonly newestStamp: string | null;
  readonly totalSeen: number;
}

/** `applied/` may exist in BOTH trees (it is committed); a stamp in either one means landed. */
export function readCorpus(inboxDir: string, extraAppliedDirs: readonly string[]): Corpus {
  const appliedStamps = new Set<string>();
  const stampDays: string[] = [];
  for (const dir of [path.join(inboxDir, "applied"), ...extraAppliedDirs]) {
    if (!existsSync(dir)) continue;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith(".md")) continue;
      const st = STAMP_IN_NAME.exec(e.name);
      if (!st) continue;
      appliedStamps.add(st[1]);
      stampDays.push(st[1]);
    }
  }
  const pending: Review[] = [];
  const unrecognised: string[] = [];
  let totalSeen = appliedStamps.size;
  if (existsSync(inboxDir)) {
    for (const e of readdirSync(inboxDir, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith(".md")) continue;
      const full = path.join(inboxDir, e.name);
      const parsed = parseReview(full, readFileSync(full, "utf8"));
      if (!parsed) {
        unrecognised.push(e.name);
        continue;
      }
      totalSeen++;
      stampDays.push(parsed.stamp);
      if (appliedStamps.has(parsed.stamp)) continue;
      pending.push({ file: e.name, ...parsed });
    }
  }
  pending.sort((a, b) => a.stamp.localeCompare(b.stamp));
  stampDays.sort();
  return {
    pending,
    appliedStamps,
    unrecognised,
    newestStamp: stampDays.length ? stampDays[stampDays.length - 1] : null,
    totalSeen,
  };
}

// ── 3. MILYEN IDŐS A DOMAIN ──────────────────────────────────────────────────────────────

export interface DomainAge {
  readonly file: string;
  readonly iso: string | null;
  readonly sha: string;
  readonly churn: number;
}

/**
 * Last SUBSTANTIVE commit per DOMAIN doc, from git — never mtime (see the header).
 * "Substantive" = the commit actually changed content with whitespace ignored (`-w`); a pure
 * reformat or a date-bump must not make a two-month-old doc look fresh.
 */
export function domainAges(root: string): DomainAge[] {
  const dir = path.join(root, "_planning/DOMAIN");
  const out: DomainAge[] = [];
  for (const f of readdirSync(dir).filter((f) => /^\d\d-.*\.md$/.test(f)).sort()) {
    const rel = `_planning/DOMAIN/${f}`;
    let log = "";
    try {
      log = execFileSync(
        "git",
        ["log", "--format=" + MARK + "%h %cI", "--numstat", "-w", "--", rel],
        { cwd: root, encoding: "utf8", maxBuffer: 8 << 20 },
      );
    } catch {
      /* file not tracked yet */
    }
    let sha = "";
    let iso: string | null = null;
    let churn = 0;
    for (const line of log.split("\n")) {
      if (line.startsWith(MARK)) {
        if (iso && churn > 0) break;
        const [h, when] = line.slice(MARK.length).split(" ");
        sha = h ?? "";
        iso = when ?? null;
        churn = 0;
        continue;
      }
      const n = /^(\d+)\t(\d+)\t/.exec(line);
      if (n) churn += Number(n[1]) + Number(n[2]);
    }
    out.push({ file: f, iso: churn > 0 ? iso : null, sha: churn > 0 ? sha : "", churn });
  }
  return out;
}

// ── 4. AZ ÍTÉLET ─────────────────────────────────────────────────────────────────────────

export interface Verdict {
  readonly overdue: readonly Review[];
  readonly warned: readonly Review[];
  readonly emptyRuns: readonly Review[];
  readonly suggestions: number;
  readonly oldestAge: number | null;
  readonly structural: readonly string[];
}

/**
 * The failing conjunction, spelled out: a review is a FAILURE only when it is (a) unpaired,
 * (b) carries actual knowledge (an actionable heading, or an unknown format we refuse to
 * assume is empty), and (c) has been standing longer than FAIL_DAYS. Age alone never fails —
 * that is why an untouched 05-MODULES.md is not a finding.
 */
export function judge(corpus: Corpus, now: number): Verdict {
  const structural: string[] = [];
  if (corpus.totalSeen === 0) {
    structural.push(
      "0 review-t találtam SEHOL (sem az inboxban, sem az applied/-ban) — a felismerő vagy az útvonal hibás. A 0 találat GYANÚ, nem siker.",
    );
  }
  for (const u of corpus.unrecognised) {
    structural.push(`ISMERETLEN NEVŰ fájl az inboxban: ${u} — a névfelismerő nem fogadta el, tehát NEM mértem. Nevezd át \`YYYYMMDDTHHMMSSZ.md\` alakra, vagy vidd ki.`);
  }
  const overdue: Review[] = [];
  const warned: Review[] = [];
  const emptyRuns: Review[] = [];
  let suggestions = 0;
  for (const r of corpus.pending) {
    const knowledge = r.suggestions > 0 || r.unparsed;
    suggestions += r.suggestions;
    if (!knowledge) {
      emptyRuns.push(r);
      continue;
    }
    const age = ageDays(r.iso, now);
    if (age > FAIL_DAYS) overdue.push(r);
    else if (age > WARN_DAYS) warned.push(r);
  }
  const oldest = [...overdue, ...warned][0];
  return {
    overdue,
    warned,
    emptyRuns,
    suggestions,
    oldestAge: oldest ? ageDays(oldest.iso, now) : null,
    structural,
  };
}

// ── 5. FUTÁS ─────────────────────────────────────────────────────────────────────────────

function run(): void {
  const now = Date.now();
  const loc = resolveInbox(ROOT, INBOX_ARG ?? process.env.DOMAIN_INBOX_DIR);
  const corpus = readCorpus(loc.dir, [path.join(ROOT, "_planning/DOMAIN/_inbox/applied")]);
  const verdict = judge(corpus, now);

  console.log(`inbox: ${loc.dir}`);
  console.log(`   feloldás: ${loc.how}`);
  if (loc.alsoAt) {
    fails.push(
      `KÉT KORPUSZ: review-k a mért ${loc.dir} mellett a ${loc.alsoAt} alatt is vannak — az egyik halmazt NEM mértem. Döntsd el, melyik a ledger, és vidd egy helyre.`,
    );
  }
  console.log(
    `korpusz: ${corpus.totalSeen} review összesen · ${corpus.appliedStamps.size} átvezetve · ${corpus.pending.length} feldolgozatlan · ${verdict.suggestions} érdemi javaslat (PROMOTE/REFINE/DRIFT)`,
  );
  console.log(`küszöb: > ${WARN_DAYS} nap ⚠️ · > ${FAIL_DAYS} nap ⛔ (a desztilláló ${CYCLE_DAYS} naponta fut)`);

  for (const s of verdict.structural) fails.push(s);
  check(corpus.totalSeen > 0, "a felismerő talált review-kat", `${corpus.totalSeen} db`);
  check(corpus.unrecognised.length === 0, "minden inbox-fájl felismert alakú", corpus.unrecognised.join(", "));

  // A DOMAIN-fájlok kora — a LELET mellé, nem helyette. Önmagában sosem bukik.
  // ⭐ EZ A „KETTŐ EGYÜTT" SORA. Nem az a lelet, hogy egy fájl RÉGI (a 05-MODULES.md 68 napos,
  // és ez rendben van) — hanem hogy függő tudás céloz rá, ÉS azóta egyetlen érdemi commitot
  // sem kapott. Ez az az állapot, amiben a session elavult kötelező igazságot olvas.
  const ages = domainAges(ROOT);
  const targeted = new Map<string, { n: number; oldest: string }>();
  for (const r of [...verdict.overdue, ...verdict.warned]) {
    for (const t of r.targets) {
      const cur = targeted.get(t);
      targeted.set(t, { n: (cur?.n ?? 0) + 1, oldest: cur?.oldest ?? r.iso });
    }
  }
  console.log("\nDOMAIN-fájlok — utolsó ÉRDEMI módosítás (git, NEM mtime):");
  for (const a of ages) {
    const age = a.iso ? `${ageDays(a.iso, now)} napja (${a.iso.slice(0, 10)}, ${a.sha})` : "NINCS commitolt érdemi változás";
    const t = targeted.get(a.file);
    let tail = "";
    if (t) {
      const untouched = !a.iso || Date.parse(a.iso) < Date.parse(t.oldest);
      tail = `  ← ${t.n} függő review céloz rá${untouched ? ` ⚠️ és a legrégebbi (${t.oldest.slice(0, 10)}) ÓTA SEM kapott érdemi commitot` : ""}`;
    }
    console.log(`   ${a.file.padEnd(20)} ${age}${tail}`);
  }

  // Csővezeték-életjel: ez WARN, nem kapu. A `distill.sh` szándékosan NEM ír fájlt, ha nem volt
  // új memória ("no new or changed memories … nothing to distill"), tehát egy csendes hét
  // legitim — de két kihagyott ciklus után már a desztilláló halálát is jelentheti, és pont ezt
  // nem venné észre senki.
  if (corpus.newestStamp) {
    const iso = `${corpus.newestStamp.slice(0, 4)}-${corpus.newestStamp.slice(4, 6)}-${corpus.newestStamp.slice(6, 8)}T00:00:00Z`;
    const age = ageDays(iso, now);
    if (age > 2 * CYCLE_DAYS) {
      warns.push(
        `a LEGÚJABB review is ${age} napos (${corpus.newestStamp}) — vagy nem futott a desztilláló, vagy nem volt új memória. Napló: ~/.claude/distill-citoviso.log`,
      );
    }
  }
  try {
    const cron = execFileSync("crontab", ["-l"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    if (!/distill\.sh/.test(cron)) {
      warns.push("a crontabban NINCS `distill.sh` sor — a desztilláló ezen a gépen nincs ütemezve (új review sosem születik).");
    }
  } catch {
    /* no crontab on this machine — not this guard's business */
  }

  if (verdict.emptyRuns.length) {
    console.log(
      `\nℹ️  ${verdict.emptyRuns.length} feldolgozatlan review NEM tartalmaz érdemi javaslatot (üres/hibára futott desztillálás) — ezek nem blokkolnak: ${verdict.emptyRuns.map((r) => r.file).join(", ")}`,
    );
  }
  for (const r of verdict.warned) {
    warns.push(`${r.file} — ${ageDays(r.iso, now)} napja áll, ${r.suggestions} javaslattal (még a ${FAIL_DAYS} napos küszöb alatt)`);
  }

  if (verdict.overdue.length) {
    const oldest = verdict.overdue[0];
    const total = verdict.overdue.reduce((n, r) => n + r.suggestions, 0);
    fails.push(
      `FELDOLGOZATLAN ONTOLÓGIA-TUDÁS ÁLL: ${verdict.overdue.length} review, ${total} érdemi javaslat; a legrégebbi ${oldest.file} ${ageDays(oldest.iso, now)} napja (küszöb ${FAIL_DAYS} nap = ${FAIL_DAYS / CYCLE_DAYS} desztillációs ciklus)`,
    );
    console.log("\n⛔ Feldolgozatlan review-k (a legrégebbitől):");
    for (const r of verdict.overdue) {
      console.log(
        `   · ${r.file}  ${String(ageDays(r.iso, now)).padStart(3)} napja · ${r.suggestions} javaslat${r.unparsed ? " · ⛔ ISMERETLEN FORMÁTUM (fail-closed: érdeminek veszem)" : ""}${r.targets.length ? ` · cél: ${r.targets.join(", ")}` : ""}`,
      );
    }
    console.log("\n   FUTTATHATÓ KÖVETKEZŐ LÉPÉS (a legrégebbivel kezdd):");
    console.log(`     1. less ${path.join(loc.dir, oldest.file)}`);
    console.log("     2. vezesd át a PROMOTE/REFINE/DRIFT blokkokat a _planning/DOMAIN/*.md-be (a DRIFT ember-döntés!)");
    console.log(`     3. cp ${path.join(loc.dir, oldest.file)} _planning/DOMAIN/_inbox/applied/ && rm ${path.join(loc.dir, oldest.file)}`);
    console.log("     4. git add _planning/DOMAIN/…  (tételesen — ⛔ soha `git add .`)");
    // Mérve 2026-09-17, MENET KÖZBEN: egy párhuzamos szál felzárkóztatta a 00-GLOSSARY-t és a
    // 02-ENTITY-MAP-ot (04f6283), de a review-k az inboxban maradtak — az őr helyesen PIROS
    // maradt. A ledger az `applied/`, nem a dokumentum; enélkül a piros bennragad, és egy
    // bennragadt piros pontosan olyan haszontalan, mint a néma zöld (mindenki megtanulja átugrani).
    console.log(
      "   ⚠️  A DOMAIN-fájlok SZERKESZTÉSE önmagában NEM teszi zölddé: a ledger az `applied/`.\n" +
        "       A 3. lépés (áthelyezés + commit) nélkül ez a kapu bennragad pirosban.",
    );
  }

  for (const w of warns) console.log(`⚠️  ${w}`);
  const red = fails.length > 0;
  console.log(
    `\n${red ? (WARN_ONLY ? "⚠️ " : "❌") : "✅"} domain-inbox-freshness: ${pass} állítás zöld, ${fails.length} piros${WARN_ONLY && red ? " (--warn-only: NEM blokkol, de ez ADÓSSÁG)" : ""}`,
  );
  for (const f of fails) console.error(`  ✗ ${f}`);
  if (WARN_ONLY) {
    if (red) {
      console.error("  ⚠️  A land nem áll meg emiatt — de a `_planning/DOMAIN/` MA nem mondja az igazat, és ezt minden session kötelezően olvassa.");
    }
    process.exit(0);
  }
  process.exit(red ? 1 : 0);
}

// ── 6. PIROS ÖNTESZT + NEGATÍV KONTROLL ─────────────────────────────────────────────────
// Szintetikus inboxon fut, saját eldobható könyvtárban (mkdtemp — a KÖZÖS `assets/Temp`-be
// ez az őr nem ír, lásd guard-scratch-scope-check). A csupa-zöld nem bizonyíték: az őr akkor
// ér valamit, ha a PIROS ág tényleg piros ÉS a ZÖLD ág tényleg zöld.
function selfTest(): void {
  const REAL = "# Distill review — X\n\n## SUMMARY\nizé\n\n## PROMOTE\n### 01-CALC-MODELS.md → §2\nblabla\n\n## REFINE\n### 03-INVARIANTS.md → §D\nblabla\n\n## SKIP\n### valami már fedve\n";
  const dir = mkdtempSync(path.join(tmpdir(), "cit-domain-inbox-"));
  const now = Date.parse("2026-09-17T12:00:00Z");
  const day = (n: number) => {
    const d = new Date(now - n * DAY_MS);
    const p = (x: number) => String(x).padStart(2, "0");
    return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T020001Z`;
  };
  const scenario = (files: Record<string, string>, applied: string[] = []): Verdict => {
    const s = mkdtempSync(path.join(dir, "s-"));
    execFileSync("mkdir", ["-p", path.join(s, "applied")]);
    for (const [n, c] of Object.entries(files)) writeFileSync(path.join(s, n), c);
    for (const n of applied) writeFileSync(path.join(s, "applied", n), REAL);
    return judge(readCorpus(s, []), now);
  };

  const cases: [string, boolean, () => boolean][] = [
    [
      "a BEJELENTETT alak: 60 napos, párosítatlan, érdemi review → PIROS",
      true,
      () => scenario({ [`${day(60)}.md`]: REAL }).overdue.length === 1,
    ],
    [
      "és a javaslatokat meg is SZÁMOLJA (2 = PROMOTE+REFINE, a SKIP nem számít)",
      true,
      () => scenario({ [`${day(60)}.md`]: REAL }).overdue[0]?.suggestions === 2,
    ],
    [
      "⛔ ISMERETLEN FORMÁTUM (nagy fájl, 0 felismert szekció) → fail-closed PIROS",
      true,
      () => scenario({ [`${day(60)}.md`]: "x".repeat(5000) }).overdue.length === 1,
    ],
    [
      "(kontroll) MINDEN ÁTVEZETVE — ugyanaz a review az applied/-ban → ZÖLD",
      false,
      () => {
        const v = scenario({ [`${day(60)}.md`]: REAL }, [`${day(60)}.md`]);
        return v.overdue.length > 0 || v.warned.length > 0;
      },
    ],
    [
      "(kontroll) FRISS review (2 napos, még senki nem ért rá) → ZÖLD",
      false,
      () => {
        const v = scenario({ [`${day(2)}.md`]: REAL });
        return v.overdue.length > 0 || v.warned.length > 0;
      },
    ],
    [
      "(kontroll) 10 napos → csak ⚠️ WARN, NEM piros (a sor nőni kezdett, de még nem adósság)",
      false,
      () => {
        const v = scenario({ [`${day(10)}.md`]: REAL });
        return v.overdue.length > 0 || v.warned.length !== 1;
      },
    ],
    [
      "(kontroll) HIBÁRA FUTOTT desztillálás (113 bájt, 401) 60 naposan sem blokkol",
      false,
      () => {
        const v = scenario({ [`${day(60)}.md`]: "# Distill review — X\n\nFailed to authenticate. API Error: 401\n" });
        return v.overdue.length > 0 || v.emptyRuns.length !== 1;
      },
    ],
    [
      "ÜRES KORPUSZ (0 fájl sehol) → PIROS, mert a 0 találat gyanú, nem siker",
      true,
      () => scenario({}).structural.length === 1,
    ],
    [
      "IDEGEN NEVŰ fájl az inboxban → PIROS (a szűk felismerő nem nyelheti el némán)",
      true,
      () => scenario({ "review-3.md": REAL }).structural.some((s) => s.includes("review-3.md")),
    ],
    [
      "(kontroll) az applied/ TOLDALÉKOS példánya is párosít (…Z-applied.md)",
      false,
      () => {
        const v = scenario({ [`${day(60)}.md`]: REAL }, [`${day(60)}-applied.md`]);
        return v.overdue.length > 0;
      },
    ],
  ];

  console.log("── piros önteszt + negatív kontroll ──");
  let ok = 0;
  for (const [name, wantRed, fn] of cases) {
    const got = fn();
    const good = got === wantRed;
    console.log(`  ${good ? (wantRed ? "🔴 elkapva" : "🟢 átengedve") : "⚪ HIBÁS"} — ${name}`);
    if (good) ok++;
    else fails.push(`ÖNTESZT: ${name}`);
  }
  console.log(`önteszt: ${ok}/${cases.length}`);
  rmSync(dir, { recursive: true, force: true });

  // ── ÚTVONAL-FELOLDÁS. A legdrágább hamis zöld az lenne, ha rossz könyvtárat mérnénk.
  const probe = (hereHas: boolean, shared: string | null, sharedHas: boolean): InboxProbe => ({
    hasReviews: (d) => (shared && d === shared ? sharedHas : hereHas),
    mainTreeInbox: () => shared,
  });
  const W = "/tmp/fake-wt";
  const S = "/tmp/fake-main/_planning/DOMAIN/_inbox";
  check(
    resolveInbox(W, undefined, probe(false, S, true)).dir === S,
    "worktree (üres saját inbox) → a FŐ FA korpuszát méri",
  );
  check(
    resolveInbox(W, undefined, probe(true, null, false)).dir === `${W}/_planning/DOMAIN/_inbox`,
    "fő fa (nincs külön common-dir) → a sajátját méri",
  );
  check(
    resolveInbox(W, undefined, probe(true, S, true)).alsoAt === S,
    "KÉT KORPUSZ → kimondja (nem választ némán az egyik javára)",
  );
  check(
    resolveInbox(W, undefined, probe(true, S, false)).alsoAt === undefined,
    "(kontroll) üres fő-fa-inbox nem kétértelműség",
  );
  // …és a VALÓDI telepítésen is a fő fát kell találnia, ebből a worktree-ből.
  const live = resolveInbox(ROOT);
  check(
    !live.dir.startsWith(ROOT) || ROOT === path.dirname(path.dirname(path.dirname(live.dir))),
    "ÉLESBEN: a feloldott inbox a fő fára mutat (nem erre a worktree-re)",
    live.dir,
  );
  check(live.alsoAt === undefined, "ÉLESBEN: nincs második korpusz", live.alsoAt ?? "—");

  // A DOMAIN-kor a GITBŐL jön — ezt is bizonyítani kell, nem elhinni.
  const ages = domainAges(ROOT);
  check(ages.length >= 5, "a DOMAIN-fájl felismerő talált fájlokat", `${ages.length} db`);
  const gitDated = ages.filter((a) => a.iso);
  check(gitDated.length === ages.length, "minden DOMAIN-fájlnak van git-dátuma", `${gitDated.length}/${ages.length}`);
  // Az mtime ebben a fában a checkout ideje; ha a git-dátum EGYEZNE vele, az őr az mtime-ot mérné.
  const domainDir = path.join(ROOT, "_planning/DOMAIN");
  const olderThanMtime = ages.filter(
    (a) => a.iso && Date.parse(a.iso) < statSync(path.join(domainDir, a.file)).mtimeMs - DAY_MS,
  );
  check(
    olderThanMtime.length > 0,
    "a git-dátum ELTÉR az mtime-tól (tehát tényleg a gitet mérjük)",
    `${olderThanMtime.length}/${ages.length} fájlnál régebbi a git-dátum, mint az mtime`,
  );

  console.log(`\n${fails.length ? "❌" : "✅"} domain-inbox-freshness --self-test: ${pass} állítás zöld, ${fails.length} piros`);
  for (const f of fails) console.error(`  ✗ ${f}`);
  process.exit(fails.length ? 1 : 0);
}

// ⛔ EZ A MODUL IMPORTÁLHATÓ IS. A `_tools/notify.mts` innen veszi a konjunkciót (`readCorpus`
// + `judge`), hogy „párosítatlan ÉS érdemi tudást hordoz" EGY példányban éljen — egy szabály
// két példányban két igazság. Main-guard NÉLKÜL viszont a puszta import lefuttatná ezt a kaput
// és `process.exit`-tel megölné a hívót: az értesítő némán elhalna, azaz pontosan azt a
// csendet termelné újra, amit gyógyítani hivatott.
const IS_MAIN = process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename;

if (!IS_MAIN) {
  /* library-használat: a hívó vezet, itt nem futtatunk és nem lépünk ki */
} else if (SELF_TEST) {
  selfTest();
} else {
  run();
}
