// ⭐⭐ A DESZTILLÁLÓ-ÉRTESÍTŐ ŐRE — azt méri, hogy az értesítő SE EL NE NÉMULJON, SE NE HAZUDJON.
//
// MIÉRT KELL. A `_planning/DOMAIN/_tools/notify.sh` a gyökérokot gyógyítja: a `distill.sh`
// hook-pontja hónapokig élt úgy, hogy a hívott fájl nem létezett, tehát a `[ -x ]` mindig hamis
// volt és a lépés NÉMÁN kimaradt — ennek az ára mérve 9 feldolgozatlan review / 62 javaslat.
// Egy ilyen gyógyszer maga is elnémulhat (elveszett +x bit, átnevezett kapcsoló, elrontott
// predikátum), és az elnémulás ugyanúgy NEM LÁTSZIK. Ezért mérjük.
//
// ── MIT MÉR (mind a négy irány, mert mindegyik más hibaosztály) ──────────────────────────
//   ① NÉMA-e, amikor némának kell lennie (üres futás, már átvezetett review) — különben a heti
//      zaj három hét alatt ugyanoda vezet, mint a csend: a tulaj átnézi.
//   ② SZÓL-e, amikor van mit eldönteni (érdemi javaslat, ismeretlen formátum, szerkezeti lelet).
//   ③ IGAZAT mond-e: a kiírt útvonalak LÉTEZŐ ágra/worktree-re mutatnak, a számok a halmazból
//      jönnek, és nincs benne sablon-helyőrző. Egy hazug értesítés rosszabb a csendnél — egyszer
//      téved, és utána az igaz üzenetét sem hiszi el senki.
//   ④ BE VAN-E KÖTVE: a `notify.sh` futtatható (a hook pont ezt teszteli), és a `distill.sh`
//      mindkét ágon hívja, `--mode=send`-del.
//
// ── ⛔⛔ A TESZT SAJÁT MELLÉKHATÁSA IS MÉRVE VAN ──────────────────────────────────────────
// Ezen a gépen mérve `SMS_PROVIDER=gammu` ÉS `EMAIL_PROVIDER=smtp` — MINDKÉT csatorna ÉLES —,
// és a `citoviso` usernek NOPASSWD sudo-ja van, vagyis az SMS-út (`sudo gammu-smsd-inject`)
// egy elszabadult tesztből TÉNYLEG küldene. A ház két rögzített esete pontosan ez: egy „mock"
// e-mail-kapcsoló valódi levelet küldött (ESM static import), és egy `--dry` kapcsoló néma
// kikapcsolás lett (29 valódi mellékhatás egy „zöld" tesztből).
// Ezért ez az őr NEM azt ÁLLÍTJA, hogy nem küld — MEGMÉRI:
//   · PATH-CSAPDA: a gyermek-folyamatok elé tett álnok `sudo` és `gammu-smsd-inject` RÖGZÍTI,
//     ha bárki küldeni próbálna, és nem hajtja végre. Egy találat = PIROS.
//   · KIMENET-PILLANATKÉP: `outbox-sms/` és `outbox/` fájlszáma előtte/utána.
//   · a gammu kimenő sor (`/var/spool/gammu/outbox`) előtte/utána — ha olvasható; ha nem, azt
//     KIMONDJA, és nem számolja sikernek (amit nem mértünk, arra nem hivatkozunk).
//   · STATIKUS: a `notify.mts`-ben NINCS static import a küldő modulokból, és a `liveSink()`
//     dinamikus importot használ.
// ⚠️ AMIT NEM MÉR: az ÉLES transzportot (valódi SMS/SMTP) ez az őr SOHA nem futtatja. Amit
//    bizonyít: a döntés, az üzenet-összeállítás és a kézbesítési kódút — rögzítő nyelőn át.
//
// ⛔ ÜRES HALMAZON MÉRNI HAMIS ZÖLD. Az ÉLES inbox ma 0 párosítatlan review-t tartalmaz (a
//    testvér-szál mind a 9-et átvezette), tehát az „élesben néma" futás önmagában SEMMIT nem
//    bizonyít. Minden érdemi állítás FIXTURE-ön fut, és a záró sor kiírja, HÁNY valódi mérés
//    futott — nulla mérés BUKÁS.
//
//   npx tsx scripts/distill-notify-check.mts

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { readCorpus, type Corpus } from "./domain-inbox-freshness-check.mts";
import { branchPaths } from "../_planning/DOMAIN/_tools/distill-apply.mts";
import { liveBranches, parseArgs, plan, recordingSink, deliver, ArgError, type BranchInfo } from "../_planning/DOMAIN/_tools/notify.mts";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOOLS = path.join(ROOT, "_planning/DOMAIN/_tools");
const NOTIFY_SH = path.join(TOOLS, "notify.sh");
const NOTIFY_TS = path.join(TOOLS, "notify.mts");
const DISTILL_SH = path.join(TOOLS, "distill.sh");

