// CONSENT-STYLE őr — a süti-sávnak VAN-E TÉNYLEGES STÍLUSA azon a lapon, ahol megjelenik.
//
//   npx tsx scripts/consent-style-check.mts [--self-test]
//
// Measured 2026-09-13 (Elek, három külön kör, három külön felületen):
//   FK-005b H-1   „a süti-sáv stílus nélkül, a képernyő bal szélére tapadva, MINDEN admin-lapon"
//   FK-006b HIBA-2 „a gombjai stílus nélküli, natív böngésző-gombok, a sáv a lap aljához vágva"
//   FK-007  H2    „a süti-sáv stílus nélkül renderel — a vendég-oldalon is"
//
// A GYÖKÉR-OK (mérve 2026-09-14): a `#cit-consent` szabályok a `home.css`-ben éltek,
// azt viszont EGYEDÜL a `public/index.html` tölti be — a sávot ellenben a szerver
// KÖZÖS kimenete (`consentSnippet`) teszi ki minden saját lapunkra. Eredmény: 12
// felületből 11 csupasz sávot kapott, és a `/` landing volt az EGYETLEN, ahol jól
// festett. A meglévő `consent-check.mts` pont ezt nem láthatta: az a négy VISELKEDÉSI
// tiltást méri, és kizárólag a `/`-ot nyitja meg.
//
// ⛔ MIÉRT A RENDERELT LAPON MÉR, ÉS MIÉRT NEM `isVisible()`:
// a hiba minden DOM-szintű ellenőrzést átúszott volna — a sáv OTT VOLT, a gombok OTT
// VOLTAK, csak épp csupaszon. Az `isVisible()` egy stíluslap nélküli sávra is igazat
// mond (a ház mérte: „a DOM zöld lehet, miközben a pixel nulla"). Ezért itt:
//   · SZÁMÍTOTT STÍLUS a sávon és a gombokon, PROBE-hoz hasonlítva: egy kísérleti
//     elemre ráteszünk `background: var(--citui-navy-950)`-t, és ahhoz mérünk. Ez
//     EGYSZERRE bizonyítja, hogy a szabály hatályos ÉS hogy a token feloldódott
//     azon a lapon (hiányzó tokennél a var() érvénytelen → átlátszó).
//   · elementFromPoint a sáv közepén: tényleg ODA van festve, nem takarja semmi
//     (⚠️ görgetés NÉLKÜL — a fixed sáv viewport-koordinátákban él, és az
//     auto-scroll már máskor is zöldre mért egy elgörgetett elemet).
//   · KONTRASZT a gomb-feliratokon: a „link-szabály megeszi a gomb színét" hiba
//     (cián a ciánon, 1.16) gépi „láthatóan" átment — a kontrasztot MÉRNI kell.
//
// ⛔ A HATÓKÖRT IS MÉRI, MINDKÉT ÚTON. A befagyasztott terv kizárja a sávot a
// generált tenant-oldalról; ez a host-úton (`<slug>.citoviso.com`) igaz volt, a
// `/t/<slug>` DEV-úton viszont NEM — és Elek a vendég-oldalt ezen az úton látja.
// A `consent-check` ④ szabálya csak a host-utat mérte, ezért a rés a vakfoltjában ült.
//
// --self-test: a mérőeszközt bizonyítja, nem a kódot. Két szándékos rontás —
// (1) a `cit-consent.css` kérését ELDOBJUK → minden stílus-állításnak PIROSNAK kell
// lennie, (2) a tenant vendég-oldalba BEINJEKTÁLUNK egy sávot → a hatókör-állításnak
// pirosnak kell lennie. Egy őr, amit sosem láttunk pirosnak, nem bizonyíték.

process.env.PUBLIC_PORT = "0";
// A screenshot/őr-futás SOHA ne indítson AI nyelvi-csomag töltést vagy DB-írást.
process.env.CIT_SHOT = "1";

import { once } from "node:events";

import { chromium, type Browser, type Page } from "playwright-core";

const SELF_TEST = process.argv.includes("--self-test");

