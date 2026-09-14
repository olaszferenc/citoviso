// A JÓVÁHAGYOTT súgó-terv ŐRE (kontraktus: assets/design-refs/console/help-start/README.md).
//
// Miért nem elég a képernyőkép: a terv VISELKEDÉST köt — „érkezéskor LÁTSZIK cikkcím",
// „több csoport lehet nyitva egyszerre", „a keresés eredménye LÁTSZIK", „JS nélkül is működik".
// Egy statikus kép mindegyikre ugyanúgy néz ki, akár igaz, akár nem. Ezért ez az őr a VALÓDI
// konzol- és tenant-admin lapot kattintja végig, és a PIXELT kérdezi, nem a DOM-ot.
//
// ⛔ 2026-09-13: az őr EREDETI ① állítása („alapállapotban MINDEN csoport csukva") a mai
// napig ZÖLD volt — és épp azt az állapotot védte, amit a tulaj hibaként jelentett be:
// nulla látható cikkcím érkezéskor. Egy őr csak annyit ér, amennyit az állítása KÉRDEZ;
// ez a kérdés a szerkezetről szólt (csukva-e), nem a felhasználó ELŐTT lévő tartalomról.
// Az új ① ezért a LÁTHATÓ CIKKCÍMEK SZÁMÁT méri.
//
//   npx tsx scripts/help-collapse-check.mts
//   npx tsx scripts/help-collapse-check.mts --self-test   (piros önteszt: a romlott állapotot fogja-e)

process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";
process.env.PUBLIC_PORT = "0";

import { once } from "node:events";
import type { Server } from "node:http";

import { chromium, type Page } from "playwright-core";

import { config } from "../src/config.js";

