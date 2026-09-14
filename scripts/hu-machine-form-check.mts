// GÉPIES-ALAK ŐR — magyar névelőt és toldalékot SOHA nem választatunk az olvasóval.
//
// ⛔ MIÉRT: az ADR-0101 ① kimondottan tiltja a „a(z)"-t (a tulaj a saját postaládájában
// olvasta ki a levélből, hogy „érezhetően gépi"), és a megoldás azóta ott van a kódban
// (`src/hu.ts › huArticle`). Az Elek 2026-09-13-i futásában mégis HÁROM külön körben jött
// vissza (FK-002 E1, FK-005b E-11, FK-006a/b ZAVAROS-6) — mert a tilalmat semmi nem mérte.
// Ugyanez a hibaosztály másik fele a toldalék: a bérlői Előfizetés lap „minden hónap
// 10-a/-e"-t írt, holott a 31 nap végződése ZÁRT TÉNY (ADR-0144 ② szelleme; a napi
// sorszám-toldalékot a `src/text/day.ts › formatMonthDay` dönti el).
//
// A KÖZÖS mag mindkettőben: TUDJUK a helyes alakot, csak nem számoltuk ki, és a döntést
// az olvasóra hagytuk. Ez az őr ezt a MULASZTÁST méri, nem két konkrét sztringet.
//
// HÁROM RÉTEG, mert mindegyik ott vak, ahol a következő lát (a minta az internal-ref-check):
//   ① RENDERELT — a VALÓDI tenant-admin és konzol-lapok `innerText`-je, bejelentkezve,
//      plusz a VENDÉGNEK szállított generált oldal minden sablonon. ⚠️ Ez az a réteg, ami
//      az ADAT-ból jövő feliratot is látja: a felületi szöveg egy része migrációs seed és
//      DB-sor, nem forrás-literál — a puszta forrás-grep ott tisztát jelent, miközben a
//      lap mást mutat.
//   ② TERMELŐK — a csak HIBÁS ágon előálló VEVŐI üzenetek: a felfüggesztés előtti SMS,
//      a webcím-kudarc és -elszámolás levele, a megkeresés-kapu ok-sorai. Egy körbejárás
//      egyetlen ilyet sem renderel, pedig ezek mennek a vevő telefonjára.
//   ③ STATIKUS IKER — minden felhasználó-felé néző forrásfájl string-literálja (TS AST-ből,
//      a `console.*` naplósorok nélkül), az i18n-katalógus, a migrációk ÍRT szövege és a
//      súgó-cikkek. A körbejárás csak azt látja, amit meglátogat; ez minden literált lát.
//
// ⛔ AMIT SZÁNDÉKOSAN NEM MÉR (kimondva, hogy a zöld ne olvasódjon többnek):
//   · a `console.*` fejlesztői napló és a `throw new Error(...)` kivétel-szöveg (pl.
//     `src/domains/registrar/websupport.ts`) — ezeket fejlesztő olvassa, nem felhasználó;
//   · a `scripts/` saját kimenete (fejlesztői eszköz).
//
//   npx tsx scripts/hu-machine-form-check.mts
//   npx tsx scripts/hu-machine-form-check.mts --fast        (böngésző nélkül: ② + ③ + vendég-oldal)
//   npx tsx scripts/hu-machine-form-check.mts --self-test    (piros önteszt: fogjon-e egyáltalán)

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls
process.env.CONSOLE_PORT = "0";
process.env.PUBLIC_PORT = "0";

import { readFile, readdir } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import type { Server } from "node:http";

import { chromium, type BrowserContext } from "playwright-core";
import ts from "typescript";

import { I18N_SOURCES } from "./i18n-sources.mjs";
import { SCOPE as SURFACE_SCOPE } from "./ui-surface-scope.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");
/** `--fast`: böngésző nélkül. A commit-kapu ezt futtatja; az ① réteg konzol/tenant-admin
 *  fele szervert + Playwrightot kér, az a TELJES futás. A vendég-oldal FAST módban is fut
 *  (a generátor böngésző nélkül renderel), mert a hibaosztály ott is előfordult. */
const FAST = process.argv.includes("--fast");

// ── A minta ────────────────────────────────────────────────────────────────────
interface Rule {
  readonly name: string;
  readonly re: RegExp;
  readonly why: string;
  /**
   * Csak EMBER ÁLTAL OLVASOTT szövegen fut (renderelt lap, előállított üzenet, vagy egy
   * `T()`/`tr()` argumentuma). ⛔ MÉRVE, miért kell: a zárójeles-toldalék minta a nyers
   * forrás-literálokon **189 hamis leletet** adott — a `<script>` blokkok JS-hívásaira
   * (`forEach(function(el){…}`, `citCf(this)`). Egy őr, ami szigorúbban mér, mint a mért
   * rendszer, hamis leletet gyárt; a `T()`-be írt literál viszont SZERKEZETILEG az, amit
   * ember olvas — ezért a szűkítés nem kivétel-lista, hanem a szöveg definíciója.
   */
  readonly humanTextOnly?: boolean;
}
const RULES: readonly Rule[] = [
  // „a(z) Rozé Fogadó", „A(z) napfenypanzio.hu" — a névelőt a `huArticle()` tudja.
  { name: "zárójeles névelő", re: /[Aa]\(z\)/g, why: "huArticle() / huArticleLower() dönti el (src/hu.ts)" },
  // „10-a/-e", „5-tól/-től", „{n}-ja/-je" — a végződés a szóból/számból következik.
  {
    name: "kettős toldalék",
    re: /-\p{L}{1,5}\/-\p{L}{1,5}/gu,
    why: "számítsd ki (napra: formatMonthDay() a src/text/day.ts-ben)",
  },
  // A hibaosztály általános alakja: zárójelbe tett VÁLASZTHATÓ toldalék a szó végén —
  // „Ügyfél(ünk)", „nap(ok)", „megrendelő(k)". Ugyanaz a mulasztás: tudjuk, melyik kell.
  {
    name: "zárójeles toldalék",
    humanTextOnly: true,
    re: /\p{L}\((?:[aábcdeéfghiíjklmnoóöőprstuúüűvz]{1,4})\)/gu,
    why: "válaszd ki az egyik alakot — a felhasználó ne ragozzon helyettünk",
  },
];

