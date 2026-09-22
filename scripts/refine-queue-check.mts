// ⭐⭐ REFINE-DÖNTÉSI SOR ŐRE — a javaslat TÚLÉLI-E a review lezárását?
//
// A MÉRT LELET (2026-09-19). A desztilláló REFINE-javaslata a KANONIKUS szöveget írná át, ezért
// a gép SOHA nem vezeti át — mindig ember dönt. Csakhogy a `distill-apply.mts` `listReviews()`-a
// kiszűr minden review-t, ami már az `_inbox/applied/`-ban van, MÉG AZELŐTT, hogy bármi más
// lefutna. PROMOTE-ra ez helyes; REFINE-ra végzetes: **a review lezárása MAGA temeti el a
// javaslatot.** Mérve: 23 REFINE-blokk állt így, elérhetetlenül — miközben a kód egy kommentben
// az ellenkezőjét ígéri („the proposal must come back, not vanish silently").
//
// ⭐ NEM ELMÉLETI KÁR. Az egyik eltemetett javaslat (2026-08-02) SZÓ SZERINT kimondta, hogy a
// `watermarked` flag halott kód, és hogy a vízjel-detektálás a portál-fotó-ingestnél KÖTELEZŐ.
// Hét hétig ült az `applied/`-ban. A §A.2-lyukat 2026-09-19-én külön mérésből fedeztük fel újra.
//
// ── MIT MÉR ──────────────────────────────────────────────────────────────────────────────
//   ① TÚLÉLÉS: a LEZÁRT review REFINE-javaslata is megjelenik a sorban. (Ha valaki a
//      `listReviews`-ra kötné vissza a gyűjtőt, ez azonnal pirosra megy.)
//   ② A DÖNTÉS ELTÜNTETI: amiről ember döntött, az kikerül a nyitottak közül — és CSAK az.
//   ③ A GÉP SOHA NEM ZÁR LE: ismételt futás nem változtat a döntéseken.
//   ④ AZ INDOKLÁS KÖTELEZŐ: indoklás nélküli lezárás HIBA, és NEM ír semmit.
//   ⑤ FAIL-CLOSED kapcsoló: ismeretlen kapcsoló hiba, nem néma listázás.
//   ⑥ STABIL AZONOSÍTÓ: ugyanaz a javaslat kétszer mérve ugyanazt az id-t kapja (különben a
//      döntés leválna róla, és a lezárt tétel visszajönne).
//   ⑦ AZ ÉRTESÍTŐ MEGSZÓLAL: nyitott REFINE-ra akkor is szól, ha NULLA review vár — pont az
//      az eset, amiben eddig néma volt.
//
// ⛔ ÜRES HALMAZON MÉRNI HAMIS ZÖLD: a záró sor kiírja, hány valódi mérés futott; nulla = bukás.
//
//   npx tsx scripts/refine-queue-check.mts

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { collectRefineProposals } from "../_planning/DOMAIN/_tools/distill-apply.mts";
import { loadRefineQueue, readDecisions } from "../_planning/DOMAIN/_tools/refine-queue.mts";
import { plan } from "../_planning/DOMAIN/_tools/notify.mts";
import { readCorpus } from "./domain-inbox-freshness-check.mts";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOOL = path.join(ROOT, "_planning/DOMAIN/_tools/refine-queue.mts");

