// BELSŐ-HIVATKOZÁS ŐR — fejlesztői azonosító nem kerülhet EMBER által olvasott szövegbe.
//
// ⛔ MIÉRT: 2026-09-12-én a konzol Árazás-képernyőjén ez állt az operátor előtt:
// „Egyedi domain — feltételek (ADR-0109)", és a magyarázat is két ADR-számot idézett.
// Az ADR-szám a FEJLESZTÉS könyvtári jele — az operátor nem tudja kikeresni, a vevő
// pedig (ahol átlátszik) zsargonnak olvassa. Az INDOKLÁS maradjon, az azonosító menjen:
// a kód-KOMMENTBEN ott a helye, a képernyőn nincs.
//
// HÁROM RÉTEG, mert mindegyik ott vak, ahol a következő lát:
//   ① RENDERELT — a VALÓDI konzol- és tenant-admin lapok, bejelentkezve, Playwright
//      `innerText`-tel. Ezt olvassa a felhasználó; ezt egy forrás-grep nem bizonyítja.
//      A lefedettség nem emlékezetből jön: a route-listát a szerver SAJÁT forrásából
//      származtatjuk, és ami se nem látogatott, se nem indoklással kihagyott → BUKÁS
//      (különben egy új lap némán kikerül az őr alól).
//   ② TERMELŐK — a csak HIBÁS ágon megjelenő szövegek (a megkeresés-kapu ok-listája).
//      A zöld körbejárás egyetlen ilyet sem renderel: a boldog úton mért zöld egy
//      olyan képernyőt „bizonyítana", aminek a piros fele tele van §-hivatkozással.
//   ③ STATIKUS IKER — minden felhasználó-felé néző forrásfájl literálja + a súgó-
//      cikkek. A körbejárás csak azt látja, amit meglátogat; ez minden literált lát.
//      (Heurisztikus őr mellé strukturális iker kell.)
//
// ⚠️ A § NEM mindig belső: a JOGSZABÁLY-hivatkozás („2001. évi CVIII. törvény 4. §-a",
// „Ptk. 6:78. §") helyesen van a jogi szövegben. A minta ezért §+NAGYBETŰ (a saját
// doktrína-szakaszaink alakja), a jogszabályi § mellett ugyanis szám áll, nem betű.
//
//   npx tsx scripts/internal-ref-check.mts
//   npx tsx scripts/internal-ref-check.mts --self-test   (piros önteszt: fogjon-e egyáltalán)

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls
process.env.CONSOLE_PORT = "0";
process.env.PUBLIC_PORT = "0";

import { readFile, readdir } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import type { Server } from "node:http";

import { chromium, type Browser, type BrowserContext } from "playwright-core";
import ts from "typescript";

import { I18N_SOURCES } from "./i18n-sources.mjs";
import { SCOPE as SURFACE_SCOPE } from "./ui-surface-scope.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");
/** `--fast`: böngésző nélkül (② + ③). A commit-kapu ezt futtatja; az ① réteghez
 *  szerver + Playwright kell, az a TELJES futás (kézzel / felület-változás után). */
const FAST = process.argv.includes("--fast");

// ── A minta ────────────────────────────────────────────────────────────────────
interface Rule {
  readonly name: string;
  readonly re: RegExp;
}
const RULES: readonly Rule[] = [
  // ADR-0109, ADR 0109, ADR-0045/e
  { name: "ADR-szám", re: /\bADR[\s-]?\d{3,4}\b/g },
  // A SAJÁT doktrínánk szakaszai: §C, §B.17, §C-kapu, §C.1.
  { name: "doktrína-szakasz", re: /§\s?[A-Z](?:\.\d+)?/g },
  // Belső dokumentumok neve a képernyőn.
  {
    name: "belső dokumentum",
    re: /\b(?:0[0-9]-[A-Z]{3,}|DECISIONS\.md|CLAUDE\.md|MEMORY\.md|PILOT\.md|DEPLOY-READY)\b|_planning\//g,
  },
];

interface Hit {
  readonly rule: string;
  readonly match: string;
  readonly where: string;
  readonly text: string;
}