interface Hit {
  readonly rule: string;
  readonly match: string;
  readonly where: string;
  readonly text: string;
}

/** ⛔ EGY döntőbíró — mind a három réteg ezt hívja, így nem tudnak széttartani.
 *  `humanText=false` csak a nyers forrás-literálokra igaz (ott a `<script>`-ek JS-kódja is
 *  literál); a renderelt lap, az előállított üzenet és a `T()`-argumentum mind emberi szöveg. */
function findMachineForms(text: string, where: string, humanText = true): Hit[] {
  const hits: Hit[] = [];
  for (const { name, re, humanTextOnly } of RULES) {
    if (humanTextOnly && !humanText) continue;
    for (const m of text.matchAll(new RegExp(re.source, re.flags))) {
      const from = Math.max(0, m.index - 60);
      hits.push({
        rule: name,
        match: m[0],
        where,
        text: text.slice(from, Math.min(text.length, m.index + 80)).replace(/\s+/g, " ").trim(),
      });
    }
  }
  return hits;
}

const failures: Hit[] = [];
const notes: string[] = [];
let structuralFails = 0;
function report(hits: readonly Hit[]): void {
  failures.push(...hits);
}
function line(ok: boolean, label: string, detail = ""): void {
  console.log(`  ${ok ? "✅" : "⛔"} ${label}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) structuralFails++;
}

// ═══ ③ STATIKUS IKER ═══════════════════════════════════════════════════════════
/**
 * Operátor-felé néző magyar szöveg, ami KÍVÜL van az i18n-doktrínán (nincs mit fordítani
 * rajta), de EMBER olvassa a konzolban vagy egy riasztó-levélben. Ugyanaz a lista, amit az
 * internal-ref-check tart — a két őr ugyanarra a felületre méri a maga szabályát.
 */
const OPERATOR_TEXT: readonly string[] = [
  "src/outreach/outreachCheck.ts",
  "src/outreach/sendBatch.ts",
  "src/outreach/sendOutreachSms.ts",
  "src/outreach/sendOutreachPair.ts",
  "src/outreach/pairRepair.ts",
  "src/console/server.ts",
  "src/console/aamAlert.ts",
  "src/console/prospectNotice.ts",
  "src/console/testLogViews.ts",
  "src/console/partnerData.ts",
];

/**
 * Felhasználó-felé néző szöveg, ami EGYIK meglévő listán sincs rajta — a mérés hozta ki,
 * nem az emlékezetem. Ha ezek nem lennének itt, az őr NÉMÁN vak lenne rájuk; a doktrína
 * hatóköre a fájllista (feedback_guard_scope_is_the_doctrine).
 */
const EXTRA_HUMAN_TEXT: readonly string[] = [
  // A VENDÉGNEK szállított no-JS foglalás-kártya szövege (a generált lapra kerül).
  "src/generator/runtime.ts",
  // A bérlő a nyelv-rendelés hibaüzenetét a saját képernyőjén olvassa.
  "src/tenant/multilangOrder.ts",
  // Operátor-riasztás levél (elakadt, KIFIZETETT nyelv-generálás).
  "src/tenant/multilangResume.ts",
  // A konzol újraminősítés-gombjának visszautasító üzenete.
  "src/scraper/reenrichOne.ts",
];

/**
 * A fejlesztői NAPLÓ nem felület: a `console.warn("[billing] … a(z) …")` a szerver-logba
 * megy. A döntés STRUKTURÁLIS (a literál egy console.* híváson belül van), nem kulcsszavas
 * kivétel-lista — így egy új naplósor magától a helyes oldalra esik.
 */
function insideDevLog(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const callee = p.expression.getText(sf);
      if (/^console\.(log|warn|error|info|debug)$/.test(callee)) return true;
    }
  }
  return false;
}

/** Egy literál EMBERI szöveg-e: `T(lang, "…")` / `tr("…")` argumentuma. Ez a szerkezeti
 *  definíciója annak, hogy „ezt olvassa valaki" — nem szólista. */
function insideUiText(node: ts.Node, sf: ts.SourceFile): boolean {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (ts.isCallExpression(p)) {
      const callee = p.expression.getText(sf);
      if (/^(?:T|tr)$/.test(callee)) return true;
    }
  }
  return false;
}

/** Minden STRING LITERÁL egy TS fájlból (AST-ből, nem regexszel — a KOMMENT így
 *  szerkezetileg marad ki. ⚠️ Ez nem apróság: ennek az őrnek a saját magyarázó
 *  kommentjei idézik a tiltott alakot, és egy nyers fájl-olvasás magát buktatná le. */
function literalsOf(sf: ts.SourceFile): { text: string; line: number; ui: boolean }[] {
  const out: { text: string; line: number; ui: boolean }[] = [];
  const visit = (n: ts.Node): void => {
    const isLit =
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n);
    if (isLit && !insideDevLog(n, sf)) {
      const { line } = sf.getLineAndCharacterOfPosition(n.pos);
      out.push({ text: (n as ts.LiteralLikeNode).text, line: line + 1, ui: insideUiText(n, sf) });
    }
    n.forEachChild(visit);
  };
  visit(sf);
  return out;
}

/** Egy SQL sor a `--` komment NÉLKÜL, idézet-tudatosan (a `--` egy stringben szöveg). */
function stripSqlComment(lineRaw: string): string {
  let inStr = false;
  for (let i = 0; i < lineRaw.length; i++) {
    const c = lineRaw[i];
    if (c === "'") inStr = !inStr;
    else if (!inStr && c === "-" && lineRaw[i + 1] === "-") return lineRaw.slice(0, i);
  }
  return lineRaw;
}

/**
 * Az a szöveg, amit egy migráció TÉNYLEGESEN BEÍR egy oszlopba (INSERT … VALUES,
 * UPDATE … SET). Ez a felhasználó-felé néző ADAT — a `COMMENT ON` séma-dokumentáció, a
 * `WHERE` utáni rész pedig ÖSSZEHASONLÍTÁS, ami épp a RÉGI (hibás) értéket idézheti.
 */
function writtenSqlText(sqlRaw: string): string[] {
  const sql = sqlRaw
    .split("\n")
    .map((l) => stripSqlComment(l))
    .join("\n");
  const out: string[] = [];
  for (const stmtRaw of sql.split(";")) {
    const stmt = stmtRaw.trim();
    if (!/^(insert|update)\b/i.test(stmt)) continue;
    let cut = stmt.length;
    let inStr = false;
    for (let i = 0; i < stmt.length; i++) {
      if (stmt[i] === "'") inStr = !inStr;
      else if (!inStr && /where/i.test(stmt.slice(i, i + 5)) && !/\w/.test(stmt[i - 1] ?? " ")) {
        cut = i;
        break;
      }
    }
    for (const m of stmt.slice(0, cut).matchAll(/'((?:[^']|'')*)'/g)) out.push(m[1].replace(/''/g, "'"));
  }
  return out;
}

async function kbFiles(): Promise<string[]> {
  const base = path.join(ROOT, "kb/entries");
  const dirs = await readdir(base, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    for (const f of await readdir(path.join(base, d.name))) {
      if (f.endsWith(".md")) out.push(path.join("kb/entries", d.name, f));
    }
  }
  return out.sort();
}

async function staticTwin(): Promise<void> {
  console.log("\n③ STATIKUS IKER — forrás-literálok + i18n-katalógus + migráció-adat + súgó");
  const files = [...new Set([...I18N_SOURCES, ...SURFACE_SCOPE, ...OPERATOR_TEXT, ...EXTRA_HUMAN_TEXT])]
    .filter((f) => f.endsWith(".ts"))
    .sort();
  const before = failures.length;
  let scanned = 0;
  for (const rel of files) {
    const src = await readFile(path.join(ROOT, rel), "utf8").catch(() => "");
    if (!src) continue;
    scanned++;
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.ESNext, true);
    for (const lit of literalsOf(sf)) {
      // A literálba ÍRT blokk-komment (a <style>/<script> sávok) sem látszik a lapon.
      report(findMachineForms(lit.text.replace(/\/\*[\s\S]*?\*\//g, " "), `${rel}:${lit.line}`, lit.ui));
    }
  }
  // Az i18n-katalógus a fordítók bemenete: ami ott gépies, az MINDEN nyelven az marad.
  const catalog = JSON.parse(await readFile(path.join(ROOT, "src/i18n/catalog.json"), "utf8")) as string[];
  for (const s of catalog) report(findMachineForms(s, "src/i18n/catalog.json"));

  // ⛔ ADAT-ÚT: a felületi szöveg egy része MIGRÁCIÓS SEEDBŐL jön, nem literálból.
  const sqlFiles = (await readdir(path.join(ROOT, "migrations")).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let sqlStrings = 0;
  for (const f of sqlFiles) {
    for (const w of writtenSqlText(await readFile(path.join(ROOT, "migrations", f), "utf8"))) {
      sqlStrings++;
      report(findMachineForms(w, `migrations/${f}`));
    }
  }
  // A súgó a KÉPERNYŐ szövegét IDÉZI — ha a lap megjavul és a súgó nem, a cikk hazudik.
  const kb = await kbFiles();
  for (const rel of kb) {
    const md = await readFile(path.join(ROOT, rel), "utf8");
    md.split("\n").forEach((l, i) => report(findMachineForms(l, `${rel}:${i + 1}`)));
  }
  console.log(
    `  ${scanned} forrásfájl · ${catalog.length} katalógus-sor · ${sqlStrings} migrációs érték · ${kb.length} súgó-cikk`,
  );
  line(catalog.length > 1000, "a katalógus betöltődött (nem üres a mérés)", `${catalog.length} sor`);
  line(failures.length === before, "nincs gépies alak a felhasználói szövegben (statikus)");
}

/** Csak a LÁTHATÓ szöveg: a markup nem az olvasónak szól. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ");
}

// ═══ ② TERMELŐK ════════════════════════════════════════════════════════════════
async function producers(): Promise<void> {
  console.log("\n② TERMELŐK — csak a HIBÁS ágon előálló VEVŐI üzenetek + kapu-ok-sorok");
  const before = failures.length;
  const { buildFinalWarningSmsText, buildRenewalFinalWarningEmail, buildSiteFrozenEmail } = await import(
    "../src/email/billingEmail.js"
  );
  const { buildDomainFailedEmail, buildDomainSettlementEmail } = await import("../src/email/domainEmail.js");
  const { checkOutreachDraft, checkOutreachSms } = await import("../src/outreach/outreachCheck.js");

  // ⭐ A NÉV, amiből a névelő számítódik, SZÁNDÉKOSAN kétféle: magánhangzós és
  // mássalhangzós kezdetű. Egy „a(z)" visszacsempészése az EGYIKEN mindenképp látszik,
  // és a hibás huArticle-hívást is kimutatja.
  const NAMES = ["Rozé Fogadó", "Aranyhal Panzió"];
  const DOMAINS = ["napfenypanzio.hu", "aranyhal.hu"];
  const messages: { text: string; where: string }[] = [];
  for (const site of NAMES) {
    messages.push({
      text: buildFinalWarningSmsText({ siteName: site, freezeDate: "2027-09-10", payUrl: "https://x/p" }),
      where: `SMS: felfüggesztés előtti figyelmeztetés (${site})`,
    });
    const mail = buildRenewalFinalWarningEmail({
      to: "a@b.hu",
      siteName: site,
      amount: 14900,
      currency: "HUF",
      payUrl: "https://x/p",
      freezeDate: "2027-09-10",
    } as Parameters<typeof buildRenewalFinalWarningEmail>[0]);
    messages.push({ text: `${mail.subject}\n${mail.text}`, where: `levél: utolsó figyelmeztetés (${site})` });
    const frozen = buildSiteFrozenEmail({
      to: "a@b.hu",
      siteName: site,
      amount: 14900,
      currency: "HUF",
      payUrl: "https://x/p",
    } as Parameters<typeof buildSiteFrozenEmail>[0]);
    messages.push({ text: `${frozen.subject}\n${frozen.text}`, where: `levél: honlap felfüggesztve (${site})` });
  }
  for (const domain of DOMAINS) {
    const lost = buildDomainFailedEmail({ to: "a@b.hu", domain, adminUrl: "https://x/admin" });
    messages.push({ text: `${lost.subject}\n${lost.text}`, where: `levél: a webcím elkelt (${domain})` });
    for (const takeDomain of [true, false]) {
      const settle = buildDomainSettlementEmail({
        to: "a@b.hu",
        domain,
        totalFormatted: "56 000 Ft",
        monthsRemaining: 7,
        penaltyBaseFormatted: "8 000 Ft",
        takeDomain,
        payUrl: "https://x/p",
        accessEndDate: "2027. 09. 10",
      } as Parameters<typeof buildDomainSettlementEmail>[0]);
      messages.push({
        text: `${settle.subject}\n${settle.text}`,
        where: `levél: lemondás-elszámolás (${domain}, viszi=${takeDomain})`,
      });
    }
  }
  for (const m of messages) report(findMachineForms(m.text, m.where));

  // A megkeresés-kapu ok-sorai: szándékosan ELROMLOTT piszkozat, hogy MINDEN ok előálljon.
  const badDraft = {
    subject: "Elkészült az új honlapja!",
    body: "Kedves Szállásadó! Elkészült az oldala. Üdvözlettel: ",
  } as Parameters<typeof checkOutreachDraft>[0];
  const reasons = [
    ...checkOutreachDraft(badDraft, "", "de", { country: "AT", approved: false }).reasons,
    ...checkOutreachDraft(badDraft, "", "pl", undefined).reasons,
    ...checkOutreachDraft(badDraft, "", "hu", { country: "HU", approved: true }).reasons,
    ...checkOutreachSms({ text: "Elkészült a honlapja! http://x", link: "", unsubscribeLink: "" }, "", "de", {
      country: "AT",
      approved: false,
    }).reasons,
  ];
  for (const r of reasons) report(findMachineForms(r, "megkeresés-kapu ok-sor"));

  // ⛔ AZ ELŐFIZETÉS KÁRTYA — a park nem tudja előállítani, de a lelet ITT élt.
  // Mérve: a közös dev-parkban NULLA `subscription` sor van, ezért a körbejárás az
  // Előfizetés kártyát MEG SEM RENDERELI; az első lefedettség-tanúm ettől függetlenül
  // zöld volt, mert a „Fordulónap" szót a tenant-admin SÚGÓ füléről, a KB-cikkből
  // olvasta. A kártyát ezért a VALÓDI nézet-függvényből állítjuk elő, MIND A 31 napra
  // és mindkét ütemre — ez a park állapotától független, és kimerítő.
  const { modulesSection } = await import("../src/server/adminViews.js");
  const { MODULE_CATALOG, supersederOf } = await import("../src/modules.js");
  const { getBaseMonthly, getModulePrice, loadPricing } = await import("../src/pricing.js");
  await loadPricing();
  const activeIds = MODULE_CATALOG.map((c) => c.id);
  // A fixture a TERMÉK saját regiszteréből épül, nem kézzel írt alakból: a `scripts/`
  // NINCS típus-ellenőrizve (reference_scripts_are_not_typechecked), ezért egy kitalált
  // mező némán átmenne — a `supersededBy`-t is a termék `supersederOf`-ja dönti el.
  const modules = MODULE_CATALOG.map((c) => ({
    id: c.id,
    label: c.label,
    publicDesc: c.publicDesc ?? "",
    group: c.group,
    spine: !!c.spine,
    active: true,
    priceMonthly: getModulePrice(c.id),
    supersededBy: supersederOf(c.id, activeIds),
    cancelAtPeriodEnd: false,
    awaitingFirstCharge: false,
  }));
  const superseded = modules.filter((m) => m.supersededBy).length;
  const mv = { modules, baseMonthly: getBaseMonthly(), totalMonthly: getBaseMonthly() };
  let cards = 0;
  for (let day = 1; day <= 31; day++) {
    for (const billingPeriod of ["monthly", "annual"] as const) {
      const sub = {
        status: "active",
        periodEnd: `2027-09-${String(day).padStart(2, "0")}`,
        renewDay: day,
        nextInvoiceTotal: 14900,
        nextInvoiceItems: [],
        payUrl: null,
        arrears: null,
        closesOn: "2027-10-10",
        frozenOn: null,
        restoredOn: null,
        cancelAtPeriodEnd: false,
        billingPeriod,
        pendingAnnual: false,
        pendingEffectiveDate: null,
        annualTotal: 149000,
        annualSavings: 29800,
        annualFreeMonths: 2,
        autoCharge: true,
        coupon: null,
      };
      const html = modulesSection(mv as never, sub as never, null, "segitseg@citoviso.com", null, "hu");
      cards++;
      report(findMachineForms(visibleText(html), `Előfizetés+Modulok kártya (${day}., ${billingPeriod})`));
      if (day === 1 && billingPeriod === "monthly") {
        // Egy üres render NEM zöld: a kártyának tényleg tartalmaznia kell a cellát és
        // a leváltás-sort, különben a 62 mérés semmit nem bizonyít.
        const txt = visibleText(html);
        line(/Fordulónap/.test(txt), "a kártya tényleg renderelte a Fordulónap-cellát");
        line(/váltja ki/.test(txt), "a kártya tényleg renderelte a leváltás-sort", `${superseded} leváltott modul`);
      }
    }
  }

  console.log(`  ${messages.length} vevői üzenet + ${reasons.length} kapu-ok-sor + ${cards} Előfizetés-kártya előállítva`);
  line(cards === 62, "mind a 31 nap × 2 ütem lerenderelve", `${cards}/62`);
  // Egy üres mérés NEM zöld: akkor a réteg nem mért semmit.
  line(messages.length >= 10, "tényleg előálltak a vevői üzenetek", `${messages.length} db`);
  line(reasons.length >= 6, "tényleg előálltak a kapu-ok-sorok", `${reasons.length} db`);
  line(failures.length === before, "nincs gépies alak a hibás ág üzeneteiben");
}

// ═══ ① RENDERELT / a) a VENDÉGNEK szállított oldal ═════════════════════════════
async function guestSurface(): Promise<void> {
  console.log("\n① RENDERELT / a) — a VENDÉGNEK szállított generált oldal (minden sablon)");
  const before = failures.length;
  const { renderSite } = await import("../src/engine/render.js");
  const { TEMPLATES } = await import("../src/engine/templates.js");
  const { injectRuntime } = await import("../src/generator/runtime.js");
  const data = {
    name: "Rozé Fogadó",
    tagline: "A tóparton",
    intro: "Teszt bevezető szöveg.",
    highlights: ["Zsúpfedeles borospince"],
    photos: [{ url: "https://img.example/1.jpg", alt: "kert", provenance: "portal" }],
    contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Fő utca 12." },
  } as Parameters<typeof renderSite>[1];
  const ids = Object.keys(TEMPLATES);
  for (const t of ids) {
    const html = renderSite({ template: t, skin: "", archetype: "", sections: [] }, data, { phase: "mock" });
    report(findMachineForms(visibleText(html), `vendég-oldal: ${t}`));
  }
  // ⛔ A no-JS foglalás-kártya CSAK akkor áll elő, ha a slot ÜRESEN érkezik — a fenti
  // körbejárás ezt sosem produkálja, pedig e-mail-kliensben és JS nélkül EZT látja a vendég.
  // Két néven futtatva (magánhangzós/mássalhangzós), hogy a névelő-számítás is mérve legyen.
  let fallbacks = 0;
  for (const name of ["Rozé Fogadó", "Aranyhal Panzió"]) {
    const empty = `<html><body><section data-cit-module="booking" data-cit-name="${name}" data-cit-email="a@b.hu"></section></body></html>`;
    const out = await injectRuntime(empty, "hu");
    const text = visibleText(out);
    if (text.includes("Vegye fel a kapcsolatot")) fallbacks++;
    report(findMachineForms(text, `vendég-oldal: no-JS foglalás-kártya (${name})`));
  }
  console.log(`  ${ids.length} sablon + ${fallbacks} no-JS foglalás-kártya megmérve`);
  line(ids.length >= 10, "minden sablon renderelődött", `${ids.length} db`);
  line(fallbacks === 2, "a no-JS foglalás-kártya tényleg előállt (nem üres a mérés)", `${fallbacks}/2`);
  line(failures.length === before, "nincs gépies alak a vendég-oldali szövegben");
}

// ═══ ① RENDERELT / b) a BEJELENTKEZETT felületek ═══════════════════════════════
/** Nem HTML-felület vagy nincs saját szövege — indoklással kihagyva. */
const ROUTE_SKIP: Readonly<Record<string, string>> = {
  "/favicon.ico": "ikon, nem szöveg",
  "/logout": "átirányítás, nincs saját szövege",
  "/documents.csv": "CSV letöltés, nem felület",
  "/operator/lang": "nyelvváltó POST, átirányít",
  "/entities/bootstrap": "POST-művelet, átirányít",
  "/photo": "aláírt kép-proxy (bináris) — nincs szövege",
  "/pay/done": "a publikus szerver fizetés-lapja, nem konzol-felület",
};

async function loggedInSurfaces(): Promise<void> {
  console.log("\n① RENDERELT / b) — a valódi tenant-admin + konzol lapok látható szövege");
  const { db } = await import("../src/db/client.js");

  const { server: consoleServer } = (await import("../src/console/server.js")) as { server: Server };
  if (!consoleServer.listening) await once(consoleServer, "listening");
  const conBase = `http://127.0.0.1:${(consoleServer.address() as { port: number }).port}`;
  const { server: publicServer } = (await import("../src/server/public.js")) as { server: Server };
  if (!publicServer.listening) await once(publicServer, "listening");
  const pubBase = `http://127.0.0.1:${(publicServer.address() as { port: number }).port}`;

  const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
  const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
  const op = await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst();
  const lead = await db
    .selectFrom("lead")
    .select(["id"])
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  const partner = await db.selectFrom("partner").select(["id"]).limit(1).executeTakeFirst();
  // ⛔ A FIXTURE NEM MINDEGY: egy tetszőleges bérlő admin-felületén az Előfizetés kártya
  // (ahol a „10-a/-e" élt) MEG SEM JELENIK. Először előfizetéssel rendelkezőt keresünk,
  // és csak ha nincs, esünk vissza bármelyikre — a lefedettség-tanú alább kimondja,
  // ha így a mérés lyukas maradt.
  const tenantUserQ = db
    .selectFrom("tenant_user")
    .innerJoin("site", "site.tenant_id", "tenant_user.tenant_id")
    .select(["tenant_user.id as id"]);
  const tenantUser =
    (await tenantUserQ
      .innerJoin("subscription", "subscription.tenant_id", "tenant_user.tenant_id")
      .limit(1)
      .executeTakeFirst()) ?? (await tenantUserQ.limit(1).executeTakeFirst());
  line(!!op, "van operátor-fiók a körbejáráshoz");
  line(!!tenantUser, "van tenant-fiók (site-tal) a tenant-adminhoz");
  if (!op || !tenantUser) {
    notes.push("a bejelentkezett réteg fixture nélkül NEM futott — ez nem zöld, hanem mérés nélküli állapot");
    await db.destroy();
    return;
  }

  // A konzol route-listája a szerver SAJÁT forrásából — nem emlékezetből.
  const srv = await readFile(path.join(ROOT, "src/console/server.ts"), "utf8");
  const declared = new Set<string>();
  for (const m of srv.matchAll(/method === "GET" && path === "(\/[^"]*)"/g)) declared.add(m[1]!);
  for (const m of srv.matchAll(/if \(path === "(\/[^"]*)"\)/g)) declared.add(m[1]!);
  const consoleVisits = [
    ...[...declared].filter((r) => !(r in ROUTE_SKIP)),
    ...(lead ? [`/lead/${lead.id}`] : []),
    ...(partner ? [`/partner/${partner.id}`] : []),
  ];

  // A tenant-admin fülei a SAJÁT forrásukból — egy új fül magától belép a mérésbe.
  const adminSrc = await readFile(path.join(ROOT, "src/server/adminViews.ts"), "utf8");
  const tabs = [...adminSrc.matchAll(/\{ id: "([a-z]+)", label: T\(/g)].map((m) => m[1]!);
  line(tabs.length >= 8, "a tenant-admin fülei kiolvashatók a forrásból", `${tabs.length} fül`);
  const adminVisits = tabs.map((t) => `/admin?tab=${t}`);

  const browser = await chromium.launch({
    executablePath: (await import("../src/config.js")).config.chromiumPath,
  });
  let selfTested = false;
  // ⛔ LEFEDETTSÉG-TANÚ. Mérve: a bejelentett leletet (a Fordulónap-cella „10-a/-e"-je)
  // visszarontva a STATIKUS réteg fogta meg, a renderelt NEM — mert a közös parkban a
  // bejárt bérlőnek nincs előfizetés-kártyája. Egy „11/11 lap megmérve" sor ilyenkor
  // LEFEDETTSÉGNEK olvasódik, pedig az a képernyő, ahol a hiba élt, nem is volt ott.
  // A tanú ezért nem megjegyzés, hanem KAPU: ha a horgony-felirat nincs a begyűjtött
  // szövegben, a réteg NEM mért — és ezt ki is mondja.
  const harvested = new Map<string, string>();
  const scan = async (ctx: BrowserContext, base: string, routes: readonly string[], tag: string): Promise<void> => {
    const page = await ctx.newPage();
    let visited = 0;
    for (const r of routes) {
      const res = await page.goto(`${base}${r}`, { waitUntil: "domcontentloaded" }).catch(() => null);
      if (!res) {
        notes.push(`${tag}${r}: nem töltődött be — nem mérve`);
        continue;
      }
      if (res.status() >= 400) {
        notes.push(`${tag}${r}: HTTP ${res.status()} — nem mérve`);
        continue;
      }
      visited++;
      const seen = await page.evaluate(() => document.body.innerText);
      harvested.set(tag, (harvested.get(tag) ?? "") + "\n" + seen);
      report(findMachineForms(seen, `${tag}${r}`));
      if (SELF_TEST && !selfTested) {
        // A KINYERŐ ÚT öntesztje: a `innerText`-en át is fogja-e a gépies alakot?
        // (Egy szabály-szintű önteszt nem bizonyítja, hogy a mérő-út egyáltalán lát.)
        selfTested = true;
        await page.evaluate(() => {
          const p = document.createElement("p");
          p.textContent = "Ezt most a(z) „Térkép” váltja ki — minden hónap 10-a/-e";
          document.body.prepend(p);
        });
        const poisoned = await page.evaluate(() => document.body.innerText);
        line(
          findMachineForms(poisoned, "önteszt").length >= 2,
          `önteszt: a ${tag} lapra injektált gépies alakot megfogja`,
        );
      }
    }
    await page.close();
    console.log(`  ${tag} — ${visited}/${routes.length} lap megmérve`);
  };

  const conCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await conCtx.addCookies([{ name: "cit_op_session", value: mintOperatorCookieValue(op.id), url: conBase }]);
  await scan(conCtx, conBase, consoleVisits, "konzol");

  const tnCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await tnCtx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(tenantUser.id), url: pubBase }]);
  await scan(tnCtx, pubBase, adminVisits, "tenant-admin");

  await browser.close();
  await db.destroy();

  // A tanúk: felirat → melyik körbejárásban KELL látszania. Mindegyik egy olyan
  // képernyőt jelöl, ahol a hibaosztály ténylegesen élt (Elek FK-002/005b/006a).
  // ⛔ A TANÚ A TERMÉK KIMENETÉRE MUTASSON, NE A SÚGÓRA. Az első változatom a
  // „Fordulónap" szóra nézett — és ZÖLD lett úgy is, hogy az Előfizetés kártya meg sem
  // jelent: a szó a tenant-admin SÚGÓ fülén, a KB-cikkben állt. A tanú ezért a cella
  // ÉRTÉKÉNEK alakjára illeszkedik, amit csak a valódi kártya tud előállítani.
  const WITNESSES: readonly [string, RegExp, string][] = [
    ["tenant-admin", /Modulok/i, "a modul-lista füle"],
    ["konzol", /leadek/i, "a konzol lead-listája"],
  ];
  // ⚠️ Az Előfizetés kártya PARK-FÜGGŐ (nulla `subscription` sor esetén meg sem jelenik),
  // ezért itt NEM kapu — de a hiányát KIMONDJUK, hogy a „11/11 lap megmérve" ne
  // olvasódjon lefedettségnek. A képernyőt a ② réteg 31 napra kimerítően lefedi.
  if (!/(?:minden hónap|évente,)\s*\d{1,2}/.test(harvested.get("tenant-admin") ?? ""))
    notes.push(
      "a körbejárás NEM látta az Előfizetés kártyát (a parkban nincs subscription sor) — " +
        "azt a képernyőt a ② réteg fedi (31 nap × 2 ütem, a valódi modulesSection-ből)",
    );
  for (const [tag, re, what] of WITNESSES) {
    // ⚠️ Kis-nagybetű-érzéketlenül, ahol felirat: a „Leadek" tanú az „Aktív leadek"
    // címnek jogos részszövege — szigorúbb illesztés HAMIS leletet gyártana (ADR-0146).
    line(
      re.test(harvested.get(tag) ?? ""),
      `lefedettség-tanú: a(z) ${tag} körbejárás renderelte ezt: ${what}`,
      "a réteg NEM mérte azt a képernyőt — a park fixture-je hiányos, a zöld itt nem bizonyíték",
    );
  }
}

// ═══ ÖNTESZT (piros ág) ════════════════════════════════════════════════════════
async function selfTest(): Promise<void> {
  console.log("\n⚑ ÖNTESZT — fogjon-e egyáltalán, és NE fogjon-e túl sokat");
  const must: readonly [string, string][] = [
    ["Ezt most a(z) „Térkép” váltja ki", "a bejelentett lelet (ADR-0101 ①)"],
    ["A(z) napfenypanzio.hu már foglalt — próbáljon másikat.", "nagybetűs, mondat elején"],
    ["Citoviso: a(z) Rozé Fogadó honlapdíja rendezetlen.", "SMS-ben"],
    ["minden hónap 10-a/-e", "a Fordulónap-mező kettős toldaléka"],
    ["évente, 10-a/-e", "éves ütem, ugyanaz"],
    ["a szerződés 5-tól/-től él", "másik toldalék-pár, ugyanaz a hibaosztály"],
    ["Kedves Ügyfél(ünk)!", "zárójeles toldalék a szó végén"],
  ];
  for (const [text, what] of must) line(findMachineForms(text, "önteszt").length > 0, `megfogja: ${what}`);

  // ⛔ NEGATÍVAN IS: ami helyes magyar (vagy nem is toldalék), azt NEM szabad pirosra vinnie
  // — egy túlbuzgó őr ugyanúgy hazugságba kényszeríti a szöveget, mint egy vak.
  const mustNot: readonly [string, string][] = [
    ["Ezt most a Térkép váltja ki — a kettő ugyanazon a helyen jelenne meg.", "a JAVÍTOTT mondat"],
    ["Ezt most az Aranyhal váltja ki", "magánhangzós névelővel"],
    ["minden hónap 10-e", "a JAVÍTOTT Fordulónap (mássalhangzós)"],
    ["minden hónap 2-a", "a JAVÍTOTT Fordulónap (hátsó hangrend)"],
    ["évente, 1-je", "az elseje irreguláris alakja"],
    ["A csomag ára 9 990 Ft/hó", "per-jeles mértékegység"],
    ["Nyitva 0-24 óráig, 7/24 ügyelettel", "szám-per-szám"],
    ["A be-/kikapcsolás a Modulok fülön van", "kötőjel + per, de nem kettős toldalék"],
    ["Az Alap/Bővített csomag között választhat", "per-jel szavak között"],
    ["2026-09-13 és 2026-09-14 között", "ISO dátumok"],
    ["A vendég e-mail címe és telefonszáma", "kötőjeles összetétel"],
    ["A Ptk. 6:78. § alapján", "jogszabály-hivatkozás"],
    ["Foglalás megnyitása (a Foglalások fülre visz)", "zárójeles magyarázat, nem toldalék"],
  ];
  for (const [text, what] of mustNot) {
    const h = findMachineForms(text, "önteszt");
    line(h.length === 0, `NEM fogja meg (helyesen): ${what}`, h.map((x) => `${x.rule}:${x.match}`).join(","));
  }

  // A JAVÍTÁS ESZKÖZE is mérve: a nap-toldalék táblája ZÁRT tény, nem heurisztika. Ha ez
  // elromlik, az őr zöld maradna (nincs „/"), miközben a lap rosszul ragozna.
  const { formatMonthDay } = await import("../src/text/day.js");
  const expect: readonly [number, string][] = [
    [1, "1-je"],
    [2, "2-a"],
    [4, "4-e"],
    [10, "10-e"],
    [13, "13-a"],
    [20, "20-a"],
    [21, "21-e"],
    [30, "30-a"],
    [31, "31-e"],
  ];
  for (const [d, want] of expect) line(formatMonthDay(d) === want, `formatMonthDay(${d}) = „${want}”`, formatMonthDay(d));
  const all = Array.from({ length: 31 }, (_, i) => formatMonthDay(i + 1));
  line(all.every((s) => /^\d{1,2}-(a|e|je)$/.test(s)), "mind a 31 nap EGY végződést kap", all.join(" "));
  line(formatMonthDay(10, "de") === "10", "idegen nyelvi csomag a puszta számot kapja", formatMonthDay(10, "de"));
}

// ── futás ──────────────────────────────────────────────────────────────────────
console.log("GÉPIES-ALAK ŐR" + (SELF_TEST ? " — ÖNTESZT MÓD" : ""));
if (SELF_TEST) await selfTest();
await staticTwin();
await producers();
await guestSurface();
if (FAST) {
  // ⛔ A kihagyást KIMONDJUK: a néma szűkítés „mindent lefedtünk"-nek olvasódik.
  notes.push(
    "--fast mód: a bejelentkezett tenant-admin/konzol lapok (① b) NEM lettek megmérve — " +
      "az ADAT-ból (migrációs seed, DB-sor) érkező felirat most nincs lefedve",
  );
} else {
  await loggedInSurfaces();
}

console.log("\n" + "─".repeat(70));
if (notes.length) {
  console.log("⚠️  MEGJEGYZÉSEK (nem mért részek — a zöld ezekre NEM áll):");
  for (const n of notes) console.log(`   · ${n}`);
}
if (failures.length) {
  console.log(`\n⛔ ${failures.length} GÉPIES ALAK A FELHASZNÁLÓI SZÖVEGBEN:\n`);
  const byRule = new Map<string, Hit[]>();
  for (const h of failures) byRule.set(h.rule, [...(byRule.get(h.rule) ?? []), h]);
  for (const [rule, hits] of byRule) {
    const why = RULES.find((r) => r.name === rule)?.why ?? "";
    console.log(`  ── ${rule} (${hits.length}) — ${why} ──`);
    for (const h of hits) console.log(`     ${h.where}\n        „${h.text}"  →  ${h.match}`);
  }
}
const bad = failures.length + structuralFails;
console.log(
  bad === 0
    ? "\n✅ TISZTA — a felhasználó sehol nem kap választható névelőt vagy toldalékot."
    : `\n⛔ BUKÁS — ${failures.length} gépies alak + ${structuralFails} szerkezeti hiba.`,
);
process.exit(bad === 0 ? 0 : 1);