const { server } = await import("../src/server/public.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const { db } = await import("../src/db/client.js");
const { config } = await import("../src/config.js");
const { PLATFORM_DOMAIN } = await import("../src/domains.js");

let failed = 0;
const reds: string[] = [];
const check = (ok: boolean, what: string, detail = ""): boolean => {
  if (ok) console.log(`  ✓ ${what}`);
  else {
    failed++;
    reds.push(what);
    console.error(`  ✗ ${what}${detail ? ` — ${detail}` : ""}`);
  }
  return ok;
};

// ── A sáv csak érvényes Barion-azonosítóval jelenik meg (§B.17). Azonosító nélkül
// nincs mit mérni, és ezt KIMONDJUK — nem „zöld, mert nem volt dolga".
const PIXEL_OK = /^BP-[A-Za-z0-9]{6,20}-[A-Za-z0-9]{1,4}$/.test(config.barionPixelId);
if (!PIXEL_OK) {
  console.error(
    "\n⛔ BARION_PIXEL_ID nincs (vagy nem `BP-…` alakú) — ilyenkor a sáv MEG SEM JELENIK,\n" +
      "   tehát ez az őr nem tud mérni. Ez NEM zöld: állítsd be a dev .env-ben.",
  );
  server.close();
  await db.destroy();
  process.exit(1);
}

if (!server.listening) await once(server, "listening");
const addr = server.address() as { port: number };
const PORT = addr.port;

const tu =
  (await db
    .selectFrom("tenant_user")
    .select("id")
    .where("username", "=", "claude-test")
    .executeTakeFirst()) ??
  (await db.selectFrom("tenant_user").select("id").limit(1).executeTakeFirst());

const liveSite = await db
  .selectFrom("site")
  .select(["slug"])
  .where("status", "=", "live")
  .where("slug", "is not", null)
  .executeTakeFirst();

interface Viewport {
  label: string;
  width: number;
  height: number;
}
const MOBILE: Viewport = { label: "mobil 390", width: 390, height: 844 };
const DESKTOP: Viewport = { label: "asztali 1280", width: 1280, height: 900 };

/** Amit a böngésző TÉNYLEG lát a sávból — számított stílus + festés-próba. */
interface BarFacts {
  present: boolean;
  position: string;
  bg: string;
  navyProbe: string;
  cyanProbe: string;
  fullWidth: boolean;
  bottomAnchored: boolean;
  height: number;
  hitSelf: boolean;
  hitTag: string;
  yesBg: string;
  yesRadius: number;
  yesBorderStyle: string;
  yesContrast: number;
  noContrast: number;
  textContrast: number;
  yesFontSize: string;
  noFontSize: string;
  innerDirection: string;
  buttonRowFullWidth: boolean;
  buttonsEqualWidth: boolean;
  reservedBottom: number;
  yesWidth: number;
  noWidth: number;
  fontFamily: string;
}

const readBar = (page: Page): Promise<BarFacts> =>
  page.evaluate(() => {
    const bar = document.getElementById("cit-consent");
    const empty = {
      present: false,
      position: "",
      bg: "",
      navyProbe: "",
      cyanProbe: "",
      fullWidth: false,
      bottomAnchored: false,
      height: 0,
      hitSelf: false,
      hitTag: "",
      yesBg: "",
      yesRadius: 0,
      yesBorderStyle: "",
      yesContrast: 0,
      noContrast: 0,
      textContrast: 0,
      yesFontSize: "",
      noFontSize: "",
      innerDirection: "",
      buttonRowFullWidth: false,
      buttonsEqualWidth: false,
      reservedBottom: 0,
      yesWidth: 0,
      noWidth: 0,
      fontFamily: "",
    };
    if (!bar) return empty;

    // Token-PROBE: ugyanebben a dokumentumban oldjuk fel a tokent, és ahhoz mérünk.
    // Ha a token nem létezik a lapon, a var() érvénytelen → átlátszó marad.
    const probe = (decl: string): string => {
      const d = document.createElement("div");
      d.style.cssText = `position:fixed;left:-9999px;top:0;background:${decl}`;
      document.body.appendChild(d);
      const v = getComputedStyle(d).backgroundColor;
      d.remove();
      return v;
    };

    // ⚠️ KÉT SZÁMFORMÁTUM. A `color-mix()` eredményét a Chromium
    // `color(srgb 1 1 1 / 0.82)` alakban adja vissza, ahol a komponensek 0..1
    // közöttiek — az `rgb()` viszont 0..255. Az első mérésem ezt összemosta, és a
    // 82%-os fehér prózát 1,22-es kontraszttal „bukónak" mondta MINDEN felületen,
    // pedig a szöveg tökéletesen olvasható. Ismeretlen formátumra NEM tippelünk:
    // NaN-t adunk, amit az állítás hangosan kibuktat (egy rossz okból zöld/piros
    // mérés rosszabb, mint a mérés hiánya).
    const parse = (c: string): [number, number, number, number] => {
      const m = c.match(/[\d.]+/g);
      if (!m || m.length < 3) return [NaN, NaN, NaN, NaN];
      const scale = c.trim().startsWith("color(") ? 255 : 1;
      const a = m[3] === undefined ? 1 : Number(m[3]);
      return [Number(m[0]) * scale, Number(m[1]) * scale, Number(m[2]) * scale, a];
    };
    const lum = (r: number, g: number, b: number): number => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    // A szöveg alfája (és a szülő háttere) NÉLKÜL a kontraszt-szám hazudik: a
    // félig átlátszó fehér próza nem fehér. Ezért kompozitálunk.
    const contrast = (fg: string, bgc: string, opacity = 1): number => {
      const [fr, fg2, fb, fa] = parse(fg);
      const [br, bg2, bb] = parse(bgc);
      const a = fa * opacity;
      const [cr, cg, cb] = [fr * a + br * (1 - a), fg2 * a + bg2 * (1 - a), fb * a + bb * (1 - a)];
      const l1 = lum(cr, cg, cb);
      const l2 = lum(br, bg2, bb);
      const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
      return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
    };

    const cs = getComputedStyle(bar);
    const r = bar.getBoundingClientRect();
    // A gazdalap által FENNTARTOTT alsó sáv, px-ben. ⚠️ A TOKENT NEM lehet
    // parse-olni: a `getPropertyValue` a nyers `calc(186px + env(…))` stringet adja
    // vissza, amin a `parseFloat` NaN-t ad — az első mérésem ezért 0-nak hitte a
    // fenntartott sávot, miközben a sáv helyesen fel volt emelve. A sáv SAJÁT
    // `bottom`-ja viszont már feloldott px-érték.
    const reserved = parseFloat(getComputedStyle(bar).bottom) || 0;
    const yes = bar.querySelector(".cit-consent__yes") as HTMLElement | null;
    const no = bar.querySelector(".cit-consent__no") as HTMLElement | null;
    const txt = bar.querySelector(".cit-consent__t") as HTMLElement | null;
    const inner = bar.querySelector(".cit-consent__in") as HTMLElement | null;
    const bRow = bar.querySelector(".cit-consent__b") as HTMLElement | null;

    // Festés-próba a sáv KÖZEPÉN, viewport-koordinátában, görgetés nélkül.
    const cx = Math.round(r.left + r.width / 2);
    const cy = Math.round(r.top + r.height / 2);
    const hit = document.elementFromPoint(cx, cy);

    const yesCs = yes ? getComputedStyle(yes) : null;
    const noCs = no ? getComputedStyle(no) : null;
    const txtCs = txt ? getComputedStyle(txt) : null;
    const yr = yes ? yes.getBoundingClientRect() : null;
    const nr = no ? no.getBoundingClientRect() : null;

    return {
      present: true,
      position: cs.position,
      bg: cs.backgroundColor,
      navyProbe: probe("var(--citui-navy-950)"),
      cyanProbe: probe("var(--citui-cyan-500)"),
      fullWidth: Math.abs(r.width - window.innerWidth) <= 1,
      // ⭐ NEM „bottom: 0", hanem „a FENNTARTOTT sáv fölött". A gazdalap
      // deklarálhat magának helyet (`--citui-consent-bottom`) — a mobil
      // tenant-admin fül-sávja ilyen —, és ilyenkor a sáv helyesen NEM a viewport
      // aljáig ér. Az elvárt alsó él ezért a deklarált értékből számolódik, nem
      // egy fix 0-ból; így a mérés a szabályt méri, nem az egyik esetét.
      // ⚠️ NEM a „bottom == viewport alja" a szabály (a gazdalap fenntarthat magának
      // helyet), de nem is tautológia: azt mérjük, hogy a sáv EGÉSZE a viewportban
      // van ÉS az alsó félben ül — ez fogja meg a kicsúszott/elúszott sávot is.
      bottomAnchored: r.top >= 0 && r.bottom <= window.innerHeight + 1 && r.top > window.innerHeight / 2,
      reservedBottom: Math.round(reserved),
      height: Math.round(r.height),
      hitSelf: !!hit && (hit === bar || bar.contains(hit)),
      hitTag: hit ? `${hit.tagName.toLowerCase()}${hit.className ? "." + String(hit.className).split(" ")[0] : ""}` : "—",
      yesBg: yesCs ? yesCs.backgroundColor : "",
      yesRadius: yesCs ? parseFloat(yesCs.borderTopLeftRadius) || 0 : 0,
      yesBorderStyle: yesCs ? yesCs.borderTopStyle : "",
      yesContrast: yesCs ? contrast(yesCs.color, yesCs.backgroundColor, Number(yesCs.opacity)) : 0,
      noContrast: noCs ? contrast(noCs.color, cs.backgroundColor, Number(noCs.opacity)) : 0,
      textContrast: txtCs ? contrast(txtCs.color, cs.backgroundColor, Number(txtCs.opacity)) : 0,
      yesFontSize: yesCs ? yesCs.fontSize : "",
      noFontSize: noCs ? noCs.fontSize : "",
      // A terv köti (ld. approved.html + mobile.png): szűk sávban a PRÓZA a gombok
      // FÖLÉ kerül (`.cit-consent__in` → column), a két gomb pedig EGY teljes
      // szélességű sort oszt meg EGYENLŐ arányban (`flex: 1`). ⚠️ Nem egymás ALATT
      // vannak — ezt az első mérésem a README prózájából félreolvasta, a jóváhagyott
      // KÉP viszont egyértelmű: fél-fél szélességű gombpár egy sorban.
      innerDirection: inner ? getComputedStyle(inner).flexDirection : "",
      buttonRowFullWidth: !!bRow && !!inner ? bRow.getBoundingClientRect().width >= inner.clientWidth * 0.9 : false,
      // Egyenlő szélesség = egyenrangú hozzáférés: az elutasítás nem lehet
      // nehezebben elérhető vagy kisebb, mint az elfogadás (a terv ezt köti).
      // ⚠️ 2px TŰRÉS, és ez nem lazítás: az elutasító gombon `border: 1px` van
      // (keretes, másodlagos), az elfogadón `border: 0` — a `flex: 1` a tartalom-
      // dobozt osztja egyenlően, a keret 2×1px-e ezért RÁJÖN. Mérve 174 vs 176.
      buttonsEqualWidth: !!yr && !!nr && Math.abs(yr.width - nr.width) <= 2,
      yesWidth: yr ? Math.round(yr.width) : 0,
      noWidth: nr ? Math.round(nr.width) : 0,
      fontFamily: txtCs ? txtCs.fontFamily : "",
    };
  });

interface Surface {
  name: string;
  host: string;
  path: string;
  auth?: boolean;
  /** A sávnak MEG KELL jelennie itt? (false = a terv kizárja) */
  expectBar: boolean;
  /**
   * A lap aljára rögzített SAJÁT bútorzat, amit a sáv nem takarhat el (CSS-szelektor).
   * A mobil tenant-admin fül-sávja ilyen: a sáv MÉRTEN 11 fülből 6-ot elérhetetlenné
   * tett, ezért a tulaj döntése az lett, hogy a sáv EFÖLÉ ül (`--citui-consent-bottom`).
   */
  bottomFurniture?: string;
}

/** Elérhető-e KATTINTÁSSAL a gazdalap alsó bútorzatának minden eleme? */
const readFurnitureReach = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const nav = document.querySelector(sel) as HTMLElement | null;
    if (!nav) return { found: false, total: 0, covered: [] as string[] };
    // ⚠️ A rejtett (display:none) elemeket kihagyjuk: a mobil fül-sávban a
    // márka/kiléptető blokk `display:none`, azokat nem a sáv takarja.
    const items = (Array.from(nav.querySelectorAll("a,button")) as HTMLElement[]).filter(
      (e) => e.getBoundingClientRect().height > 0,
    );
    const covered: string[] = [];
    for (const it of items) {
      const r = it.getBoundingClientRect();
      // Görgetés NÉLKÜL, viewport-koordinátában — a fixed sáv ott él.
      const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      if (hit && hit !== it && !it.contains(hit)) {
        covered.push(`${(it.textContent ?? "").trim().slice(0, 14)} (${hit.id || String(hit.className).slice(0, 18)})`);
      }
    }
    return { found: true, total: items.length, covered };
  }, selector);