let pass = 0;
let measured = 0;
const fails: string[] = [];
function check(ok: boolean, name: string, detail = ""): void {
  if (ok) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

// Session-privát: a közös /tmp-t párhuzamos szálak felülírják (rögzített esetünk van rá).
const WORK = mkdtempSync(path.join(tmpdir(), "refine-queue-check-"));

// ── ÖSSZEOMLÁS-HÁLÓ ──────────────────────────────────────────────────────────────────────
// ⛔ MÁSODSZOR MÉRT SAJÁT HIBA. A testvér-őrben (`distill-notify-check`) már megtörtént: a
// szabotázs-kontroll nem pirosra ment, hanem ÖSSZEOMLOTT egy kezeletlen kivétellel — a záró
// összegzés és a takarítás előtt, EGYETLEN lelet nélkül. Az exit-kód 1 volt, tehát „elkapva"-
// ként könyveltem volna el, ha nem nézem meg a TELJES kimenetet. A tanulságot akkor memóriába
// is mentettem — és most MÉGIS hiányzott innen: egy javítás nem terjed át magától a testvérre.
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
  if (measured === 0) {
    fails.push("NULLA valódi mérés futott — üres halmazon mért zöld HAMIS ZÖLD, ezért ez bukás");
  }
  console.log(
    `\n${fails.length ? "❌" : "✅"} refine-queue-check: ${pass} állítás zöld, ${fails.length} piros ` +
      `· ${measured} valódi mérés`,
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

/** Hű fixture a VALÓDI review-formátumhoz (`### cél → hely`, `- OLD:`, `- NEW:`, `- WHY:`). */
function review(blocks: { target: string; old: string; neu: string; why: string }[]): string {
  const L = ["# Distill review — fixture", "", "## SUMMARY", "x", "", "## REFINE", ""];
  for (const b of blocks) {
    L.push(`### ${b.target} → §teszt`);
    L.push("Source: `fixture.md`");
    L.push(`- OLD: \`${b.old}\``);
    L.push(`- NEW: \`${b.neu}\``);
    L.push(`- WHY: ${b.why}`);
    L.push("");
  }
  return L.join("\n");
}

/** DOMAIN-fa fixture: a cél-fájl tartalmazza az OLD idézetet → a státusz ÉLŐ lesz. */
function domainFixture(name: string, oldLiteral: string, where: "applied" | "inbox"): string {
  const dir = path.join(WORK, name);
  const dom = path.join(dir, "_planning/DOMAIN");
  mkdirSync(path.join(dom, "_inbox/applied"), { recursive: true });
  writeFileSync(path.join(dom, "03-INVARIANTS.md"), `# Invariánsok\n\n${oldLiteral}\n`);
  const body = review([
    { target: "03-INVARIANTS.md", old: oldLiteral, neu: "az új szöveg", why: "mert elavult" },
  ]);
  const sub = where === "applied" ? "_inbox/applied" : "_inbox";
  writeFileSync(path.join(dom, sub, "20260802T020001Z.md"), body);
  return dom;
}

const OLD = "- **Igazságforrás:** a mező a kódban MA NINCS.";

console.log("── ① TÚLÉLÉS: a LEZÁRT review javaslata is a sorban van ──");
{
  // ⛔ EZ A LÉNYEG. A review az `applied/`-ban ül, tehát a `run()` szempontjából LEZÁRT.
  // A javaslatnak ettől függetlenül elő kell jönnie.
  const dom = domainFixture("suvived", OLD, "applied");
  const q = loadRefineQueue(dom, path.join(dom, "_tools/REFINE-DECISIONS.md"));
  measured++;
  check(q.all.length === 1, "a LEZÁRT review REFINE-javaslata megjelenik", `${q.all.length} db`);
  check(q.open.length === 1, "…és NYITOTTKÉNT (nincs róla döntés)", `${q.open.length}`);
  check(q.all[0]?.status === "LIVE", "a státusz a MAI ontológiához mérve ÉLŐ", q.all[0]?.status);
  check(q.all[0]?.target === "03-INVARIANTS.md", "a célfájl felismerve", String(q.all[0]?.target));
}

{
  // (kontroll) ugyanaz a javaslat a NYITOTT inboxban is látszik — a sor nem az applied/-ra szűk.
  const dom = domainFixture("pending", OLD, "inbox");
  const q = loadRefineQueue(dom, path.join(dom, "_tools/REFINE-DECISIONS.md"));
  measured++;
  check(q.all.length === 1, "(kontroll) a PÁROSÍTATLAN review javaslata is a sorban van");
}

console.log("── ⑥ STABIL AZONOSÍTÓ ──");
{
  const dom = domainFixture("stable", OLD, "applied");
  const a = collectRefineProposals(dom, [path.join(dom, "_inbox"), path.join(dom, "_inbox/applied")]);
  const b = collectRefineProposals(dom, [path.join(dom, "_inbox"), path.join(dom, "_inbox/applied")]);
  measured++;
  check(a.length === 1 && a[0].id === b[0]?.id, "ugyanaz a javaslat ugyanazt az id-t kapja", `${a[0]?.id} vs ${b[0]?.id}`);
  check(/^[0-9a-f]{16}$/.test(a[0]?.id ?? ""), "az azonosító alakja stabil (16 hex)", a[0]?.id);
}

console.log("── ② + ③ + ④ A DÖNTÉS ──");
const cli = (dom: string, args: string[]): { rc: number; out: string } => {
  const r = execFileSync("bash", ["-c", "true"], { encoding: "utf8" }); // no-op, a shape kedvéért
  void r;
  try {
    const out = execFileSync("npx", ["tsx", TOOL, ...args], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, DOMAIN_OVERRIDE: dom },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
    return { rc: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { rc: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
};

{
  // A döntés-írást KÖZVETLENÜL mérjük (a CLI a repó saját DOMAIN-jén dolgozik, nem fixture-ön):
  // a `readDecisions` felismerőjét és a „csak az eltűnik, amiről döntöttünk" szabályt.
  const dom = domainFixture("decided", OLD, "applied");
  const decFile = path.join(dom, "_tools/REFINE-DECISIONS.md");
  const q1 = loadRefineQueue(dom, decFile);
  measured++;
  // ⚠️ NEM feltételezzük, hogy a gyűjtő talált valamit: ha a lánc elszakad (pl. valaki újra
  // kihagyja a lezárt review-kat), itt ÜRES a tömb, és egy csupasz `[0].id` ÖSSZEOMLÁSSAL
  // ölné meg az őrt — kimutatható lelet helyett. Mérve: pontosan így történt.
  if (q1.all.length === 0) {
    check(false, "a döntés-méréshez van javaslat", "ÜRES a sor — a gyűjtő nem talált semmit");
  } else {
  const id = q1.all[0].id;
  mkdirSync(path.dirname(decFile), { recursive: true });
  writeFileSync(decFile, `- \`${id}\` · elvetve · 2026-09-22 · elavult, a célszöveg átírva\n`);
  const q2 = loadRefineQueue(dom, decFile);
  measured++;
  check(q2.open.length === 0, "a döntés ELTÜNTETI a tételt a nyitottak közül", `${q2.open.length}`);
  check(q2.all.length === 1, "…de a javaslat maga megmarad (a forrás a git, nem törlünk)");
  check(q2.decisions.get(id)?.kind === "elvetve", "a döntés VISSZAOLVASHATÓ", q2.decisions.get(id)?.kind);
  check(q2.orphanDecisions.length === 0, "nincs árva döntés");
  // ③ A gép nem zár le: újabb betöltés nem ír a fájlba.
  const before = readFileSync(decFile, "utf8");
  loadRefineQueue(dom, decFile);
  loadRefineQueue(dom, decFile);
  measured++;
  check(readFileSync(decFile, "utf8") === before, "⛔ a puszta BETÖLTÉS nem ír a döntés-fájlba (a gép sosem zár le)");
  }
}

{
  // ⛔ NEGATÍV KONTROLL a felismerőre: egy IDEGEN azonosítóra szóló döntés nem tüntethet el
  // mást, és árvaként ki kell mondani.
  const dom = domainFixture("orphan", OLD, "applied");
  const decFile = path.join(dom, "_tools/REFINE-DECISIONS.md");
  mkdirSync(path.dirname(decFile), { recursive: true });
  writeFileSync(decFile, "- `deadbeefdeadbeef` · elvetve · 2026-09-22 · idegen azonosító\n");
  const q = loadRefineQueue(dom, decFile);
  measured++;
  check(q.open.length === 1, "idegen döntés NEM tünteti el a valódi tételt", `${q.open.length}`);
  check(q.orphanDecisions.length === 1, "…és az árva döntést KIMONDJA", `${q.orphanDecisions.length}`);
}

console.log("── ④ + ⑤ A CLI fail-closed viselkedése ──");
{
  const r = cli(ROOT, ["--close", "abc123", "--reason", ""]);
  measured++;
  check(r.rc === 2, "üres --reason → HIBA (indoklás nélkül nincs lezárás)", `rc=${r.rc}`);
  check(/reason KÖTELEZŐ/.test(r.out), "…és kimondja, miért");
}
{
  const r = cli(ROOT, ["--close", "abc123"]);
  measured++;
  check(r.rc === 2, "hiányzó --reason → HIBA", `rc=${r.rc}`);
}
{
  const r = cli(ROOT, ["--dry"]);
  measured++;
  check(r.rc === 2, "ismeretlen kapcsoló → HIBA, nem néma listázás", `rc=${r.rc}`);
}
{
  // Nem létező azonosítóra sem írunk — és a döntés-fájl sem keletkezik mellékhatásként.
  const decReal = path.join(ROOT, "_planning/DOMAIN/_tools/REFINE-DECISIONS.md");
  const existedBefore = existsSync(decReal);
  const sizeBefore = existedBefore ? readFileSync(decReal, "utf8").length : -1;
  const r = cli(ROOT, ["--close", "nincsilyen0000", "--reason", "teszt"]);
  measured++;
  check(r.rc === 1, "nem létező azonosító → HIBA", `rc=${r.rc}`);
  const sizeAfter = existsSync(decReal) ? readFileSync(decReal, "utf8").length : -1;
  check(sizeBefore === sizeAfter, "⛔ a bukott lezárás NEM írt a döntés-fájlba", `${sizeBefore} → ${sizeAfter}`);
}

console.log("── ⑦ AZ ÉRTESÍTŐ MEGSZÓLAL a nyitott REFINE-ra ──");
{
  // Ez az az eset, amiben eddig NÉMA volt: minden review párosítva, mégis áll eldöntetlen
  // kanonikus-szöveg javaslat. A korpusz ÜRES review-halmazt ad → a szólás oka CSAK a REFINE.
  const dom = domainFixture("notify", OLD, "applied");
  const q = loadRefineQueue(dom, path.join(dom, "_tools/REFINE-DECISIONS.md"));
  const emptyCorpus = readCorpus(path.join(dom, "_inbox"), []);
  const withRefine = plan(emptyCorpus, Date.now(), [], ROOT, q.open);
  const without = plan(emptyCorpus, Date.now(), [], ROOT, []);
  measured++;
  check(withRefine.speak, "⛔ nyitott REFINE-ra SZÓL, pedig 0 review vár");
  check(/REFINE/.test(withRefine.emailSubject + withRefine.emailText), "az üzenet meg is NEVEZI a REFINE-t");
  check(/refine-queue\.mts/.test(withRefine.emailText), "…és megadja a sor megnyitásának parancsát");
  check(withRefine.sms.includes("REFINE"), "az SMS is megemlíti", withRefine.sms.slice(0, 80));
  // NEGATÍV KONTROLL: ugyanaz a korpusz REFINE nélkül — szerkezeti lelet miatt szól, de
  // a REFINE-szakasz NEM jelenhet meg.
  check(!/ELDÖNTETLEN REFINE/.test(without.emailText), "(kontroll) REFINE nélkül nincs REFINE-szakasz");
}

console.log("── ⑧ AZ ÁG-FELISMERŐ nem nyúlhat IDEGEN ághoz ──");
{
  // ⛔ MÉRT ÉLES KÁR (2026-09-22): a `wt/distill*` glob illeszkedett a `wt/distillnotify`
  // ágra — egy ember munka-ágára —, és a szerszám kész `branch -D` paranccsal ajánlotta
  // törlésre. A desztilláló ágai MINDIG `wt/distill<ÉÉÉÉHHNN>` alakúak; a nyolc számjegy
  // a megkülönböztető jel. Ezt a mintát itt tűzzük ki, hogy ne lazulhasson vissza.
  const src = readFileSync(path.join(ROOT, "_planning/DOMAIN/_tools/distill-apply.mts"), "utf8");
  measured++;
  check(
    /\/\^wt\\\/distill\\d\{8\}\$\//.test(src),
    "az ág-felismerő a DÁTUM-alakra szűkít (nem puszta wt/distill* glob)",
  );
  // És a viselkedés maga: a minta ne fogja meg az ember-ágakat.
  const RE = /^wt\/distill\d{8}$/;
  const emberAgak = ["wt/distillnotify", "wt/distiller", "wt/distill-kiserlet"];
  const gepAgak = ["wt/distill20260920", "wt/distill20260922"];
  measured++;
  check(emberAgak.every((b) => !RE.test(b)), "EMBER-ágakat nem fog meg", emberAgak.filter((b) => RE.test(b)).join(", "));
  check(gepAgak.every((b) => RE.test(b)), "a GÉP saját ágait viszont igen", gepAgak.filter((b) => !RE.test(b)).join(", "));
}

console.log("── ÉLES SZEMLE (tájékoztatás, nem kapu) ──");
{
  const q = loadRefineQueue();
  const by = new Map<string, number>();
  for (const p of q.open) by.set(p.status, (by.get(p.status) ?? 0) + 1);
  console.log(`  ℹ️  éles sor: ${q.all.length} javaslat · ${q.open.length} nyitott · ${q.decisions.size} eldöntve`);
  if (q.open.length) console.log(`  ℹ️  ${[...by].sort().map(([k, v]) => `${k}=${v}`).join(" · ")}`);
}

rmSync(WORK, { recursive: true, force: true });
void readDecisions;

summarize();
process.exit(fails.length ? 1 : 0);