const SELF_TEST = process.argv.includes("--self-test");
let bad = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  console.log(`  ${cond ? "✅" : "⛔"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) bad++;
};

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
const tu = await db
  .selectFrom("tenant_user")
  .innerJoin("site", "site.tenant_id", "tenant_user.tenant_id")
  .select(["tenant_user.id as id"])
  .limit(1)
  .executeTakeFirst();
if (!op || !tu) {
  console.log("⛔ nincs operátor- vagy tenant-fiók — az őr NEM futott le (ez nem zöld)");
  process.exit(1);
}

const browser = await chromium.launch({ executablePath: config.chromiumPath });

/** Hány cikkcímnek KELL látszania érkezéskor. A legszűkebb valós csoport a tenant-admin
 *  első csoportja („Az oldalam", 4 cikk) — 3 tehát mindkét felületen teljesíthető, és
 *  a bejelentett 0-tól egyértelműen elválik. */
const MIN_VISIBLE = 3;

/** WCAG relatív luminancia egy `rgb()/rgba()` sztringből. */
function relLuminance(css: string): number {
  const p = (css.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
  const ch = p.map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
}

/** Előtér-szín ÖSSZEOLVASZTVA a háttérrel az érvényes opacity mellett — ezt látja a szem. */
function blend(fg: string, bg: string, opacity: number): string {
  const f = (fg.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
  const b = (bg.match(/[\d.]+/g) ?? ["255", "255", "255"]).slice(0, 3).map(Number);
  return `rgb(${f.map((v, i) => v * opacity + b[i]! * (1 - opacity)).join(",")})`;
}

/** WCAG kontraszt-arány két CSS-színre. Alfát nem old fel — a hívó adjon tömör színt. */
function contrastRatio(fg: string, bg: string): number {
  const [hi, lo] = [relLuminance(fg), relLuminance(bg)].sort((a, b) => b - a) as [number, number];
  return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
}

/**
 * Egy súgó-felület végigmérése. `sel` a csoport/fejléc/link választói, hogy a két
 * felület UGYANAZON az állítás-listán menjen át — ha az egyik lemarad, az látszik.
 */
async function measure(
  name: string,
  base: string,
  url: string,
  cookie: { name: string; value: string },
  sel: { group: string; head: string; link: string; tools: string; search: string },
  searchUrl: string,
): Promise<void> {
  console.log(`\n── ${name}`);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await ctx.addCookies([{ ...cookie, url: base }]);
  const pg: Page = await ctx.newPage();
  // A süti-döntést ELŐRE megválaszoltuk (2026-09-14, ADR-0145): a sáv a lap aljára
  // rögzített réteg, ami a hozzájárulás megadásáig elfogja a kattintásokat — a kapu
  // tenant-admin ága emiatt futott timeoutra. Ez az őr a súgó-csoportok viselkedését
  // méri egy VISSZATÉRŐ tulajnál, aki a kérdésre már válaszolt; magát a sávot a
  // `consent-check` / `consent-style-check` méri.
  await pg.addInitScript("try{localStorage.setItem('cit-consent-v1','necessary')}catch(e){}");
  const errs: string[] = [];
  pg.on("pageerror", (e) => errs.push(String(e)));
  await pg.goto(`${base}${url}`, { waitUntil: "domcontentloaded" });

  const groups = pg.locator(sel.group);
  const openN = async (): Promise<number> => await pg.locator(`${sel.group}[open]`).count();
  const visibleLinks = async (): Promise<number> => await pg.locator(`${sel.link}:visible`).count();

  const n = await groups.count();
  ok("vannak csoportok", n >= 4, `${n}`);

  // ① ÉRKEZÉSKOR LÁTSZIK TARTALOM. Ez a bejelentés lényege: mind a kilenc csoport csukva
  //    NULLA cikkcímet mutatott, miközben a felület „Válassz témát a listából"-t kért.
  //    A DOM-beli jelenlét nem elég — a PIXELT kérdezzük (:visible + valós magasság).
  const arrived = await visibleLinks();
  ok(`érkezéskor LEGALÁBB ${MIN_VISIBLE} cikkcím LÁTSZIK`, arrived >= MIN_VISIBLE, `${arrived}`);
  const firstLink = pg.locator(sel.link).first();
  const fbox = await firstLink.boundingBox();
  ok("az első látható cikkcím tényleges magassága nem nulla", !!fbox && fbox.height > 10,
     JSON.stringify(fbox));
  // ①b Az ELSŐ csoport az, ami nyitva van — és csak az (nem esett vissza a 35 cikkes falra).
  ok("érkezéskor PONTOSAN egy csoport nyitva", (await openN()) === 1, `${await openN()}`);
  ok("és az az ELSŐ csoport", await groups.first().evaluate((d) => (d as HTMLDetailsElement).open));

  // ①c A KERESŐ HELYŐRZŐJE BEFÉR a mezőbe — a lelet szerint mondat közepén vágódott el
  //    („Mit keresel? (pl. mock,"). Az OK egy szomszédos szabály volt (.con form{display:inline}
  //    veri a .con-kb-search{display:flex}-et), ezért a SZÖVEGET hiába nézné bárki: a mezőt
  //    kell megmérni, azon a szélességen, ahol a felhasználó áll.
  const fit = await pg.locator(sel.search).evaluate((el) => {
    const i = el as HTMLInputElement;
    const c = document.createElement("canvas").getContext("2d")!;
    c.font = getComputedStyle(i).font;
    const style = getComputedStyle(i);
    const pad = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + 2;
    return { text: Math.ceil(c.measureText(i.placeholder).width), avail: Math.floor(i.clientWidth - pad) };
  });
  ok("a kereső helyőrzője BEFÉR a mezőbe (390px)", fit.text <= fit.avail, JSON.stringify(fit));

  // ② nyitás — és a PIXEL mondja meg, nem a DOM (a hidden elem is „ott van").
  await pg.locator(sel.head).nth(1).click();
  await pg.waitForTimeout(120);
  ok("egy további csoport kinyitható", (await openN()) === 2);

  // ③ TÖBB csoport nyitva lehet (a tulaj a nem-exkluzív harmonikát választotta).
  await pg.locator(sel.head).nth(2).click();
  await pg.waitForTimeout(120);
  ok("HÁROM csoport lehet egyszerre nyitva (nem exkluzív)", (await openN()) === 3, `${await openN()}`);

  // ④ csukás
  await pg.locator(sel.head).nth(1).click();
  await pg.waitForTimeout(120);
  ok("újrakattintás becsukja", (await openN()) === 2, `${await openN()}`);

  // ⑤ „Mindet kinyitom / becsukom" — a tulaj EZT kérte a viselkedésekből.
  const tools = pg.locator(sel.tools);
  ok("a gombpár látszik (JS-es ráadás)", await tools.first().isVisible());
  await pg.locator(`${sel.tools} [data-kb-all="1"]`).click();
  await pg.waitForTimeout(150);
  ok("„Mindet kinyitom” tényleg mindet kinyitja", (await openN()) === n, `${await openN()}/${n}`);
  await pg.locator(`${sel.tools} [data-kb-all="0"]`).click();
  await pg.waitForTimeout(150);
  ok("„Mindet becsukom” tényleg mindet becsukja", (await openN()) === 0, `${await openN()}`);

  // ⑥ KERESÉS: a találat LÁTSZIK. Ez a kontraktus legfontosabb pontja — enélkül a lap
  // találatot ígérne csukott fejlécek mögött.
  await pg.goto(`${base}${searchUrl}`, { waitUntil: "domcontentloaded" });
  await pg.waitForTimeout(120);
  const hitGroups = await pg.locator(sel.group).count();
  ok("keresés: van találati csoport", hitGroups > 0, `${hitGroups}`);
  ok("keresés: a találatos csoportok NYITVA renderelnek", (await openN()) === hitGroups,
     `${await openN()}/${hitGroups}`);
  ok("keresés: a találatok LÁTSZANAK is", (await visibleLinks()) > 0);

  // ⑦ JS NÉLKÜL is működjön — a súgó keresése is sima GET, és az érkezési állapot
  //    SZERVER-oldalon dől el. ⛔ Ha az „első csoport nyitva" kliens-oldali kinyitogatás
  //    lenne, itt nulla cikkcím látszana — vagyis pont a bejelentett hiba maradna meg
  //    azoknál, akiknél nem fut a JS.
  const noJs = await browser.newContext({ viewport: { width: 390, height: 900 }, javaScriptEnabled: false });
  await noJs.addCookies([{ ...cookie, url: base }]);
  const p2 = await noJs.newPage();
  await p2.goto(`${base}${url}`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(120);
  const noJsVisible = await p2.locator(`${sel.link}:visible`).count();
  ok(`JS NÉLKÜL is LÁTSZIK legalább ${MIN_VISIBLE} cikkcím érkezéskor`, noJsVisible >= MIN_VISIBLE,
     `${noJsVisible}`);
  await p2.locator(sel.head).nth(1).click();
  await p2.waitForTimeout(120);
  ok("JS NÉLKÜL is nyílik a csoport (natív <details>)",
     (await p2.locator(`${sel.group}[open]`).count()) === 2);
  ok("JS nélkül a gombpár NEM jelenik meg (nincs halott gomb)",
     !(await p2.locator(sel.tools).first().isVisible()));
  await noJs.close();

  ok("nincs JS-hiba a lapon", errs.length === 0, errs.join(" | "));
  await ctx.close();
}

const CON = {
  group: ".con-kb-toc details", head: ".con-kb-toc summary", link: ".con-kb-toc details a",
  tools: "#kb-tools", search: '.con-kb-search input[type="search"]',
};
const ADM = {
  group: ".adm-kb-g", head: ".adm-kb-g summary", link: ".adm-kb-g .adm-kb-list a",
  tools: "#adm-kb-tools", search: '.adm-kb-search input[type="search"]',
};
const OP_COOKIE = { name: "cit_op_session", value: mintOperatorCookieValue(op.id) };

await measure("KONZOL /help", conBase, "/help", OP_COOKIE, CON, "/help?q=foto");
await measure("TENANT-ADMIN /admin?tab=sugo", pubBase, "/admin?tab=sugo",
  { name: "cit_session", value: mintTenantCookieValue(tu.id) }, ADM, "/admin?tab=sugo&q=foto");

/**
 * A konzol-specifikus kötések: a főmenü-elérés, az indulólap és a gombpár igazítása.
 * Ezek nincsenek a tenant-adminon (ott a Súgó már fül, és nincs második hasáb).
 */
async function measureConsoleOnly(): Promise<void> {
  console.log("\n── KONZOL — főmenü, indulólap, igazítás");

  // ⑧ A SÚGÓ ELÉRHETŐ A FŐMENÜBŐL. Eddig csak URL-ből vagy egy ⓘ-ikonból nyílt, és a
  //    /help egyetlen menüpontot sem emelt ki: az operátor olyan lapon állt, ami a
  //    navigációban nem létezik.
  const dsk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await dsk.addCookies([{ ...OP_COOKIE, url: conBase }]);
  const d = await dsk.newPage();
  await d.goto(`${conBase}/`, { waitUntil: "domcontentloaded" });
  const navHelp = d.locator('.con-nav a[href="/help"]');
  ok("a főmenüben VAN Súgó menüpont (az irányítópulton is)", (await navHelp.count()) > 0);
  // ⛔ A DOM-beli jelenlét nem elérhetőség: a menü mobilon görgethető sáv, és egy korábbi
  //    hiba szerint egy elem ott volt, kattintható volt — de SOHA nem festődött ki.
  ok("a Súgó menüpont TÉNYLEG kifestődik (elementFromPoint)", await navHelp.first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  }));
  await d.goto(`${conBase}/help`, { waitUntil: "domcontentloaded" });
  ok("a /help lapon a Súgó menüpont AKTÍV (a lap szerepel a navigációban)",
     (await d.locator('.con-nav a[href="/help"].active').count()) === 1);

  // ⑨ INDULÓLAP: érkezéskor MINDEN cikkcím elérhető a jobb hasábból — a jobb panel nem
  //    kérhet olyat („Válassz témát a listából"), amit a bal nem kínál.
  const tocLinks = await d.locator(".con-kb-toc details a").count();
  const startLinks = await d.locator(".con-kb-start a:visible").count();
  // ⑨c NINCS KETTŐZÉS ASZTALON (tulaj-döntés, Elek FK-000): ha a rács a tartalomjegyzék, a bal
  //    oszlop a kilenc csoportfejre zár — különben ugyanaz a 9 csoport és 35 cikk KÉTSZER áll
  //    egy képernyőn. ⚠️ A csoportfejek ettől még LÁTSZANAK: a lista nem tűnik el, csak becsukódik.
  ok("asztalon a bal lista CSUKVA érkezik (a rács a tartalomjegyzék)",
     (await d.locator(".con-kb-toc details[open]").count()) === 0,
     `${await d.locator(".con-kb-toc details[open]").count()} nyitva`);
  ok("de a kilenc csoportfej LÁTSZIK (a lista nem tűnt el)",
     (await d.locator(".con-kb-toc summary:visible").count()) === 9,
     `${await d.locator(".con-kb-toc summary:visible").count()}`);
  ok("asztalon a bal listából így egy cikkcím sem duplázódik",
     (await d.locator(".con-kb-toc details a:visible").count()) === 0);
  // ⑨d …de KERESÉSKOR nyitva marad: ott a találat megmutatása fontosabb, mint a kettőzés.
  await d.goto(`${conBase}/help?q=szamla`, { waitUntil: "domcontentloaded" });
  await d.waitForTimeout(150);
  ok("kereséskor a bal lista NEM zár be (a találat fontosabb)",
     (await d.locator(".con-kb-toc details[open]").count()) > 0,
     `${await d.locator(".con-kb-toc details[open]").count()}`);
  await d.goto(`${conBase}/help`, { waitUntil: "domcontentloaded" });
  await d.waitForTimeout(150);
  ok("asztalon az indulólap MINDEN cikkcímet mutatja", startLinks === tocLinks && startLinks > 20,
     `indulólap=${startLinks}, lista=${tocLinks}`);
  ok("az indulólap a kilenc témakört külön kártyán adja",
     (await d.locator(".con-kb-sc").count()) === (await d.locator(".con-kb-toc details").count()));
  // ⛔ A KÁRTYÁKKAL EGYÜTT KIDOBTAM AZ ELIGAZÍTÓ MONDATOT is („…a cikk itt nyílik meg…"), és a
  //    lapról eltűnt az egyetlen sor, ami megmondta, HOVA nyílik a kattintott cikk (Elek FK-000).
  //    Egy elrendezés-csere némán vihet el információt — ezért ez külön állítás.
  const lead = d.locator(".con-kb-startlead");
  ok("az indulólap fölött ott az eligazító mondat", await lead.first().isVisible());
  ok("és megmondja, HOVA nyílik a cikk", /itt|ezen a helyen/.test((await lead.first().textContent()) ?? ""),
     (await lead.first().textContent())?.slice(0, 70));
  // ⛔ A kétszintű modell jelölése („ügyfél is látja") a KÁRTYÁN is pirula legyen: pirula
  //    nélkül a nagybetűs csoportcím folytatásaként olvasódott — „AZ OLDALAM ÜGYFÉL IS LÁTJA" —,
  //    vagyis a témakör NEVÉNEK látszott. A képen fogtam meg, nem a kódban.
  const tagStyle = await d.locator(".con-kb-sc h3 .tag").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { border: s.borderTopWidth, bg: s.backgroundColor, tt: s.textTransform };
  });
  ok("az indulólap-kártyán a jelölés PIRULA (nem a cím folytatása)",
     parseFloat(tagStyle.border) > 0 && tagStyle.bg !== "rgba(0, 0, 0, 0)" && tagStyle.tt === "none",
     JSON.stringify(tagStyle));

  // ⑩ A GOMBPÁR ahhoz az oszlophoz igazodjon, AMIRE HAT. Korábban a jobb, üres hasáb fölé
  //    volt igazítva (x≈972–1233), pedig a bal listát vezérli.
  const geo = await d.evaluate(() => {
    const t = document.getElementById("kb-tools")!.getBoundingClientRect();
    const toc = document.getElementById("kb-toc")!.getBoundingClientRect();
    const art = document.getElementById("kb-art")!.getBoundingClientRect();
    return { tMid: t.left + t.width / 2, tocR: toc.right, artL: art.left };
  });
  ok("a „Mindet kinyitom/becsukom” a LISTA oszlopa fölött ül, nem a cikk-hasáb fölött",
     geo.tMid < geo.tocR && geo.tMid < geo.artL, JSON.stringify(geo));

  // ⑪ Asztali szélességen is BEFÉR a helyőrző (a hiba ott jelentkezett először).
  const fitD = await d.locator('.con-kb-search input[type="search"]').evaluate((el) => {
    const i = el as HTMLInputElement;
    const c = document.createElement("canvas").getContext("2d")!;
    const st = getComputedStyle(i);
    c.font = st.font;
    return {
      text: Math.ceil(c.measureText(i.placeholder).width),
      avail: Math.floor(i.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight) - 2),
    };
  });
  ok("a kereső helyőrzője BEFÉR a mezőbe (1280px)", fitD.text <= fitD.avail, JSON.stringify(fitD));

  // ⑫ JS NÉLKÜL is ott az indulólap (szerver-oldalon renderel).
  const noJs = await browser.newContext({ viewport: { width: 1280, height: 900 }, javaScriptEnabled: false });
  await noJs.addCookies([{ ...OP_COOKIE, url: conBase }]);
  const nj = await noJs.newPage();
  await nj.goto(`${conBase}/help`, { waitUntil: "domcontentloaded" });
  ok("JS NÉLKÜL is ott az indulólap a jobb hasábban",
     (await nj.locator(".con-kb-start a:visible").count()) === startLinks);
  // ⛔ A DEGRADÁCIÓ IRÁNYA: a kettőzés-bontás JS-es, mert a szerver nem ismeri a képernyő
  //    szélességét. Ha az alapállapot CSUKVA lenne és a JS nyitná ki telefonon, a JS nélküli
  //    telefonos olvasó NULLA cikkcímet kapna — pontosan a bejelentett hiba. Ezért JS nélkül a
  //    bal lista első csoportja NYITVA marad: fölösleg, nem hiány.
  ok("JS NÉLKÜL a bal lista első csoportja NYITVA marad (inkább fölösleg, mint hiány)",
     (await nj.locator(".con-kb-toc details[open]").count()) === 1,
     `${await nj.locator(".con-kb-toc details[open]").count()}`);
  ok("JS NÉLKÜL is LÁTSZIK cikkcím a bal listában",
     (await nj.locator(".con-kb-toc details a:visible").count()) >= MIN_VISIBLE);
  await noJs.close();

  // ⑬ TELEFONON az indulólap NEM jelenik meg — ott a lista maga az indulólap, a kártya
  //    ugyanazoknak a címeknek a második példánya lenne egy képernyőn.
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mob.addCookies([{ ...OP_COOKIE, url: conBase }]);
  const m = await mob.newPage();
  await m.goto(`${conBase}/help`, { waitUntil: "domcontentloaded" });
  ok("telefonon az indulólap-kártyák NEM jelennek meg", (await m.locator(".con-kb-start a:visible").count()) === 0);
  // …és az őket bevezető mondat sem: telefonon nincs jobb hasáb, amire mutatna.
  ok("telefonon az eligazító mondat sem jelenik meg", !(await m.locator(".con-kb-startlead").first().isVisible()));
  ok("telefonon így is LÁTSZIK cikkcím a listában",
     (await m.locator(".con-kb-toc details a:visible").count()) >= MIN_VISIBLE);
  await mob.close();
  await dsk.close();
}
await measureConsoleOnly();

/**
 * A SÚGÓ-IKON TÉNYLEG OTT VAN-E a Pénzügy képernyőin (ADR-0132 nyitott tétele, tulaj-kérés).
 *
 * ⛔ Miért kell PIXEL-mérés a statikus kb-check mellé: a lefedettség-kapu a forrásban keresi a
 * `data-kb-anchor`-t. Az öt Pénzügy-képernyőn ez ott is volt — egy néma `<div class="panel">`-en,
 * súgó-ikon nélkül. A kapu zöld, a felhasználónak nincs kiútja. A kb-check új szabálya (a horgony
 * <a>-n üljön) a FORRÁST köti; ez itt azt méri, hogy a böngésző ki is FESTI.
 */
async function measureFinanceHelpIcons(): Promise<void> {
  console.log("\n── KONZOL — súgó-ikon a Pénzügy képernyőin");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ ...OP_COOKIE, url: conBase }]);
  const pg = await ctx.newPage();

  // A partner-lap valós azonosítót kér; ha a dev DB-ben nincs partner, azt KIMONDJUK, nem
  // hallgatjuk el (a kihagyott eset nem zöld — csak nem mérhető).
  const p = await db.selectFrom("partner").select("id").limit(1).executeTakeFirst();
  const screens: ReadonlyArray<{ url: string; anchor: string; label: string }> = [
    { url: "/partners", anchor: "console.partners", label: "Partnerek" },
    { url: "/partners/new", anchor: "console.partner_new", label: "Új partner" },
    { url: "/documents", anchor: "console.documents", label: "Bizonylatok" },
    { url: "/documents/new", anchor: "console.document_new", label: "Új bizonylat" },
    ...(p ? [{ url: `/partner/${p.id}`, anchor: "console.partner", label: "Partner-lap" }] : []),
  ];
  if (!p) console.log("  ⚠️ nincs partner a dev DB-ben — a Partner-lap esete KIMARADT (nem zöld)");

  for (const s of screens) {
    const resp = await pg.goto(`${conBase}${s.url}`, { waitUntil: "domcontentloaded" });
    ok(`${s.label}: a lap betölt (${resp?.status()})`, resp?.status() === 200);
    const link = pg.locator(`a[data-kb-anchor="${s.anchor}"]`);
    ok(`${s.label}: van súgó-link a "${s.anchor}" horgonnyal`, (await link.count()) >= 1);
    // ⛔ A DOM-beli jelenlét nem láthatóság (overflow-ős, clip-elt, nulla méretű elem is „ott van"):
    // az `elementFromPoint` a döntőbíró — az mondja meg, mit fest a böngésző arra a pontra.
    const painted = await link.first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return { ok: false, why: `méret ${r.width}×${r.height}` };
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { ok: !!hit && (hit === el || el.contains(hit)), why: hit?.tagName ?? "semmi" };
    });
    ok(`${s.label}: a súgó-ikon TÉNYLEG kifestődik`, painted.ok, painted.why);
    // És oda visz, ahol a válasz van.
    const href = await link.first().getAttribute("href");
    ok(`${s.label}: a link a súgó cikkére mutat`, href === `/help?topic=${encodeURIComponent(s.anchor)}`, `${href}`);
    // ⛔ „Ott van" ≠ „látszik": a partner-lap fejléce NAVY GRADIENS, és az alap ikon-szín
    //    (muted ink) azon ~2,2 kontrasztot ad — a keret pedig sötét alfán teljesen eltűnik.
    //    Ezért itt SZÁMOLUNK, nem szemre nézünk (vö. a cián gombfelirat cián gradiensen).
    // ⚠️ A SZÁMOLÁS ITT FUT, nem a lapon: a `tsx`/esbuild `keepNames`-e `__name(...)` hívást
    //    injektál a beágyazott függvényekbe, ami a böngészőben `ReferenceError`-ral elszáll.
    //    A lapból csak NYERS érték jön ki.
    const colors = await link.first().evaluate((el) => {
      let bgc = "rgb(255, 255, 255)";
      for (let n: HTMLElement | null = el as HTMLElement; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage !== "none") {
          // Gradiens: a saját `backgroundColor` átlátszó, de a gradiens sötét navy-ról indul —
          // a rajta ülő szöveg-szín ehhez képest mérendő.
          bgc = cs.backgroundImage.match(/rgba?\([^)]*\)/)?.[0] ?? "rgb(14, 42, 71)";
          break;
        }
        if (cs.backgroundColor !== "rgba(0, 0, 0, 0)") { bgc = cs.backgroundColor; break; }
      }
      // ⛔ Az OPACITY is számít: a `getComputedStyle().color` nem tud róla, tehát nélküle a mérés
      //    SZEBB számot adna, mint amit a szem lát (a `.con-help` sokáig 0.8-on ült).
      let op = 1;
      for (let n: HTMLElement | null = el as HTMLElement; n; n = n.parentElement)
        op *= parseFloat(getComputedStyle(n).opacity || "1");
      return { fg: getComputedStyle(el).color, bg: bgc, op: +op.toFixed(3) };
    });
    const ratio = contrastRatio(blend(colors.fg, colors.bg, colors.op), colors.bg);
    // ⛔ A küszöb 4,5 és nem 3: 3,03-mal ÁTMENT az az állapot, ahol a sötét sávon a muted szín
    //    maradt kint (a világos felülethez írt szabály verte a sötét-felületit). A „még éppen"
    //    érték pont azt fedte el, hogy a szándékolt szabály NEM ért hatályba.
    ok(`${s.label}: a súgó-ikon kontrasztja elég (≥4.5, mérve ${ratio})`, ratio >= 4.5, JSON.stringify(colors));
  }
  await ctx.close();
}
await measureFinanceHelpIcons();

// ── PIROS ÖNTESZT ────────────────────────────────────────────────────────────
// A romlott állapotot a RENDERELT lapon állítjuk elő (nem a forrást rontjuk vissza), és
// UGYANAZT a predikátumot futtatjuk rá, amit az éles állítás használ. Amelyik állítás
// erre sem pirul, az dísz.
//
// ⛔ A legfontosabb eset az ELSŐ: a 2026-09-12-i változat állapota (mind a kilenc csoport
// csukva) — az akkori őr erre ZÖLDET adott, a tulaj meg hibaként jelentette be.
if (SELF_TEST) {
  console.log("\n⚑ ÖNTESZT — a romlott állapotokat MEGFOGJA-E?");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ ...OP_COOKIE, url: conBase }]);
  const pg = await ctx.newPage();
  const reload = async (u = "/help"): Promise<void> => {
    await pg.goto(`${conBase}${u}`, { waitUntil: "domcontentloaded" });
    await pg.waitForTimeout(80);
  };

  // ① — a bejelentett hiba maga. ⛔ EZT TELEFONON KELL ELŐÁLLÍTANI: asztalon a „mind csukva"
  //    2026-09-13 óta a HELYES állapot (ott a jobb oldali rács a tartalomjegyzék), tehát egy
  //    1280-as önteszt nem a bejelentett hibát mérné, hanem egy legitim állapotot — és zölden
  //    azt állítaná magáról, hogy fog. A hiba ott hiba, ahol nincs rács: 390px-en.
  const mob0 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mob0.addCookies([{ ...OP_COOKIE, url: conBase }]);
  const m0 = await mob0.newPage();
  await m0.goto(`${conBase}/help`, { waitUntil: "domcontentloaded" });
  await m0.waitForTimeout(120);
  const before1 = await m0.locator(".con-kb-toc details a:visible").count();
  await m0.evaluate(() =>
    document.querySelectorAll(".con-kb-toc details").forEach((d) => ((d as HTMLDetailsElement).open = false)));
  const blind = await m0.locator(".con-kb-toc details a:visible").count();
  ok("① megfogná a BEJELENTETT hibát telefonon (mind csukva → nulla cikkcím)",
     before1 >= MIN_VISIBLE && blind < MIN_VISIBLE, `épben=${before1}, romlottan=${blind}`);
  await mob0.close();

  // ①c/⑪ — a régi `.con form{display:inline}` győzelme: a mező összezsugorodik.
  await reload();
  await pg.evaluate(() => {
    (document.querySelector(".con-kb-search") as HTMLElement).style.display = "inline";
  });
  const shrunk = await pg.locator('.con-kb-search input[type="search"]').evaluate((el) => {
    const i = el as HTMLInputElement;
    const c = document.createElement("canvas").getContext("2d")!;
    const st = getComputedStyle(i);
    c.font = st.font;
    return {
      text: Math.ceil(c.measureText(i.placeholder).width),
      avail: Math.floor(i.clientWidth - parseFloat(st.paddingLeft) - parseFloat(st.paddingRight) - 2),
    };
  });
  ok("⑪ megfogná az elvágott helyőrzőt (zsugorodó kereső)", shrunk.text > shrunk.avail, JSON.stringify(shrunk));

  // ⑧ — a Súgó menüpont eltávolítva (a mai, bejelentett állapot).
  await reload();
  await pg.evaluate(() => document.querySelector('.con-nav a[href="/help"]')?.remove());
  ok("⑧ megfogná, ha nincs Súgó a főmenüben",
     (await pg.locator('.con-nav a[href="/help"]').count()) === 0);

  // ⑨ — az indulólap helyett a régi „Válassz témát…" doboz.
  await reload();
  const realStart = await pg.locator(".con-kb-start a:visible").count();
  await pg.evaluate(() => {
    const art = document.getElementById("kb-art")!;
    art.innerHTML = '<p class="con-kb-empty">Válassz témát a listából</p>';
  });
  const emptied = await pg.locator(".con-kb-start a:visible").count();
  ok("⑨ megfogná, ha a jobb hasáb újra csak felszólítás lenne",
     realStart > 20 && emptied === 0, `valódi=${realStart}, romlott=${emptied}`);

  // ⑩ — a gombpár visszaigazítva a jobb (cikk-) hasáb fölé.
  await reload();
  await pg.evaluate(() => {
    const bar = document.querySelector(".con-kb-bar") as HTMLElement;
    const panel = bar.closest(".panel") as HTMLElement;
    panel.insertBefore(bar, panel.querySelector(".con-kb-cols"));
    bar.style.justifyContent = "flex-end";
  });
  const misaligned = await pg.evaluate(() => {
    const t = document.getElementById("kb-tools")!.getBoundingClientRect();
    const art = document.getElementById("kb-art")!.getBoundingClientRect();
    return { tMid: t.left + t.width / 2, artL: art.left };
  });
  ok("⑩ megfogná, ha a gombpár a cikk-hasáb fölé kerülne vissza",
     misaligned.tMid >= misaligned.artL, JSON.stringify(misaligned));

  // ⑨b — a kártya-jelölés elveszti a pirulát (a cím folytatásaként olvasódna).
  await reload();
  await pg.evaluate(() =>
    document.querySelectorAll(".con-kb-sc h3 .tag").forEach((t) => {
      const e = t as HTMLElement;
      e.style.border = "0";
      e.style.background = "transparent";
      e.style.textTransform = "uppercase";
    }));
  const flatTag = await pg.locator(".con-kb-sc h3 .tag").first().evaluate((el) => {
    const s = getComputedStyle(el);
    return parseFloat(s.borderTopWidth) > 0 && s.backgroundColor !== "rgba(0, 0, 0, 0)";
  });
  ok("⑨b megfogná, ha a kártya-jelölés elvesztené a pirulát", !flatTag);

  // ⑥ — a keresés csukva hagyná a találatot.
  await reload("/help?q=foto");
  const before = await pg.locator(".con-kb-toc details[open]").count();
  await pg.evaluate(() =>
    document.querySelectorAll(".con-kb-toc details").forEach((d) => ((d as HTMLDetailsElement).open = false)));
  const after = await pg.locator(".con-kb-toc details a:visible").count();
  ok("⑥ megfogná, ha a keresés CSUKVA hagyná a találatot", before > 0 && after === 0,
     `keresésnél nyitva=${before}, becsukva látható link=${after}`);

  // ⑰ — a bal lista asztalon is nyitva marad (visszatér a kettőzés).
  await reload();
  await pg.evaluate(() =>
    document.querySelectorAll(".con-kb-toc details").forEach((d2, i) => {
      if (i === 0) (d2 as HTMLDetailsElement).open = true;
    }));
  ok("⑰ megfogná, ha asztalon visszatérne a kettőzés (nyitott bal lista a rács mellett)",
     (await pg.locator(".con-kb-toc details[open]").count()) > 0 &&
       (await pg.locator(".con-kb-start a:visible").count()) > 0);

  // ⑯ — az eligazító mondat eltűnik (pontosan az, amit egyszer már elkövettem).
  await reload();
  await pg.evaluate(() => document.querySelector(".con-kb-startlead")?.remove());
  ok("⑯ megfogná, ha az eligazító mondat újra eltűnne",
     (await pg.locator(".con-kb-startlead").count()) === 0);

  // ⑭ — a súgó-ikon eltűnik a Pénzügy-képernyőről (a bejelentett, évekig zöld állapot).
  await pg.goto(`${conBase}/partners`, { waitUntil: "domcontentloaded" });
  await pg.evaluate(() => document.querySelector('a[data-kb-anchor="console.partners"]')?.remove());
  ok("⑭ megfogná, ha a Pénzügy-képernyőről eltűnne a súgó-ikon",
     (await pg.locator('a[data-kb-anchor="console.partners"]').count()) === 0);

  // ⑮ — a súgó-ikon visszakapja a cián link-színt (a `.con a` csapda, kontraszt 2,41).
  await pg.goto(`${conBase}/partners`, { waitUntil: "domcontentloaded" });
  const cyan = await pg.locator("a.con-help").first().evaluate((el) => {
    (el as HTMLElement).style.color = "rgb(31, 182, 214)";
    return getComputedStyle(el).color;
  });
  ok("⑮ megfogná a cián súgó-ikont fehéren (kontraszt 2,41 < 4,5)",
     contrastRatio(cyan, "rgb(255,255,255)") < 4.5, `${contrastRatio(cyan, "rgb(255,255,255)")}`);
  await ctx.close();

  // ⑬ — telefonon MEGJELENNE az indulólap (kettőzés).
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mob.addCookies([{ ...OP_COOKIE, url: conBase }]);
  const m = await mob.newPage();
  await m.goto(`${conBase}/help`, { waitUntil: "domcontentloaded" });
  await m.evaluate(() => {
    (document.querySelector(".con-kb-start") as HTMLElement).style.display = "grid";
  });
  ok("⑬ megfogná, ha telefonon is megjelenne az indulólap",
     (await m.locator(".con-kb-start a:visible").count()) > 0);
  await mob.close();
}

await browser.close();
await db.destroy();
console.log(bad === 0 ? "\n✅ A jóváhagyott súgó-terv viselkedése ÁLL." : `\n⛔ ${bad} eltérés a kontraktustól.`);
process.exit(bad === 0 ? 0 : 1);