const surfaces: Surface[] = [
  { name: "publikus landing /", host: PLATFORM_DOMAIN, path: "/", expectBar: true },
  { name: "jogi /adatvedelem", host: PLATFORM_DOMAIN, path: "/adatvedelem", expectBar: true },
  { name: "jogi /aszf", host: PLATFORM_DOMAIN, path: "/aszf", expectBar: true },
  { name: "belépés /login", host: PLATFORM_DOMAIN, path: "/login", expectBar: true },
  {
    name: "tenant-admin /admin",
    host: PLATFORM_DOMAIN,
    path: "/admin",
    auth: true,
    expectBar: true,
    bottomFurniture: ".adm-side",
  },
  {
    name: "tenant-admin /admin?tab=modules",
    host: PLATFORM_DOMAIN,
    path: "/admin?tab=modules",
    auth: true,
    expectBar: true,
    bottomFurniture: ".adm-side",
  },
];
if (liveSite?.slug) {
  surfaces.push({
    name: `tenant vendég-oldal (HOST ${liveSite.slug}.${PLATFORM_DOMAIN})`,
    host: `${liveSite.slug}.${PLATFORM_DOMAIN}`,
    path: "/",
    expectBar: false,
  });
  surfaces.push({
    name: `tenant vendég-oldal (DEV /t/${liveSite.slug})`,
    host: PLATFORM_DOMAIN,
    path: `/t/${liveSite.slug}`,
    expectBar: false,
  });
}