/** ⛔ EGY döntőbíró — mindhárom réteg ezt hívja, így nem tudnak széttartani. */
function findRefs(text: string, where: string): Hit[] {
  const hits: Hit[] = [];
  for (const { name, re } of RULES) {
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
 * Operátor-felé néző szöveg, ami KÍVÜL van az i18n-doktrínán (belső magyar szöveg,
 * a vevő-oldali i18n-kötelem nem áll rá) — de EMBER olvassa a konzolban. Az i18n-
 * listák nem tudják helyettesíteni ezt: azok azt gyűjtik, amit FORDÍTANI kell, és a
 * belső operátor-szöveg SZÁNDÉKOSAN nincs rajtuk. Egy ADR-szám viszont ugyanúgy
 * kiszivárog a képernyőre. Mérve: a megkeresés-kapu ok-listája, a riasztó-levél, a
 * küldés-visszautasítások — egyik fájl sem szerepel egyetlen i18n-listán sem.
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
 * A fejlesztői NAPLÓ nem felület: a `console.warn("[payment] … (ADR-0111)")` a
 * szerver-logba megy, ahol az azonosító éppen HASZNOS (a fejlesztő kikeresi).
 * A döntés STRUKTURÁLIS (a literál egy console.* híváson belül van), nem kulcsszavas
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

/** Minden STRING LITERÁL egy TS fájlból (AST-ből, nem regexszel — a komment így
 *  szerkezetileg kimarad, nem attól, hogy eltaláltam-e a komment-szintaxist). */
function literalsOf(sf: ts.SourceFile): { text: string; line: number }[] {
  const out: { text: string; line: number }[] = [];
  const visit = (n: ts.Node): void => {
    const isLit =
      ts.isStringLiteral(n) ||
      ts.isNoSubstitutionTemplateLiteral(n) ||
      ts.isTemplateHead(n) ||
      ts.isTemplateMiddle(n) ||
      ts.isTemplateTail(n);
    if (isLit && !insideDevLog(n, sf)) {
      const { line } = sf.getLineAndCharacterOfPosition(n.pos);
      out.push({ text: (n as ts.LiteralLikeNode).text, line: line + 1 });
    }
    n.forEachChild(visit);
  };
  visit(sf);
  return out;
}

/** Egy SQL sor a `--` komment NÉLKÜL. Idézet-tudatos: a `--` egy string-literálon
 *  belül a szöveg része, nem komment (különben egy valódi szivárgást vághatnánk le). */
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
 * UPDATE … SET). Ez a felhasználó-felé néző adat; minden más SQL-szöveg a fejlesztőé:
 *   · `COMMENT ON …` = séma-dokumentáció (az ADR-szám ott HASZNOS, nem szivárgás),
 *   · a `WHERE` utáni rész = ÖSSZEHASONLÍTÁS, ami épp a RÉGI (hibás) értéket idézi —
 *     a javító migrációm maga is ilyen, és önmagát buktatta volna le.
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
    // A WHERE-től a végéig NEM írás, hanem szűrés — idézet-tudatosan vágjuk.
    let cut = stmt.length;
    let inStr = false;
    for (let i = 0; i < stmt.length; i++) {
      if (stmt[i] === "'") inStr = !inStr;
      else if (!inStr && /where/i.test(stmt.slice(i, i + 5)) && !/\w/.test(stmt[i - 1] ?? " ")) {
        cut = i;
        break;
      }
    }
    const written = stmt.slice(0, cut);
    for (const m of written.matchAll(/'((?:[^']|'')*)'/g)) out.push(m[1].replace(/''/g, "'"));
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

/**
 * A Teszt-napló lapra tényleg KIÍRT forgatókönyv-feliratok (testLogViews rendereli:
 * id, title, cél, szakasz-címek, lépés-szöveg, kézi utasítás). A parsert használjuk,
 * hogy a mező-lista ne az én emlékezetem legyen.
 */