let pass = 0;
/** FIXTURE-ön futott érdemi mérések — ez a szám dönti el, hogy volt-e egyáltalán mérés. */
let measured = 0;
const fails: string[] = [];
const notes: string[] = [];
function check(ok: boolean, name: string, detail = ""): void {
  if (ok) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

// ── FIXTURE-GYÁR ─────────────────────────────────────────────────────────────────────────
// Session-privát könyvtár: a közös /tmp-t párhuzamos szálak felülírják (rögzített esetünk van rá).
const WORK = mkdtempSync(path.join(tmpdir(), "distill-notify-check-"));

// ── ZÁRÁS + ÖSSZEOMLÁS-HÁLÓ ──────────────────────────────────────────────────────────────
// ⛔ MÉRT SAJÁT HIBA: az első változatom egy kezeletlen ENOENT-tel szállt el a mérés közepén —
// a záró összegzés, a mellékhatás-mérés ÉS a takarítás előtt. Az exit-kód 1 lett, de EGYETLEN
// lelet sem jelent meg: a bukás nem hamis zöld volt, hanem DIAGNOSZTIZÁLHATATLAN, ami a ház
// tapasztalata szerint órákat visz el. Egy összeomlás ezért mostantól maga is NEVESÍTETT lelet.
let summarized = false;
function summarize(crash?: unknown): void {
  if (summarized) return;
  summarized = true;
  try {
    rmSync(WORK, { recursive: true, force: true });
  } catch {
    /* a takarítás bukása nem nyomhatja el a leleteket */
  }
  if (crash !== undefined) {
    fails.push(
      `⛔ AZ ŐR ÖSSZEOMLOTT a mérés közben — ez BUKÁS, nem „nem futott le": ` +
        `${(crash as Error)?.stack ?? String(crash)}`,
    );
  }
  for (const n of notes) console.log(`  ℹ️  ${n}`);
  if (measured === 0) {
    fails.push("NULLA valódi mérés futott — üres halmazon mért zöld HAMIS ZÖLD, ezért ez bukás");
  }
  console.log(
    `\n${fails.length ? "❌" : "✅"} distill-notify-check: ${pass} állítás zöld, ${fails.length} piros ` +
      `· ${measured} valódi mérés futott fixture-ön`,
  );
  for (const f of fails) console.error(`  ✗ ${f}`);
}
process.on("uncaughtException", (e) => {
  summarize(e);
  process.exit(1);
});
process.on("unhandledRejection", (e) => {
  summarize(e);
  process.exit(1);
});

const REAL_REVIEW = [
  "# Distill review — fixture",
  "",
  "## SUMMARY",
  "Összefoglaló.",
  "",
  "## PROMOTE",
  "",
  "### 03-INVARIANTS.md → §B.20 új szabály",
  "szöveg",
  "",
  "### 01-CALC-MODELS.md → §C árazás",
  "szöveg",
  "",
  "## REFINE",
  "",
  "### 02-ENTITY-MAP.md → Tenant",
  "szöveg",
  "",
].join("\n");

/** Lefutott, de nem talált semmit: van felismert szekció, nincs érdemi `###`. */
const EMPTY_REVIEW = ["# Distill review — fixture", "", "## SUMMARY", "Nincs új tudás.", ""].join("\n");

/** Szekció NÉLKÜLI, de NAGY fájl → ismeretlen formátum → fail-closed érdemi. */
const UNPARSED_REVIEW = `# valami egészen más\n${"lorem ipsum dolor sit amet ".repeat(80)}\n`;

let caseNo = 0;
interface Scenario {
  readonly corpus: Corpus;
  readonly branches: BranchInfo[];
  readonly dir: string;
}

/** Felépít egy inboxot a megadott fájlokkal, és opcionálisan egy LÉTEZŐ átvezető worktree-t. */
function scenario(
  inboxFiles: Record<string, string>,
  appliedFiles: string[] = [],
  branchDates: { date: string; createDir: boolean }[] = [],
): Scenario {
  const dir = path.join(WORK, `case${++caseNo}`);
  const inbox = path.join(dir, "_inbox");
  const wtRoot = path.join(dir, "wt");
  mkdirSync(path.join(inbox, "applied"), { recursive: true });
  mkdirSync(wtRoot, { recursive: true });
  for (const [name, body] of Object.entries(inboxFiles)) writeFileSync(path.join(inbox, name), body);
  for (const name of appliedFiles) writeFileSync(path.join(inbox, "applied", name), "átvezetve");
  const branches: BranchInfo[] = branchDates.map(({ date, createDir }) => {
    const p = branchPaths(date, wtRoot);
    if (createDir) {
      // Hű az éleshez: az átvezető a worktree MELLÉ a DISTILL-PENDING.md-t is kiírja, és az
      // üzenet erre hivatkozik — ha a fixture-ből kihagynám, az „útvonal létezik" állítás
      // egy olyan hiányt mérne, ami élesben nem áll fenn.
      mkdirSync(path.dirname(p.pendingPath), { recursive: true });
      writeFileSync(p.pendingPath, "# ember-döntések (fixture)\n");
    }
    return { branch: p.branch, wtDir: p.wtDir, pendingPath: p.pendingPath, wtExists: createDir };
  });
  return { corpus: readCorpus(inbox, []), branches, dir };
}

const NOW = Date.parse("2026-09-17T12:00:00Z");
const stampFor = (daysAgo: number): string => {
  const d = new Date(NOW - daysAgo * 86_400_000);
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
};

// ─────────────────────────────────────────────────────────────────────────────────────────
// ① + ② A DÖNTÉS: mikor néma, mikor szól
// ─────────────────────────────────────────────────────────────────────────────────────────
console.log("── ① NÉMASÁG és ② MEGSZÓLALÁS (fixture-ökön) ──");

{
  // A legfontosabb POZITÍV eset: van érdemi, párosítatlan review → SZÓLNIA KELL.
  const s = scenario({ [`${stampFor(30)}.md`]: REAL_REVIEW }, [], [{ date: stampFor(0).slice(0, 8), createDir: true }]);
  const p = plan(s.corpus, NOW, s.branches, ROOT);
  measured++;
  check(p.speak, "érdemi párosítatlan review → SZÓL");
  check(p.reviews.length === 1, "a döntésre várók száma pontos", `${p.reviews.length}`);
  check(p.suggestions === 3, "a javaslatok száma a review-ból jön", `${p.suggestions}`);
  check(p.oldestDays === 30, "a kor a review bélyegéből jön", `${p.oldestDays}`);
  check(/3 javaslat|3 review/.test(p.sms) || p.sms.includes("3 javaslat"), "az SMS megnevezi a mennyiséget", p.sms);
  check(p.emailSubject.includes("1 desztilláló-review"), "a tárgy megnevezi a mennyiséget", p.emailSubject);
}

{
  // NEGATÍV KONTROLL: üres futás → NÉMA. Ha ez pirosra megy, az értesítő hetente zajongana.
  const s = scenario({ [`${stampFor(30)}.md`]: EMPTY_REVIEW });
  const p = plan(s.corpus, NOW, s.branches, ROOT);
  measured++;
  check(!p.speak, "(negatív kontroll) ÜRES futás → NÉMA", p.speak ? p.sms : "néma");
  check(p.silentReason !== null, "a némaság INDOKOLT (a naplóban is látszik)");
}

{
  // NEGATÍV KONTROLL: már átvezetett review → NÉMA (a párosítás a döntő).
  const st = stampFor(30);
  const s = scenario({ [`${st}.md`]: REAL_REVIEW }, [`${st}-applied.md`]);
  const p = plan(s.corpus, NOW, s.branches, ROOT);
  measured++;
  check(!p.speak, "(negatív kontroll) ÁTVEZETETT review → NÉMA", p.speak ? p.sms : "néma");
}

{
  // NEGATÍV KONTROLL: teljesen üres inbox esetén a `judge` szerkezeti leletet ad („0 találat
  // gyanú, nem siker") — ez SZÁNDÉKOSAN megszólalás, mert a mérőeszköz lehet elromolva.
  const s = scenario({});
  const p = plan(s.corpus, NOW, s.branches, ROOT);
  measured++;
  check(p.speak && p.structural.length > 0, "ÜRES KORPUSZ → szól (a 0 találat gyanú, nem siker)");
}

{
  // Fail-closed tudás: ismeretlen formátum, de nagy fájl → érdeminek vesszük.
  const s = scenario({ [`${stampFor(10)}.md`]: UNPARSED_REVIEW }, [], [{ date: stampFor(0).slice(0, 8), createDir: true }]);
  const p = plan(s.corpus, NOW, s.branches, ROOT);
  measured++;
  check(p.speak, "ISMERETLEN FORMÁTUMÚ review → szól (fail-closed)");
  check(p.emailText.includes("ISMERETLEN FORMÁTUM"), "az e-mail kimondja, hogy nem tudta értelmezni");
}

{
  // ⛔ A LEGALATTOMOSABB: üres ÉS érdemi review EGYÜTT. Az üres NEM hízlalhatja a számot.
  const s = scenario(
    { [`${stampFor(30)}.md`]: REAL_REVIEW, [`${stampFor(3)}.md`]: EMPTY_REVIEW },
    [],
    [{ date: stampFor(0).slice(0, 8), createDir: true }],
  );
  const p = plan(s.corpus, NOW, s.branches, ROOT);
  measured++;
  check(p.speak, "vegyes halmaz → szól");
  check(p.reviews.length === 1, "az ÜRES futás nem hízlalja a döntendők számát", `${p.reviews.length} (várt: 1)`);
  check(!p.emailText.includes(stampFor(3)), "az üres futás nem kerül be a felsorolásba");
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ③ IGAZAT MOND-E: az útvonalak
// ─────────────────────────────────────────────────────────────────────────────────────────
console.log("── ③ AZ ÜZENET IGAZSÁGA (útvonalak, helyőrzők) ──");

{
  const date = stampFor(0).slice(0, 8);
  const s = scenario({ [`${stampFor(30)}.md`]: REAL_REVIEW }, [], [{ date, createDir: true }]);
  const p = plan(s.corpus, NOW, s.branches, ROOT);
  const b = s.branches[0];
  measured++;
  check(p.emailText.includes(b.wtDir), "az e-mail a KONKRÉT worktree-útvonalat írja", b.wtDir);
  check(p.emailText.includes(b.pendingPath), "…és a KONKRÉT DISTILL-PENDING útvonalat");
  check(p.emailText.includes(b.branch), "…és a KONKRÉT ág-nevet", b.branch);
  check(p.sms.includes(b.branch), "az SMS is megnevezi az ágat");
  check(
    p.emailText.includes("diff HEAD~1") && p.emailText.includes("land.sh") && p.emailText.includes("worktree remove"),
    "a három parancs mind benne van (megnézem / elfogadom / eldobom)",
  );
  // Sablon-helyőrző TILOS: ez pont az a „van valami" üzenet, ami ugyanaz a semmi, mint a csend.
  check(
    !/<dátum>|<datum>|YYYYMMDD|\$\{|<slug>/.test(p.emailText),
    "nincs SABLON-HELYŐRZŐ az üzenetben",
  );
  // ⛔ MINDEN kiírt ABSZOLÚT útvonal LÉTEZZEN. Ez fogja meg a „rossz útvonalat ír" hibát.
  // ⚠️ Csak abszolút út számít: az ág NEVE (`wt/distill20260917`) tartalmaz `/`-t, de nem
  // útvonal — az első változatom ezt is fájlnak nézte, és magát az őrt küldte hamis pirosra.
  const mentioned = [...p.emailText.matchAll(/(?:^|\s)(\/\S*distill\d{8}\S*)/gm)]
    .map((m) => m[1].replace(/[.,)]+$/, ""));
  const missing = mentioned.filter((m) => !existsSync(m));
  check(mentioned.length > 0, "az üzenet egyáltalán nevez meg worktree-útvonalat", `${mentioned.length} db`);
  check(missing.length === 0, "MINDEN megnevezett ABSZOLÚT útvonal LÉTEZIK", missing.join(", "));
}

{
  // ⛔ NEGATÍV KONTROLL a hazugságra: ha az ág NEM létezik, TILOS három parancsot ígérni rá.
  const date = stampFor(0).slice(0, 8);
  const s = scenario({ [`${stampFor(30)}.md`]: REAL_REVIEW }, [], [{ date, createDir: false }]);
  const p = plan(s.corpus, NOW, s.branches, ROOT);
  const b = s.branches[0];
  measured++;
  check(p.speak, "nem létező ág mellett is szól (a döntenivaló attól még megvan)");
  check(
    !p.emailText.includes(`git -C ${b.wtDir} diff`),
    "NEM létező worktree-re NEM ígér diff-parancsot",
    b.wtDir,
  );
  check(
    p.emailText.includes("distill-apply.mts") && p.emailText.includes("--go"),
    "…helyette a VALÓDI következő lépést adja (az ág elkészítését)",
  );
  check(p.sms.includes("MEG NINCS"), "az SMS is megmondja, hogy ág még nincs", p.sms);
}

{
  // A `plan()` a `judge()`-ból származtat: ha valaki külön predikátumot írna bele, ez elromlik.
  // Bizonyíték: az 1000 bájtos fail-closed határ ALATTI, szekció nélküli fájl NEM érdemi.
  const s = scenario({ [`${stampFor(30)}.md`]: "kicsi, szekció nélküli\n" });
  const p = plan(s.corpus, NOW, s.branches, ROOT);
  measured++;
  check(!p.speak || p.reviews.length === 0, "a fail-closed HATÁR a frissesség-őrből jön (kicsi fájl ≠ tudás)");
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// A KAPCSOLÓK — fail-closed
// ─────────────────────────────────────────────────────────────────────────────────────────
console.log("── A KÜLDÉS-KAPCSOLÓ (fail-closed) ──");

check(parseArgs([]).mode === "dry-run", "hiányzó --mode → SZÁRAZ (fail-closed)");
check(parseArgs(["--mode=send"]).mode === "send", "--mode=send → éles");
for (const bad of ["--dry", "--dry-run", "--mode=sen", "--send", "--mode=SEND"]) {
  let threw = false;
  try {
    parseArgs([bad]);
  } catch (e) {
    threw = e instanceof ArgError;
  }
  measured++;
  check(threw, `ismeretlen/elgépelt kapcsoló HIBA, nem néma átengedés: ${bad}`);
}
check(parseArgs(["/review/path.md"]).reviewFile === "/review/path.md", "a review-útvonal pozicionálisan átjön");

// ─────────────────────────────────────────────────────────────────────────────────────────
// ④ BEKÖTÉS — a hook pontosan azt teszteli, amit mi biztosítunk
// ─────────────────────────────────────────────────────────────────────────────────────────
console.log("── ④ BEKÖTÉS ──");

check(existsSync(NOTIFY_SH), "a notify.sh LÉTEZIK");
// A hook `[ -x ]`-et tesztel: +x nélkül a lépés némán kimarad — pont az eredeti hiba.
let executable = false;
try {
  execFileSync("test", ["-x", NOTIFY_SH]);
  executable = true;
} catch {
  executable = false;
}
check(executable, "a notify.sh FUTTATHATÓ (a hook `[ -x ]`-et tesztel — +x nélkül némán kimarad)");

const distillSrc = readFileSync(DISTILL_SH, "utf8");
check(/fire_notify/.test(distillSrc), "a distill.sh hívja az értesítőt");
check(
  /"\$NOTIFY".*--mode=send/.test(distillSrc),
  "a distill.sh --mode=send-del hív (enélkül fail-closed ⇒ SOHA nem küldene)",
);
// Mindkét ág: a friss review UTÁN és a „nincs új memória" korai kilépés ELŐTT is.
const earlyExit = distillSrc.slice(0, distillSrc.indexOf("# --- 3."));
check(/fire_notify/.test(earlyExit), "a FELHALMOZÁS ága is értesít (korai kilépés előtt)");
check(
  /nincs futtatható notify\.sh/.test(distillSrc),
  "a hiányzó notify.sh HANGOS (a néma kimaradás volt az eredeti hiba)",
);

const notifySrc = readFileSync(NOTIFY_TS, "utf8");
const applySrc = readFileSync(path.join(TOOLS, "distill-apply.mts"), "utf8");
check(
  /branchPaths\(/.test(notifySrc) && /branchPaths\(/.test(applySrc),
  "az útvonal EGY forrásból jön (branchPaths) — nem két példányban",
);
check(
  /import \{[^}]*judge[^}]*\} from/.test(notifySrc),
  "a predikátum a frissesség-őrből jön (nincs újraírva)",
);

// ─────────────────────────────────────────────────────────────────────────────────────────
// ⛔⛔ A SAJÁT MELLÉKHATÁS MÉRÉSE
// ─────────────────────────────────────────────────────────────────────────────────────────
console.log("── ⛔ A TESZT SAJÁT MELLÉKHATÁSA ──");

// STATIKUS: a küldő modulok NEM static importtal jönnek (ez a rögzített ESM-csapda).
const importBlock = notifySrc.slice(0, notifySrc.indexOf("const DAY_MS"));
check(
  !/^import .*(sms\/sender|email\/sender|console\/appSettings)/m.test(importBlock),
  "a notify.mts-ben NINCS static import a küldő modulokból",
);
check(
  /await import\(.*sms\/sender/.test(notifySrc) && /await import\(.*email\/sender/.test(notifySrc),
  "a liveSink() DINAMIKUS importot használ (csak --mode=send ágon tölt be)",
);

// PATH-CSAPDA: álnok `sudo` és `gammu-smsd-inject` a gyermek-folyamatok elé.
const SHIM = path.join(WORK, "shim");
const TRIP = path.join(WORK, "tripwire.log");
mkdirSync(SHIM, { recursive: true });
for (const name of ["sudo", "gammu-smsd-inject", "mms-send"]) {
  writeFileSync(
    path.join(SHIM, name),
    `#!/usr/bin/env bash\nprintf '%s %s\\n' "${name}" "$*" >> ${JSON.stringify(TRIP)}\nexit 0\n`,
    { mode: 0o755 },
  );
}

// KIMENET-PILLANATKÉP (előtte)
const countDir = (d: string): number => {
  try {
    return readdirSync(d).length;
  } catch {
    return -1;
  }
};
const outboxBefore = countDir(path.join(ROOT, "outbox"));
const smsOutboxBefore = countDir(path.join(ROOT, "outbox-sms"));
const gammuSpool = (): number | null => {
  try {
    const out = execFileSync("sudo", ["-n", "ls", "-1", "/var/spool/gammu/outbox"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    });
    return out.split("\n").filter((l) => l.trim()).length;
  } catch {
    return null;
  }
};
const gammuBefore = gammuSpool();

// A KÉZBESÍTÉSI KÓDÚT tényleges futtatása — rögzítő nyelőn át (ugyanaz a `deliver()`, ami élesben fut).
const recFile = path.join(WORK, "recorded.jsonl");
{
  const s = scenario({ [`${stampFor(30)}.md`]: REAL_REVIEW }, [], [{ date: stampFor(0).slice(0, 8), createDir: true }]);
  const p = plan(s.corpus, NOW, s.branches, ROOT);
  const sent = await deliver(p, { phone: "+36300000000", email: "teszt@example.invalid" }, recordingSink(recFile));
  measured++;
  check(sent.join(",") === "sms,email", "a kézbesítés MINDKÉT csatornán megszólal", sent.join(",") || "(semmi)");
  // ⚠️ NEM feltételezzük, hogy a fájl létrejött: ha az értesítő elnémul, itt NINCS fájl, és egy
  // csupasz readFileSync ÖSSZEOMLÁSSAL ölné meg az őrt — kimutatható lelet helyett. (Mérve: a
  // „némuljon el" szabotázs pontosan így, ENOENT-tel dőlt el, és EGYETLEN leletet sem írt ki.)
  if (!existsSync(recFile)) {
    check(false, "a rögzítő nyelő kapott üzenetet", "NINCS rögzített üzenet — az értesítő elnémult");
  } else {
    const recorded = readFileSync(recFile, "utf8").trim().split("\n").map((l) => JSON.parse(l));
    check(recorded.length === 2, "a rögzítő nyelő 2 üzenetet látott", `${recorded.length}`);
    check(
      recorded.some((r) => r.channel === "email" && String(r.text).includes("diff HEAD~1")),
      "a rögzített e-mail tartalmazza a parancsokat (tehát tényleg a valódi törzs ment volna)",
    );
  }
}

// A CLI száraz futása — gyermek-folyamatban, PATH-csapdával.
// ⚠️ `spawnSync`, NEM `execFileSync`: az utóbbi SIKERES futásnál csak a stdout-ot adja vissza,
// a figyelmeztetés viszont stderr-re megy — így a saját mérőeszközöm némította volna el a
// „hangos dry-run" bizonyítékát, és zölden átengedte volna a néma változatot is. (Mérve: ez
// az állítás előbb pirosra ment, pedig a termék helyesen viselkedett.)
const cliDry = (args: string[]): { rc: number; out: string } => {
  const r = spawnSync("bash", [NOTIFY_SH, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, PATH: `${SHIM}:${process.env.PATH ?? ""}` },
    timeout: 120_000,
  });
  return { rc: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
};

{
  const fixtureInbox = path.join(WORK, "cliInbox");
  mkdirSync(path.join(fixtureInbox, "applied"), { recursive: true });
  writeFileSync(path.join(fixtureInbox, `${stampFor(30)}.md`), REAL_REVIEW);
  const cliRec = path.join(WORK, "cli-recorded.jsonl");
  const r = cliDry([`--inbox=${fixtureInbox}`, `--record=${cliRec}`]);
  measured++;
  check(r.rc === 0, "a CLI száraz futása zölden lefut", `rc=${r.rc}`);
  // ④ A dry-run HANGOS: enélkül egy rosszul bekötött hook úgy nézne ki, mint a siker.
  check(/SZÁRAZ FUTÁS.*NEM küldtem/s.test(r.out), "a száraz futás HANGOSAN kimondja, hogy nem küldött");
  check(existsSync(cliRec), "…és rögzítette, MI MENT VOLNA KI");
}

{
  // A CLI-nak a fail-closed hibát is gyermek-folyamatban bizonyítania kell.
  const r = cliDry(["--dry"]);
  measured++;
  check(r.rc === 2, "a CLI az elgépelt kapcsolóra 2-vel hasal el (nem küld, nem enged át)", `rc=${r.rc}`);
}

// KIMENET-PILLANATKÉP (utána) + a csapda kiolvasása
const tripped = existsSync(TRIP) ? readFileSync(TRIP, "utf8").trim() : "";
check(tripped === "", "⛔ PATH-CSAPDA: senki nem próbált SMS-t/MMS-t küldeni", tripped || "üres (jó)");
check(countDir(path.join(ROOT, "outbox")) === outboxBefore, "az e-mail outbox/ VÁLTOZATLAN", `${outboxBefore} → ${countDir(path.join(ROOT, "outbox"))}`);
check(countDir(path.join(ROOT, "outbox-sms")) === smsOutboxBefore, "az outbox-sms/ VÁLTOZATLAN", `${smsOutboxBefore} → ${countDir(path.join(ROOT, "outbox-sms"))}`);
const gammuAfter = gammuSpool();
if (gammuBefore === null || gammuAfter === null) {
  // Amit nem mértünk, arra nem hivatkozunk sikerként.
  notes.push("a gammu kimenő sor (/var/spool/gammu/outbox) NEM volt olvasható — ezt a próbát NEM futtattam");
} else {
  check(gammuBefore === gammuAfter, "a gammu kimenő sor VÁLTOZATLAN", `${gammuBefore} → ${gammuAfter}`);
}

// ─────────────────────────────────────────────────────────────────────────────────────────
// ÉLES SZEMLE (nem kapu, csak tájékoztatás — az éles korpusz ma ÜRES, abból nem ítélünk)
// ─────────────────────────────────────────────────────────────────────────────────────────
const real = liveBranches(ROOT, path.join(process.env.HOME ?? "", "wt"));
notes.push(`éles wt/distill* ágak: ${real.length ? real.map((b) => `${b.branch}${b.wtExists ? "" : " (fa nincs)"}`).join(", ") : "nincs"}`);

summarize();
process.exit(fails.length ? 1 : 0);