// ⚠️ A Host fejlécet NEM lehet kézzel beállítani: a Chromium tiltott fejlécként
// ERR_INVALID_ARGUMENT-tal elhasal rajta (mérve), a `fetch` pedig némán eldobja.
// Ezért a VALÓDI hosztnevet használjuk, és a böngésző név-feloldását tereljük a
// helyi szerverre — így pontosan azt az útválasztást mérjük, ami élesen fut.
const browser: Browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${PLATFORM_DOMAIN} 127.0.0.1, MAP *.${PLATFORM_DOMAIN} 127.0.0.1`],
});

const open = async (s: Surface, vp: Viewport): Promise<Page> => {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  if (s.auth && tu) {
    await ctx.addCookies([
      { name: "cit_session", value: mintTenantCookieValue(tu.id), domain: s.host, path: "/" },
    ]);
  }
  const page = await ctx.newPage();
  // ⚠️ A tsx/esbuild „keepNames" a kiértékelt függvénybe egy `__name` segédhívást
  // injektál, ami a böngésző-kontextusban nem létezik → `ReferenceError` (mérve).
  // Sima STRINGként adjuk át, hogy magát a shimet ne transzformálja semmi.
  await page.addInitScript("window.__name = (f) => f;");
  if (SELF_TEST) {
    // RONTÁS ①: a sáv stíluslapja SOSEM érkezik meg → csupasz sáv.
    await page.route("**/cit-consent.css*", (r) => r.abort());
  }
  await page.goto(`http://${s.host}:${PORT}${s.path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  return page;
};