async function scenarioSurfaces(): Promise<{ text: string; where: string }[]> {
  const dir = path.join(ROOT, "elek/scenarios");
  const files = (await readdir(dir).catch(() => [])).filter((f) => /^FK-.*\.md$/.test(f)).sort();
  const { parseFk } = await import("../src/elek/fkParse.js");
  const out: { text: string; where: string }[] = [];
  for (const f of files) {
    const fk = parseFk(path.join(dir, f));
    const where = `elek/scenarios/${f}`;
    out.push({ text: `${fk.id} ${fk.title}`, where: `${where} (cím)` });
    out.push({ text: fk.cel, where: `${where} (cél)` });
    for (const sec of fk.sections) {
      out.push({ text: sec.title, where: `${where} (szakasz)` });
      for (const st of sec.steps) {
        out.push({ text: st.text ?? "", where: `${where} (lépés)` });
        out.push({ text: st.kezi ?? "", where: `${where} (kézi)` });
      }
    }
  }
  return out.filter((x) => x.text.trim() !== "");
}

async function staticTwin(): Promise<void> {
  console.log("\n③ STATIKUS IKER — felhasználó-felé néző forrás-literálok + súgó-cikkek");
  const files = [...new Set([...I18N_SOURCES, ...SURFACE_SCOPE, ...OPERATOR_TEXT])]
    .filter((f) => f.endsWith(".ts"))
    .sort();
  let scanned = 0;
  const before = failures.length;
  for (const rel of files) {
    const src = await readFile(path.join(ROOT, rel), "utf8").catch(() => "");
    if (!src) continue;
    scanned++;
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.ESNext, true);
    for (const lit of literalsOf(sf)) {
      // A literálba ÍRT komment is komment: a `<style>`/`<script>` blokkok `/* … */`
      // sávjai a szállított lapon sem látszanak (a renderelt réteg innerText-je sem
      // látja őket) — a fejlesztői azonosító ott a helyén van. ⚠️ Csak a blokk-
      // kommentet vágjuk: a `//` a literálokban URL-t is jelent (`https://…`).
      report(findRefs(lit.text.replace(/\/\*[\s\S]*?\*\//g, " "), `${rel}:${lit.line}`));
    }
  }
  const kb = await kbFiles();
  for (const rel of kb) {
    const md = await readFile(path.join(ROOT, rel), "utf8");
    md.split("\n").forEach((l, i) => report(findRefs(l, `${rel}:${i + 1}`)));
  }
  // ⛔ ADAT-ÚT: a felületi szöveg egy része MIGRÁCIÓS SEEDBŐL jön, nem literálból — a
  // /settings piac-megjegyzése így viselt két ADR-számot (a 0057 INSERT-je írta be).
  // Ha ez csak a renderelt rétegen buknék el, a commit-kapu átengedné, és a leletet
  // egy éles adatbázisba telepítenénk. ⚠️ A `--` KOMMENT a migrációban a fejlesztőé,
  // ott a hivatkozás a helyén van — idézet-tudatosan vágjuk le.
  const sqlFiles = (await readdir(path.join(ROOT, "migrations")).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of sqlFiles) {
    const raw = await readFile(path.join(ROOT, "migrations", f), "utf8");
    for (const w of writtenSqlText(raw)) report(findRefs(w, `migrations/${f}`));
  }

  // A teszt-forgatókönyvek CÍME a konzol Teszt-napló lapján jelenik meg. ⚠️ A fájl
  // többi része GÉPI utasítás (út/tedd/várd), ami sosem ér felületre — ott az
  // ADR-hivatkozás a helyén van. Ezért nem a fájlt olvassuk soronként, hanem a
  // SAJÁT parserével pontosan azokat a mezőket, amiket a nézet ki is ír.
  const scen = await scenarioSurfaces();
  for (const s of scen) report(findRefs(s.text, s.where));
  console.log(
    `  ${scanned} forrásfájl + ${kb.length} súgó-cikk + ${scen.length} teszt-napló felirat átvizsgálva`,
  );
  line(failures.length === before, "nincs belső hivatkozás a felhasználói szövegben");
}

// ═══ ② TERMELŐK ════════════════════════════════════════════════════════════════
async function producers(): Promise<void> {
  console.log("\n② TERMELŐK — csak a HIBÁS ágon látszó szövegek (kapu-ok-listák)");
  const { checkOutreachDraft, checkOutreachSms } = await import("../src/outreach/outreachCheck.js");
  const before = failures.length;
  // Szándékosan ELROMLOTT megkeresés: minden C-szabály bukjon, hogy MINDEN ok-sor
  // előálljon. Egy olyan bemenet, ami átmegy a kapun, semmit nem mérne.
  const badDraft = {
    subject: "Elkészült az új honlapja!",
    body: "Kedves Szállásadó! Elkészült az oldala. Üdvözlettel: ",
  } as Parameters<typeof checkOutreachDraft>[0];
  const cases: { label: string; reasons: readonly string[] }[] = [
    {
      label: "levél-kapu, nem jóváhagyott piac",
      reasons: checkOutreachDraft(badDraft, "", "de", { country: "AT", approved: false }).reasons,
    },
    {
      label: "levél-kapu, verdikt nélkül (fail-closed)",
      reasons: checkOutreachDraft(badDraft, "", "pl", undefined).reasons,
    },
    {
      label: "levél-kapu, hazai piac",
      reasons: checkOutreachDraft(badDraft, "", "hu", { country: "HU", approved: true }).reasons,
    },
    {
      label: "SMS-kapu, nem jóváhagyott piac",
      reasons: checkOutreachSms({ text: "Elkészült a honlapja! http://x", link: "", unsubscribeLink: "" }, "", "de", {
        country: "AT",
        approved: false,
      }).reasons,
    },
    {
      label: "SMS-kapu, hazai piac",
      reasons: checkOutreachSms({ text: "Elkészült a honlapja! http://x", link: "", unsubscribeLink: "" }, "", "hu", {
        country: "HU",
        approved: true,
      }).reasons,
    },
  ];
  let total = 0;
  for (const c of cases) {
    total += c.reasons.length;
    for (const r of c.reasons) report(findRefs(r, `${c.label}`));
  }
  console.log(`  ${cases.length} forgatókönyv, ${total} ok-sor előállítva`);
  // Egy üres ok-lista NEM zöld: a réteg akkor nem mért semmit.
  line(total >= 8, "a kapu tényleg termelt ok-sorokat (nem üres a mérés)", `${total} sor`);
  line(failures.length === before, "nincs belső hivatkozás a kapu-ok-sorokban");
}

// ═══ ① RENDERELT ═══════════════════════════════════════════════════════════════
/** Nem HTML-felület vagy nincs saját szövege — indoklással kihagyva. */
const ROUTE_SKIP: Readonly<Record<string, string>> = {
  "/favicon.ico": "ikon, nem szöveg",
  "/logout": "átirányítás, nincs saját szövege",
  "/documents.csv": "CSV letöltés, nem felület",
  "/operator/lang": "nyelvváltó POST, átirányít",
  "/entities/bootstrap": "POST-művelet, átirányít",
  "/photo": "aláírt kép-proxy (bináris, aláírás nélkül 403) — nincs szövege",
  "/pay/done": "a publikus szerver fizetés-lapja, nem konzol-felület",
};

async function renderedLayer(): Promise<void> {
  console.log("\n① RENDERELT — a valódi konzol + tenant-admin lapok látható szövege");
  const { db } = await import("../src/db/client.js");
  const { loadKbEntries } = await import("../src/kb/kb.js");

  const { server: consoleServer } = (await import("../src/console/server.js")) as { server: Server };
  if (!consoleServer.listening) await once(consoleServer, "listening");
  const conBase = `http://127.0.0.1:${(consoleServer.address() as { port: number }).port}`;
  const { server: publicServer } = (await import("../src/server/public.js")) as { server: Server };
  if (!publicServer.listening) await once(publicServer, "listening");
  const pubBase = `http://127.0.0.1:${(publicServer.address() as { port: number }).port}`;

  const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
  const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
  const op = await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst();
  // ⛔ Beégetett uuid nélkül: a halott azonosító törött lapot mutat, és az őr azt mérné.
  const lead = await db
    .selectFrom("lead")
    .select(["id"])
    .orderBy("created_at", "desc")
    .limit(1)
    .executeTakeFirst();
  const prospect = await db.selectFrom("prospect").select(["id"]).limit(1).executeTakeFirst();
  const partner = await db.selectFrom("partner").select(["id"]).limit(1).executeTakeFirst();
  const tenantUser = await db
    .selectFrom("tenant_user")
    .innerJoin("site", "site.tenant_id", "tenant_user.tenant_id")
    .select(["tenant_user.id as id"])
    .limit(1)
    .executeTakeFirst();
  line(!!op, "van operátor-fiók a körbejáráshoz");
  line(!!lead && !!prospect, "van lead + prospect fixture");
  line(!!tenantUser, "van tenant-fiók (site-tal) a tenant-adminhoz");
  if (!op || !lead || !prospect || !tenantUser) {
    notes.push("a renderelt réteg fixture nélkül NEM futott le — ez nem zöld, hanem mérés nélküli állapot");
    return;
  }

  const entries = await loadKbEntries();
  const opTopics = entries.filter((e) => e.audience === "operator").map((e) => e.id);
  const tnTopics = entries.filter((e) => e.audience === "tenant").map((e) => e.id);

  // A konzol route-listája a szerver SAJÁT forrásából — nem emlékezetből.
  const srv = await readFile(path.join(ROOT, "src/console/server.ts"), "utf8");
  const declared = new Set<string>();
  for (const m of srv.matchAll(/method === "GET" && path === "(\/[^"]*)"/g)) declared.add(m[1]);
  for (const m of srv.matchAll(/if \(path === "(\/[^"]*)"\)/g)) declared.add(m[1]);

  const consoleVisits = [
    ...[...declared].filter((r) => !(r in ROUTE_SKIP)),
    `/lead/${lead.id}`,
    // ⛔ A megkeresés-piszkozat a `/draft` alatt él — a csupasz `/prospect/:id` 404.
    // Ez a LEGFONTOSABB lap (itt vannak a kapu-verdikt feliratai), ezért nem elég
    // felvenni: ha nem töltődik be, a megjegyzés-sor kimondja, hogy NEM mértük.
    `/prospect/${prospect.id}/draft`,
    ...(partner ? [`/partner/${partner.id}`] : []),
    ...opTopics.map((t) => `/help?topic=${t}`),
    ...tnTopics.map((t) => `/help?topic=${t}`),
  ];
  const uncovered = [...declared].filter((r) => !(r in ROUTE_SKIP) && !consoleVisits.includes(r));
  line(
    uncovered.length === 0,
    "minden deklarált konzol-route vagy látogatott, vagy indoklással kihagyott",
    uncovered.join(", "),
  );

  // A tenant-admin fülei a SAJÁT forrásukból.
  const adminSrc = await readFile(path.join(ROOT, "src/server/adminViews.ts"), "utf8");
  const tabs = [...adminSrc.matchAll(/\{ id: "([a-z]+)", label: T\(/g)].map((m) => m[1]);
  line(tabs.length >= 8, "a tenant-admin fülei kiolvashatók a forrásból", `${tabs.length} fül`);
  const adminVisits = [
    ...tabs.map((t) => `/admin?tab=${t}`),
    ...tnTopics.map((t) => `/admin?tab=sugo&topic=${t}`),
  ];

  const browser: Browser = await chromium.launch({ executablePath: (await import("../src/config.js")).config.chromiumPath });
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
      const text = await page.evaluate(() => document.body.innerText);
      report(findRefs(text, `${tag}${r}`));
      if (SELF_TEST && visited === 1) {
        // A KINYERŐ ÚT öntesztje: egy tényleg LÁTHATÓ hivatkozást fogjon meg.
        await page.evaluate(() => {
          const p = document.createElement("p");
          p.textContent = "Egyedi domain — feltételek (ADR-0109)";
          document.body.prepend(p);
        });
        const poisoned = await page.evaluate(() => document.body.innerText);
        line(
          findRefs(poisoned, "önteszt").length > 0,
          `önteszt: a ${tag} lapra injektált ADR-hivatkozást megfogja`,
        );
      }
    }
    await page.close();
    console.log(`  ${tag} — ${visited}/${routes.length} lap megmérve`);
  };

  const conCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await conCtx.addCookies([
    { name: "cit_op_session", value: mintOperatorCookieValue(op.id), url: conBase },
  ]);
  await scan(conCtx, conBase, consoleVisits, "konzol");

  const tnCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await tnCtx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(tenantUser.id), url: pubBase }]);
  await scan(tnCtx, pubBase, adminVisits, "tenant-admin");

  await browser.close();
  await db.destroy();
}

// ═══ ÖNTESZT (piros ág) ════════════════════════════════════════════════════════
function selfTest(): void {
  console.log("\n⚑ ÖNTESZT — fogjon-e egyáltalán, és NE fogjon-e túl sokat");
  const must: readonly [string, string][] = [
    ["Egyedi domain — feltételek (ADR-0109)", "ADR-szám zárójelben"],
    ["a §C-kapu blokkol minden árat hirdető levelet", "doktrína-szakasz"],
    ["C4: félrevezető állítás — §A demo-framing sérül", "szakasz mondat közben"],
    ["lásd 03-INVARIANTS §C", "belső dokumentum"],
  ];
  for (const [text, what] of must) line(findRefs(text, "önteszt").length > 0, `megfogja: ${what}`);
  // ⛔ NEGATÍVAN IS: a jogszabályi § HELYESEN van a jogi szövegben — ha erre pirosat
  // ad, az őr a jogi lábazatot kényszerítené hazugságba.
  const mustNot: readonly [string, string][] = [
    ["Az elektronikus kereskedelmi szolgáltatásokról szóló 2001. évi CVIII. törvény 4. §-a szerint", "Eker.tv. §-a"],
    ["a Ptk. 6:78. § alapján", "Ptk. szakasz"],
    ["A Grt. 6. § (1) bekezdése szerinti jogos érdek", "Grt. szakasz"],
    ["Fttv. szerinti tisztességtelen kereskedelmi gyakorlat", "Fttv. rövidítés"],
    ["A csomag ára 14 900 Ft/hó", "hétköznapi ár-mondat"],
  ];
  for (const [text, what] of mustNot) {
    const h = findRefs(text, "önteszt");
    line(h.length === 0, `NEM fogja meg (helyesen): ${what}`, h.map((x) => x.match).join(","));
  }
}