console.log(
  `\n── Süti-sáv: van-e TÉNYLEGES stílusa ott, ahol megjelenik ──────────────────\n` +
    `   port=${PORT} · tenant_user=${tu?.id ?? "NINCS"} · live site=${liveSite?.slug ?? "NINCS"}` +
    (SELF_TEST ? "\n   ⚠️  ÖNTESZT: a cit-consent.css eldobva + sáv injektálva a vendég-oldalra" : ""),
);

for (const s of surfaces.filter((x) => x.expectBar)) {
  console.log(`\n▸ ${s.name}`);
  for (const vp of [MOBILE, DESKTOP]) {
    const page = await open(s, vp);
    const f = await readBar(page);
    const tag = `${vp.label}`;

    if (!check(f.present, `${tag}: a sáv megjelenik`)) {
      await page.context().close();
      continue;
    }
    // ⭐ A DÖNTŐ ÁLLÍTÁS: a háttér a navy TOKEN feloldott értéke. Ez egyszerre
    // bizonyítja, hogy a szabály hatályos, és hogy a token létezik ezen a lapon.
    check(
      f.bg === f.navyProbe && f.navyProbe !== "rgba(0, 0, 0, 0)",
      `${tag}: a sáv háttere a --citui-navy-950 token (nem csupasz)`,
      `sáv=${f.bg} · token=${f.navyProbe}`,
    );
    check(f.position === "fixed", `${tag}: a sáv a lap aljára RÖGZÍTVE (fixed)`, `position=${f.position}`);
    check(f.fullWidth, `${tag}: teljes szélességű (nem tapad a bal szélre)`);
    check(
      f.bottomAnchored,
      `${tag}: a sáv EGÉSZE a viewportban, az alsó félben ül`,
      `fenntartott alsó sáv=${f.reservedBottom}px`,
    );
    check(f.height > 30, `${tag}: van tényleges magassága`, `${f.height}px`);
    check(f.hitSelf, `${tag}: a sáv közepén TÉNYLEG a sáv van festve`, `elementFromPoint=${f.hitTag}`);
    // Natív gomb: nincs radius, és a háttere a böngésző szürkéje — a cián token nem.
    check(
      f.yesBg === f.cyanProbe && f.cyanProbe !== "rgba(0, 0, 0, 0)",
      `${tag}: az „Elfogadom" a cián token (NEM natív böngésző-gomb)`,
      `gomb=${f.yesBg} · token=${f.cyanProbe}`,
    );
    check(f.yesRadius > 0, `${tag}: a gomb lekerekített (natív gombnak 0)`, `radius=${f.yesRadius}`);
    check(f.yesBorderStyle === "none", `${tag}: nincs natív gomb-keret`, `border-style=${f.yesBorderStyle}`);
    check(f.fontFamily.includes("Inter"), `${tag}: a saját betűnk (--citui-font-text)`, f.fontFamily);
    // Kontraszt: a „link-szabály megeszi a gomb színét" hiba gépi láthatóságon átment.
    check(f.yesContrast >= 4.5, `${tag}: „Elfogadom" feliratának kontrasztja ≥ 4,5`, `${f.yesContrast}`);
    check(f.noContrast >= 4.5, `${tag}: „Csak a szükségeseket" kontrasztja ≥ 4,5`, `${f.noContrast}`);
    check(f.textContrast >= 4.5, `${tag}: a sáv prózájának kontrasztja ≥ 4,5`, `${f.textContrast}`);
    // A terv köti: az elutasítás nem lehet kevésbé látható, mint az elfogadás.
    check(
      f.yesFontSize === f.noFontSize,
      `${tag}: a két gomb felirata EGYENRANGÚ (azonos méret)`,
      `elfogad=${f.yesFontSize} · elutasít=${f.noFontSize}`,
    );
    // ⭐ @container (max-width: 560px) — a váltás a SÁV szélességéhez kötődik, nem
    // az ablakhoz. Ez a legérzékenyebb jelzés arra, hogy a stíluslap TÉNYLEG
    // hatályos: stíluslap nélkül a `.cit-consent__in` sima blokk marad.
    if (vp === MOBILE) {
      check(
        f.innerDirection === "column",
        `${tag}: szűk sávban a próza a gombok FÖLÉ kerül (@container hatályos)`,
        `flex-direction=${f.innerDirection}`,
      );
      check(f.buttonRowFullWidth, `${tag}: a gomb-sor teljes szélességben`);
      // ⚠️ CSAK MOBILON egyenlő a két gomb (`flex: 1` a teljes szélességű soron).
      // Asztalin a JÓVÁHAGYOTT KÉP tartalom-szélességű gombokat mutat (a hosszabb
      // „Csak a szükségeseket" szélesebb) — ott az egyenrangúságot a méret-azonos
      // felirat és a közös sor adja, nem az azonos pixel-szélesség. Ezt is a képen
      // mértem vissza, nem a README prózájából vettem.
      check(
        f.buttonsEqualWidth,
        `${tag}: a két gomb EGYENLŐ szélességű (egyenrangú hozzáférés)`,
        `elfogad=${f.yesWidth}px · elutasít=${f.noWidth}px`,
      );
    } else {
      check(
        f.innerDirection === "row",
        `${tag}: asztalin a próza és a gombok EGY SORBAN`,
        `flex-direction=${f.innerDirection}`,
      );
    }
    // ⭐⭐ A HOZZÁJÁRULÁS-KÉRDÉS NEM TEHETI ELÉRHETETLENNÉ A NAVIGÁCIÓT (tulaj-döntés,
    // 2026-09-14). Ez egyben a `--citui-consent-bottom` MÉRT konstansának őre: ha a
    // fül-sáv magassága elmozdul (új fül, hosszabb fordítás, harmadik sor), itt bukik.
    if (s.bottomFurniture) {
      const reach = await readFurnitureReach(page, s.bottomFurniture);
      check(reach.found, `${tag}: a gazdalap alsó fül-sávja megvan (${s.bottomFurniture})`);
      if (reach.found) {
        check(
          reach.covered.length === 0,
          `${tag}: a sáv EGYETLEN fület sem takar el (${reach.total} fül)`,
          reach.covered.length ? `takarva: ${reach.covered.join(" · ")}` : "",
        );
      }
    }
    await page.context().close();
  }
}