// ── futás ──────────────────────────────────────────────────────────────────────
console.log("BELSŐ-HIVATKOZÁS ŐR" + (SELF_TEST ? " — ÖNTESZT MÓD" : ""));
if (SELF_TEST) selfTest();
await staticTwin();
await producers();
if (FAST) {
  // ⛔ A kihagyást KIMONDJUK: a néma szűkítés „mindent lefedtünk"-nek olvasódik.
  notes.push("--fast mód: az ① RENDERELT réteg NEM futott (böngésző nélkül) — a lapok látható szövege most nincs megmérve");
} else {
  await renderedLayer();
}

console.log("\n" + "─".repeat(70));
if (notes.length) {
  console.log("⚠️  MEGJEGYZÉSEK (nem mért részek — a zöld ezekre NEM áll):");
  for (const n of notes) console.log(`   · ${n}`);
}
if (failures.length) {
  console.log(`\n⛔ ${failures.length} BELSŐ HIVATKOZÁS FELHASZNÁLÓI SZÖVEGBEN:\n`);
  const byRule = new Map<string, Hit[]>();
  for (const h of failures) byRule.set(h.rule, [...(byRule.get(h.rule) ?? []), h]);
  for (const [rule, hits] of byRule) {
    console.log(`  ── ${rule} (${hits.length}) ──`);
    for (const h of hits) console.log(`     ${h.where}\n        „${h.text}"  →  ${h.match}`);
  }
}
const bad = failures.length + structuralFails;
console.log(
  bad === 0
    ? "\n✅ TISZTA — a felhasználó-felé néző szövegben nincs fejlesztői azonosító."
    : `\n⛔ BUKÁS — ${failures.length} hivatkozás + ${structuralFails} szerkezeti hiba.`,
);
process.exit(bad === 0 ? 0 : 1);