// ── Hatókör: a generált tenant-oldal MINDKÉT úton sáv NÉLKÜL ──────────────────
for (const s of surfaces.filter((x) => !x.expectBar)) {
  console.log(`\n▸ ${s.name} — a tervnek megfelelően NEM kaphat sávot`);
  const page = await open(s, DESKTOP);
  if (SELF_TEST) {
    // RONTÁS ②: beinjektálunk egy sávot — a hatókör-állításnak pirosnak kell lennie.
    await page.evaluate(() => {
      const d = document.createElement("div");
      d.id = "cit-consent";
      document.body.appendChild(d);
    });
  }
  const html = await page.content();
  const f = await readBar(page);
  check(!f.present, "⭐ a vendég-oldalon NINCS süti-sáv (a vendég nem nálunk fizet)");
  check(!/cit-consent\.js/.test(html), "a vendég-oldal a hozzájárulás-kezelőt sem kapja meg");
  check(!/cit-consent\.css/.test(html), "a vendég-oldal a sáv stíluslapját sem kapja meg");
  check(!/pixel\.barion\.com/.test(html), "a vendég-oldal NEM kap Barion Pixelt");
  await page.context().close();
}

await browser.close();
server.close();
await db.destroy();

console.log("");
if (SELF_TEST) {
  // Az önteszt akkor sikeres, ha a rontásokat TÉNYLEG elkapta.
  const wantedReds = [
    /háttere a --citui-navy-950/,
    /NEM natív böngésző-gomb/,
    /lekerekített/,
    /NINCS süti-sáv/,
  ];
  const missed = wantedReds.filter((re) => !reds.some((r) => re.test(r)));
  if (missed.length) {
    console.error(
      `⛔ ÖNTESZT BUKOTT: a mérőeszköz ${missed.length} szándékos rontást NEM vett észre:\n` +
        missed.map((m) => `   · ${m}`).join("\n"),
    );
    process.exit(1);
  }
  console.log(
    `✅ ÖNTESZT OK: a rontott állapotot ${failed} állításban elkapta (köztük a csupasz sáv,\n` +
      `   a natív gomb és a vendég-oldalra injektált sáv) — az őr tud pirosat mutatni.`,
  );
  process.exit(0);
}
if (failed) {
  console.error(`⛔ ${failed} ellenőrzés bukott — a sáv valahol stílus nélkül (vagy rossz helyen) jelenik meg.`);
  process.exit(1);
}
console.log("✅ consent-style-check: a sáv MINDEN saját felületen a befagyasztott terv szerint fest, a vendég-oldalon nincs ott.");
process.exit(0);
