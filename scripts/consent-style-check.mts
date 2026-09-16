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
// ⛔ A HATÓKÖRT IS MÉRI, MINDEN ÚTON. A befagyasztott terv kizárja a sávot a
// generált tenant-oldalról; ez a host-úton (`<slug>.citoviso.com`) igaz volt, a
// `/t/<slug>` DEV-úton viszont NEM — és Elek a vendég-oldalt ezen az úton látja.
// A `consent-check` ④ szabálya csak a host-utat mérte, ezért a rés a vakfoltjában ült.
//
// ⛔⛔ A HATÓKÖR NEM KÉT ÚTVONAL KÉRDÉSE, HANEM A CÍMZETTÉ (Elek FK-007 Z5, 2026-09-14).
// A `/t/<slug>` javítása a TÜNETET vitte el: a jelölő egy SORBAN dőlt el, tehát minden
// alatta élő vendég-lap ugyanúgy megkapta a sávot. MÉRVE, ugyanabban a futásban:
//   · `/foglalas/<token>/lemondom` GET és POST  → SÁV + PIXEL (a bejelentett lelet)
//   · `/site/<preview_token>`                   → SÁV + PIXEL (UGYANAZ a
//      `sites/<tenant>/index.html`, amit a tenant-host ad ki — harmadik ajtó)
//   · `/m/<token>` mock-előnézet                → SÁV + PIXEL (a szállás-oldal
//      bemutató-változata, HIDEG megkeresés címzettjének)
// Ezért ez a szakasz mostantól a CÍMZETT szerint mér, és MINDKÉT irányban: a
// vendég-lapokon NINCS sáv/Pixel, a saját lapjainkon VAN (különben egy néma
// mérőeszköz is „zöld" volna), és a kettő EGYÜTT mozog.
//
// ⚠️ AMIT EZ AZ ŐR NEM TUD MEGMÉRNI: a `/m/<token>` mock-előnézethez `mock_request`
// sor + lemezen lévő artefaktum kell; a közös dev-parkban ez gyakran 0 (mérve:
// 0 sor / 3 artefaktum, mind hiányzó fájllal). Ilyenkor a sor KIMONDOTTAN kimarad,
// nem „zöld, mert nem volt dolga". A javítás kézzel, önmagát takarító fixture-rel
// MÉRVE lett (2026-09-14: előtte SÁV+PIXEL 873 bájt, utána tiszta 527 bájt).
//
// --self-test: a mérőeszközt bizonyítja, nem a kódot. Három szándékos rontás —
// (1) a `cit-consent.css` kérését ELDOBJUK → minden stílus-állításnak PIROSNAK kell
// lennie, (2) a tenant vendég-oldalba BEINJEKTÁLUNK egy sávot → a hatókör-állításnak
// pirosnak kell lennie, (3) a nyers-HTTP hatókör-mérésbe BEHAMISÍTJUK a sáv+Pixel
// sorát → a vendég-lapok állításainak pirosnak kell lenniük. Egy őr, amit sosem
// láttunk pirosnak, nem bizonyíték.

process.env.PUBLIC_PORT = "0";
// ⛔ A KONZOL IS. A `citoviso.com` élesben KÉT processz között van felosztva (nginx),
// és a vevő fizetési útja a MÁSIKON megy — ez az őr eddig csak a public szervert
// ismerte, ezért a rés a vakfoltjában ült (ADR-0172).
process.env.CONSOLE_PORT = "0";
// A screenshot/őr-futás SOHA ne indítson AI nyelvi-csomag töltést vagy DB-írást.
process.env.CIT_SHOT = "1";

import { once } from "node:events";
import { request as httpReq } from "node:http";

import { chromium, type Browser, type Page } from "playwright-core";

const SELF_TEST = process.argv.includes("--self-test");

const { server } = await import("../src/server/public.js");
const { server: consoleServer } = await import("../src/console/server.js");
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
if (!consoleServer.listening) await once(consoleServer, "listening");
const CONSOLE_PORT = (consoleServer.address() as { port: number }).port;

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

// A `/site/<preview_token>` UGYANAZT a pillanatképet adja ki, amit a tenant-host —
// csak token-nel, bejelentkezés nélkül. Ettől még a VENDÉG lapja.
const previewSite = await db
  .selectFrom("site")
  .select(["preview_token"])
  .where("preview_token", "is not", null)
  .executeTakeFirst();

// A vendég lemondó lapja ISMERETLEN tokennel is teljes értékű lapot renderel
// („A link már nem él" zsákutca, `guestPageShell`) — ezért mérhető adat és
// mellékhatás nélkül. A POST ugyanezzel a tokennel nem mond le semmit.
const DEAD_CANCEL_TOKEN = "cit-consent-check-nincs-ilyen-token";
const GUEST_CANCEL_PATH = `/foglalas/${DEAD_CANCEL_TOKEN}/lemondom`;

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
  /** Melyik processz adja ki? (a konzol a vevő fizetési útját viszi) */
  port?: number;
  /**
   * KINEK szól a lap. A „nem kaphat sávot" két KÜLÖNBÖZŐ okból állhat, és az
   * indoklás nem cserélhető fel: a vendég-lap a szállásé, az operátor-lap a
   * belső munkaeszközünk. Egy „vendég-oldal" feliratú piros egy /login-ra
   * félrevezető lenne.
   */
  audience: "own" | "guest" | "operator";
  /** A sávnak MEG KELL jelennie itt? (false = a terv kizárja) */
  expectBar: boolean;
  /**
   * A lap aljára rögzített SAJÁT bútorzat, amit a sáv nem takarhat el (CSS-szelektor).
   * A mobil tenant-admin fül-sávja ilyen: a sáv MÉRTEN 11 fülből 6-ot elérhetetlenné
   * tett, ezért a tulaj döntése az lett, hogy a sáv EFÖLÉ ül (`--citui-consent-bottom`).
   */
  bottomFurniture?: string;
}

/**
 * Elérhető-e KATTINTÁSSAL a gazdalap bútorzatának minden eleme — A SÁV MIATT?
 *
 * ⛔ A KÉRDÉS PONTOSSÁGA (javítva 2026-09-15). Ez a mérés eredetileg BÁRMILYEN
 * takaró elemre pirosat adott, és ezzel MÁS KÉRDÉSRE válaszolt, mint amit a neve
 * ígér. Élesben elbukott rajta a fizetés-visszatérő lap egy SOREMELT inline
 * linkje: a kétsoros `<a>` befoglaló dobozának középpontja a két sor KÖZÉ esik,
 * ezért az `elementFromPoint` a szülő `<p>`-t adta vissza — miközben a sáv 362
 * px-rel LEJJEBB volt. Egy jó okból piros mérés is hamis, ha nem arra felel,
 * amire hivatkozik.
 *
 * A verdikt tehát: takarja-e A SÁV. Ha más takar, azt KIÍRJUK (nem nyeljük el),
 * de nem ennek az őrnek a verdiktje — az egy másik hibaosztály.
 */
const readFurnitureReach = (page: Page, selector: string) =>
  page.evaluate((sel) => {
    const nav = document.querySelector(sel) as HTMLElement | null;
    if (!nav) return { found: false, total: 0, covered: [] as string[], other: [] as string[] };
    // ⚠️ A rejtett (display:none) elemeket kihagyjuk: a mobil fül-sávban a
    // márka/kiléptető blokk `display:none`, azokat nem a sáv takarja.
    const items = (Array.from(nav.querySelectorAll("a,button")) as HTMLElement[]).filter(
      (e) => e.getBoundingClientRect().height > 0,
    );
    const bar = document.getElementById("cit-consent");
    const covered: string[] = [];
    const other: string[] = [];
    for (const it of items) {
      const r = it.getBoundingClientRect();
      // Görgetés NÉLKÜL, viewport-koordinátában — a fixed sáv ott él.
      const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      if (!hit || hit === it || it.contains(hit)) continue;
      const label = `${(it.textContent ?? "").trim().slice(0, 14)} (${hit.id || String(hit.className).slice(0, 18) || hit.tagName.toLowerCase()})`;
      if (bar && (hit === bar || bar.contains(hit))) covered.push(label);
      else other.push(label);
    }
    return { found: true, total: items.length, covered, other };
  }, selector);

const surfaces: Surface[] = [
  { name: "publikus landing /", host: PLATFORM_DOMAIN, path: "/", audience: "own", expectBar: true },
  { name: "jogi /adatvedelem", host: PLATFORM_DOMAIN, path: "/adatvedelem", audience: "own", expectBar: true },
  { name: "jogi /aszf", host: PLATFORM_DOMAIN, path: "/aszf", audience: "own", expectBar: true },
  { name: "belépés /login", host: PLATFORM_DOMAIN, path: "/login", audience: "own", expectBar: true },
  {
    name: "tenant-admin /admin",
    host: PLATFORM_DOMAIN,
    path: "/admin",
    auth: true,
    audience: "own",
    expectBar: true,
    bottomFurniture: ".adm-side",
  },
  {
    name: "tenant-admin /admin?tab=modules",
    host: PLATFORM_DOMAIN,
    path: "/admin?tab=modules",
    auth: true,
    audience: "own",
    expectBar: true,
    bottomFurniture: ".adm-side",
  },
];
if (liveSite?.slug) {
  surfaces.push({
    name: `tenant vendég-oldal (HOST ${liveSite.slug}.${PLATFORM_DOMAIN})`,
    host: `${liveSite.slug}.${PLATFORM_DOMAIN}`,
    path: "/",
    audience: "guest",
    expectBar: false,
  });
  surfaces.push({
    name: `tenant vendég-oldal (DEV /t/${liveSite.slug})`,
    host: PLATFORM_DOMAIN,
    path: `/t/${liveSite.slug}`,
    audience: "guest",
    expectBar: false,
  });
}
if (previewSite?.preview_token) {
  surfaces.push({
    name: `tenant vendég-oldal (ELŐNÉZET /site/<token>)`,
    host: PLATFORM_DOMAIN,
    path: `/site/${previewSite.preview_token}`,
    audience: "guest",
    expectBar: false,
  });
}
surfaces.push({
  name: "vendég lemondó lap (/foglalas/<token>/lemondom)",
  host: PLATFORM_DOMAIN,
  path: GUEST_CANCEL_PATH,
  audience: "guest",
  expectBar: false,
});

// ── A KONZOL PROCESSZ (:4600) felületei ───────────────────────────────────────
// Élesben az nginx a `/pay/`, `/configure/`, `/p/`, `/privacy`, `/site/`, `/mock/`
// utakat ERRE a processzre viszi — a vevő fizetési útja tehát NEM a public
// szerveren fut. Ez az őr eddig ezt a felet nem is látta.
surfaces.push({
  name: "konzol jogi /aszf (a vevő a pénztárból nyitja)",
  host: PLATFORM_DOMAIN,
  path: "/aszf",
  port: CONSOLE_PORT,
  audience: "own",
  expectBar: true,
});
// ⭐ A VALÓDI fizetés-visszatérő lap: élesben EZ a Barion `RedirectUrl`-je.
// A park saját, kifizetett rendeléséből dolgozunk — fixture-t NEM gyártunk
// (a park KÖZÖS). Ha nincs ilyen sor, a mérés KIMONDOTTAN kimarad.
// ⛔ DETERMINISZTIKUS VÁLASZTÁS (2026-09-15). `orderBy` nélkül az `executeTakeFirst()`
// TETSZŐLEGES sort adott vissza, tehát futásonként MÁS fizetésre mért — egy
// felület-őr, ami körönként más lapot néz, hol zöld, hol piros, és a bukását
// „villódzásnak" könyveljük el. Ugyanaz a sor minden futásban.
// ⚠️ Ez NEM a hiba elfedése: a lap HTTP-státuszát külön állítás méri (lásd lentebb),
// tehát ha a kiválasztott fizetésen a `/pay/done` 500-at adna, az PIROS — nem kimarad.
const paidRef = await db
  .selectFrom("payment")
  .select("gateway_ref")
  .where("gateway_ref", "is not", null)
  .where("status", "=", "paid")
  .orderBy("created_at", "asc")
  .orderBy("gateway_ref", "asc")
  .executeTakeFirst();
if (paidRef?.gateway_ref) {
  surfaces.push({
    name: "konzol FIZETÉS-VISSZATÉRÉS /pay/done (Barion RedirectUrl)",
    host: PLATFORM_DOMAIN,
    path: `/pay/done?paymentId=${encodeURIComponent(paidRef.gateway_ref)}`,
    port: CONSOLE_PORT,
    audience: "own",
    expectBar: true,
    // ⛔ A sáv NEM takarhatja a fizetés-lap kiútjait. Az ADR-0145 ④ ugyanezt a
    // hibát a tenant-admin fül-sávján mérte ki — fizetés-lapon súlyosabb.
    bottomFurniture: ".panel",
  });
}
// A konzol OPERÁTOR-felülete és a rajta kiszolgált VENDÉG-lapok: egyik sem kaphat
// sávot — két külön okból, és az őr megnevezi, melyikből.
surfaces.push({
  name: "konzol operátor-belépés /login (belső munkaeszköz)",
  host: PLATFORM_DOMAIN,
  path: "/login",
  port: CONSOLE_PORT,
  audience: "operator",
  expectBar: false,
});
if (previewSite?.preview_token) {
  surfaces.push({
    name: "konzol vendég-oldal /site/<token> (ÖTÖDIK ajtó ugyanarra a fájlra)",
    host: PLATFORM_DOMAIN,
    path: `/site/${previewSite.preview_token}`,
    port: CONSOLE_PORT,
    audience: "guest",
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
  const resp = await page.goto(`http://${s.host}:${s.port ?? PORT}${s.path}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(400);
  // ⛔ A LAP MAGA IS ÁLLÍTÁS (2026-09-15). Eddig a betöltés némán megtörtént, és egy
  // HTTP 500-as hibalapon a sáv-mérések „hiányzó bútorzatot" jelentettek — vagyis az
  // őr a TÜNETRŐL beszélt (nincs `.panel`), miközben a baj az volt, hogy a lap
  // ELSZÁLLT. Mérve ezen a napon: a `/pay/done` 500-at adott, mert a fizetési átjáró
  // HTTP 429-et küldött HTML hibalappal, és a `resp.json()` nyersen dobott.
  lastStatus.set(s.name, resp?.status() ?? 0);
  return page;
};

/** A legutóbb betöltött lap HTTP-státusza felületenként — külön állítás méri. */
const lastStatus = new Map<string, number>();

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
    // A lap egyáltalán kiszolgálódott-e? Ez az ELSŐ kérdés: hibalapon minden további
    // mérés a rossz dologról beszélne.
    check(
      (lastStatus.get(s.name) ?? 0) < 400,
      `${tag}: a lap HIBA NÉLKÜL szolgálódik ki`,
      `HTTP ${lastStatus.get(s.name) ?? "?"}`,
    );
    if (s.bottomFurniture) {
      const reach = await readFurnitureReach(page, s.bottomFurniture);
      check(reach.found, `${tag}: a gazdalap bútorzata megvan (${s.bottomFurniture})`);
      if (reach.found) {
        check(
          reach.covered.length === 0,
          `${tag}: a SÁV egyetlen vezérlőt sem takar el (${reach.total} vezérlő)`,
          reach.covered.length ? `takarva: ${reach.covered.join(" · ")}` : "",
        );
        // Nem ennek az őrnek a verdiktje, de nem is nyeljük el: ha MÁS takar egy
        // vezérlőt, azt kiírjuk — a hallgatás itt „minden rendben"-nek olvasódna.
        if (reach.other.length) {
          console.log(`  · ${tag}: nem a sáv, de takar valami: ${reach.other.join(" · ")}`);
        }
      }
    }
    await page.context().close();
  }
}

// ── Hatókör: ami NEM a mi webshopunk lapja, az sáv NÉLKÜL ────────────────────
// ⚠️ A felirat a CÍMZETTBŐL származik, nem egy beégetett szóból: a „vendég-oldal"
// indoklás egy operátor-lapon MÁS KÉRDÉSRE válaszolna (a kettő nem ugyanazért
// marad tiszta), és egy félrecímkézett piros elviszi a keresést rossz irányba.
const WHY_NO_BAR: Record<"guest" | "operator", string> = {
  guest: "a vendég lapja — a vendég nem nálunk fizet",
  operator: "belső operátor-felület — nem webshop-lap",
};
for (const s of surfaces.filter((x) => !x.expectBar)) {
  const who = s.audience === "operator" ? "operator" : "guest";
  console.log(`\n▸ ${s.name} — NEM kaphat sávot (${WHY_NO_BAR[who]})`);
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
  const tag = s.name;
  check(!f.present, `⭐ ${tag}: NINCS süti-sáv (${WHY_NO_BAR[who]})`);
  check(!/cit-consent\.js/.test(html), `${tag}: a hozzájárulás-kezelőt sem kapja meg`);
  check(!/cit-consent\.css/.test(html), `${tag}: a sáv stíluslapját sem kapja meg`);
  check(!/pixel\.barion\.com/.test(html), `${tag}: NEM kap Barion Pixelt`);
  await page.context().close();
}

await browser.close();

// ── ⭐⭐ CÍMZETT-HATÓKÖR (nyers HTTP, MINDKÉT IRÁNYBAN) ─────────────────────────
// Miért nem elég a fenti böngésző-ág: (1) a `page.goto` csak GET, a lemondó lap
// EREDMÉNY-oldala viszont POST — az Elek-lelet éppen ott is élt; (2) egy tiltás
// annyit ér, amennyit a mérőeszköz LÁTNI tud, ezért ugyanitt POZITÍV kontrollt is
// mérünk: a saját lapjainkon MEG KELL jelennie a sávnak és a Pixelnek. Ha a probe
// néma volna (rossz port, rossz Host, üres válasz), a pozitív sorok buknának —
// „nem találtam sávot" nem lehet siker.
console.log("\n── ⭐⭐ Kinek szól a lap: a sáv+Pixel hatóköre ──────────────────────");

const raw = (
  path: string,
  method: "GET" | "POST",
  host = PLATFORM_DOMAIN,
  port = PORT,
): Promise<string> =>
  new Promise((resolve) => {
    const req = httpReq(
      {
        host: "127.0.0.1",
        port,
        path,
        method,
        headers: { Host: host, "content-type": "application/x-www-form-urlencoded", "content-length": "0" },
      },
      (res) => {
        let b = "";
        res.setEncoding("utf8");
        res.on("data", (d) => (b += d));
        res.on("end", () => resolve(b));
      },
    );
    req.on("error", () => resolve(""));
    req.end();
  });

interface ScopeCase {
  readonly label: string;
  readonly path: string;
  readonly method: "GET" | "POST";
  readonly host?: string;
  /** Melyik processz adja ki (alapértelmezés: a public szerver). */
  readonly port?: number;
  /**
   * "own"      = a mi webshopunk lapja (sáv+Pixel jár)
   * "guest"    = a tenant vendégéé (tilos)
   * "operator" = belső munkaeszköz (szintén tilos, de MÁS okból)
   */
  readonly audience: "own" | "guest" | "operator";
}

const scopeCases: ScopeCase[] = [
  // A VENDÉGÉ — egyiken sem indul nálunk fizetés.
  { label: "vendég lemondó — megerősítés (GET)", path: GUEST_CANCEL_PATH, method: "GET", audience: "guest" },
  { label: "vendég lemondó — eredmény (POST)", path: GUEST_CANCEL_PATH, method: "POST", audience: "guest" },
  // A MIÉNK — a látogató a (leendő) ügyfelünk, innen indulhat a mi fizetési utunk.
  { label: "saját landing /", path: "/", method: "GET", audience: "own" },
  { label: "saját jogi lap /adatvedelem", path: "/adatvedelem", method: "GET", audience: "own" },
  { label: "saját belépés /login", path: "/login", method: "GET", audience: "own" },
  // ⭐ A tulaj (a mi ÜGYFELÜNK) egy-kattintásos döntés-lapja a levélből: a HATÁR
  // MÁSIK OLDALA. Ha ez is „vendég" lenne, túlkorrigáltunk volna.
  {
    label: "tulaj döntés-lapja /foglalas/<token>/elfogadom",
    path: `/foglalas/${DEAD_CANCEL_TOKEN}/elfogadom`,
    method: "GET",
    audience: "own",
  },
];
if (liveSite?.slug) {
  scopeCases.push({
    label: `tenant vendég-oldal HOST (${liveSite.slug}.${PLATFORM_DOMAIN})`,
    path: "/",
    method: "GET",
    host: `${liveSite.slug}.${PLATFORM_DOMAIN}`,
    audience: "guest",
  });
  scopeCases.push({
    label: `tenant vendég-oldal DEV (/t/${liveSite.slug})`,
    path: `/t/${liveSite.slug}`,
    method: "GET",
    audience: "guest",
  });
}
if (previewSite?.preview_token) {
  scopeCases.push({
    label: "tenant vendég-oldal ELŐNÉZET (/site/<token>)",
    path: `/site/${previewSite.preview_token}`,
    method: "GET",
    audience: "guest",
  });
} else {
  console.log("  ⚠️  KIMARAD: nincs `preview_token` a parkban — a /site/<token> ág nem mérhető.");
}

// ⚠️ A `/m/<token>` mock-előnézet mérhetőségét KIMONDJUK. Fixture-t NEM gyártunk hozzá:
// a dev-park KÖZÖS, és egy őr, ami minden commitnál sorokat ír bele, más szálak
// méréseit billenti meg.
const mockReady = await db
  .selectFrom("mock_request")
  .innerJoin("mock_artifact", "mock_artifact.id", "mock_request.artifact_id")
  .select(["mock_request.token as token"])
  .where("mock_artifact.path", "is not", null)
  .executeTakeFirst();
if (mockReady?.token) {
  scopeCases.push({
    label: "mock-előnézet (/m/<token>) — hideg megkeresés címzettjének",
    path: `/m/${mockReady.token}`,
    method: "GET",
    audience: "guest",
  });
} else {
  console.log(
    "  ⚠️  KIMARAD: nincs artefaktumos `mock_request` a parkban — a /m/<token> ág nem mérhető\n" +
      "      (kézzel, önmagát takarító fixture-rel MÉRVE 2026-09-14: javítás előtt SÁV+PIXEL, utána tiszta).",
  );
}

// ── A KONZOL PROCESSZ ESETEI ─────────────────────────────────────────────────
// Élesben MÉRVE (2026-09-15, citoviso.com): a `/pay/…` és a `/configure/…` az
// nginxen a konzolra megy, és ott SEM sáv, SEM Pixel nem volt — a vevő fizetési
// útja tehát a csalásmegelőző jelzés nélkül futott, miközben a saját kódunk
// kommentje szerint a Pixelnek a webshop MINDEN oldalán ott kell lennie.
scopeCases.push(
  { label: "KONZOL jogi /aszf (a pénztárból nyílik)", path: "/aszf", method: "GET", port: CONSOLE_PORT, audience: "own" },
  { label: "KONZOL jogi /privacy (a kiküldött levelek linkje)", path: "/privacy", method: "GET", port: CONSOLE_PORT, audience: "own" },
  { label: "KONZOL /pay/mock/<ref> (fizetés-lap)", path: "/pay/mock/mock_00000000-0000-0000-0000-000000000000", method: "GET", port: CONSOLE_PORT, audience: "own" },
  { label: "KONZOL /admin/<token> (a tenant önkiszolgáló lapja)", path: `/admin/${DEAD_CANCEL_TOKEN}`, method: "GET", port: CONSOLE_PORT, audience: "own" },
  // ⚠️ MEGFORDÍTVA 2026-09-16 (ADR-0186): az ajánlat + konfigurátor a MI lapunk.
  // Ez a két sor korábban `guest`-et várt, az ADR-0151 útvonal-listája szerint. A
  // Full Barion Pixel viszont a kosár- és pénztár-eseményeket kéri, és azok KIZÁRÓLAG
  // ezen a lapon történnek (a `/pay/…` már csak az eredményt látja) — vagyis az
  // ADR-0151 SAJÁT kritériuma („ahol a mi fizetési utunk futhat") erre a lapra eddig
  // is igaz volt. A viselkedést előbb igazoltuk (`barion-pixel-check`: 15 zöld
  // állítás valódi böngészőben), és CSAK utána írtuk át ezt a várakozást.
  { label: "KONZOL /p/<token> (ajánlat + konfigurátor — INNEN indul a vásárlás)", path: `/p/${DEAD_CANCEL_TOKEN}`, method: "GET", port: CONSOLE_PORT, audience: "own" },
  { label: "KONZOL /configure/<id> (ugyanaz, követés nélküli ikerúton)", path: "/configure/00000000-0000-0000-0000-000000000000", method: "GET", port: CONSOLE_PORT, audience: "own" },
  // ⛔ A vendég-lapok VÁLTOZATLANUL tiszták — a határ nem tűnt el, csak arrébb ment.
  { label: "KONZOL /site/<token> (a szállás pillanatképe)", path: `/site/${DEAD_CANCEL_TOKEN}`, method: "GET", port: CONSOLE_PORT, audience: "guest" },
  // A BELSŐ felület — szintén tiszta, de más okból.
  { label: "KONZOL operátor-belépés /login", path: "/login", method: "GET", port: CONSOLE_PORT, audience: "operator" },
);
if (paidRef?.gateway_ref) {
  scopeCases.push({
    label: "KONZOL /pay/done (a Barion RedirectUrl — VALÓDI, kifizetett rendelés)",
    path: `/pay/done?paymentId=${encodeURIComponent(paidRef.gateway_ref)}`,
    method: "GET",
    port: CONSOLE_PORT,
    audience: "own",
  });
} else {
  console.log(
    "  ⚠️  KIMARAD: nincs `paid` fizetés a parkban — a /pay/done VALÓDI lapja nem mérhető\n" +
      "      (a 404-es ága fent akkor is mérve van; fixture-t nem gyártunk, a park KÖZÖS).",
  );
}

for (const c of scopeCases) {
  let body = await raw(c.path, c.method, c.host, c.port);
  if (SELF_TEST && c.audience !== "own") {
    // RONTÁS ③: a vendég-lap válaszába BEHAMISÍTJUK a sáv+Pixel sorát — ha az
    // állítás ettől nem megy pirosra, a mérés nem néz oda, ahová mondja.
    body += `<script src="/assets/runtime/cit-consent.js"></script><img src="https://pixel.barion.com/a.gif">`;
  }
  const hasLoader = /cit-consent\.js/.test(body);
  const hasCss = /cit-consent\.css/.test(body);
  const hasPixel = /pixel\.barion\.com/.test(body);
  const tag = `${c.method} ${c.label}`;
  if (!check(body.length > 0, `${tag}: a lap egyáltalán válaszol`, "üres válasz — a mérés nem ér semmit")) continue;
  if (c.audience !== "own") {
    const who = c.audience === "operator" ? "BELSŐ felület" : "VENDÉG lapja";
    check(!hasLoader, `⭐ ${tag}: a ${who} nem kap hozzájárulás-kezelőt`);
    check(!hasCss, `⭐ ${tag}: a ${who} a sáv stíluslapját sem kapja meg`);
    check(!hasPixel, `⭐⭐ ${tag}: a ${who} NEM kap Barion Pixelt`);
  } else {
    check(hasLoader, `${tag}: a SAJÁT lapunk megkapja a sávot (pozitív kontroll)`);
    check(hasPixel, `${tag}: a SAJÁT lapunk megkapja a Pixelt (pozitív kontroll)`);
  }
  // ⭐ A KETTŐ EGYÜTT MOZOG. „Vegyük ki a sávot, de hagyjuk a Pixelt" jogszerűtlen
  // volna (ADR-0145 ③) — szerkezetileg ugyanabból az egy snippetből jönnek, és ez
  // az állítás őrzi, hogy az is maradjon.
  check(
    hasLoader === hasPixel,
    `${tag}: a sáv és a Pixel EGYÜTT mozog`,
    `sáv=${hasLoader} · pixel=${hasPixel}`,
  );
}

// ── ⭐⭐ EGY DOKUMENTUM = EGY VISELKEDÉS, AKÁRMELYIK PROCESSZ ADJA KI ──────────
// MÉRVE élesben (2026-09-15): a `citoviso.com/adatvedelem` sávval+Pixellel jött a
// public szerverről, a `citoviso.com/privacy` (ugyanaz a `privacyPage()`, csak a
// konzolról) pedig TISZTÁN — és épp a `/privacy` az a cím, amit a MÁR KIKÜLDÖTT
// hideg levelek tartalmaznak. Egy szabály két példányban két igazság; ez a sor
// azt őrzi, hogy a jövőben se hasadjon szét.
console.log("\n── ⭐⭐ Ugyanaz a jogi dokumentum mindkét processzen ────────────────");
for (const doc of ["/adatvedelem", "/aszf", "/impresszum"]) {
  const pub = await raw(doc, "GET", PLATFORM_DOMAIN, PORT);
  // RONTÁS ④: a konzol válaszából KIVESSZÜK a sávot — pontosan az az állapot, amit
  // élesben mértünk (/adatvedelem sávval, /privacy anélkül). Ha az egyezés-állítás
  // ettől nem megy pirosra, akkor nem a két processzt hasonlítja össze.
  const con = (await raw(doc, "GET", PLATFORM_DOMAIN, CONSOLE_PORT)).replace(
    SELF_TEST ? /cit-consent\.js|pixel\.barion\.com/g : /(?!)/g,
    "",
  );
  const pubBar = /cit-consent\.js/.test(pub) && /pixel\.barion\.com/.test(pub);
  const conBar = /cit-consent\.js/.test(con) && /pixel\.barion\.com/.test(con);
  check(pub.length > 0 && con.length > 0, `${doc}: mindkét processz kiszolgálja`);
  check(
    pubBar === conBar,
    `⭐ ${doc}: UGYANÚGY viselkedik mindkét processzen`,
    `public=${pubBar ? "sáv+Pixel" : "tiszta"} · konzol=${conBar ? "sáv+Pixel" : "tiszta"}`,
  );
}

// ── ⛔ A SÁV SAJÁT ESZKÖZEI — a lapot kiszolgáló processzTŐL ───────────────────
// A konzol MÉRTEN 303-at (login-redirect) adott a `/assets/runtime/*`-ra, tehát a
// fizetés-lapra kitett sáv CSUPASZ lett volna és a Pixel el sem indult volna.
// Élesben az nginx a `/assets/`-et a public szerverre viszi, tehát a hiba ott nem
// látszott volna — de a lapot kiszolgáló processz szolgálja ki azt is, ami nélkül
// a lap hazudik magáról. Egy proxy-sor nem lehet a jogi megfelelés egyetlen lába.
console.log("\n── ⛔ A sáv eszközei a KONZOLRÓL is elérhetők ─────────────────────");
for (const asset of ["/assets/runtime/cit-consent.css", "/assets/runtime/cit-consent.js"]) {
  // RONTÁS ⑤: úgy teszünk, mintha a konzol login-lapra terelné az eszközt — ez volt
  // a MÉRT kiindulási állapot (303), és emellett a sáv csupaszon jelent volna meg.
  const body = SELF_TEST
    ? "<html><head><title>Belépés</title></head><body>login</body></html>"
    : await raw(asset, "GET", PLATFORM_DOMAIN, CONSOLE_PORT);
  check(
    body.length > 500 && !/<title>/i.test(body),
    `⭐ ${asset}: a konzol MAGA szolgálja ki (nem login-redirect)`,
    `${body.length} bájt`,
  );
}

server.close();
consoleServer.close();
await db.destroy();

console.log("");
if (SELF_TEST) {
  // Az önteszt akkor sikeres, ha a rontásokat TÉNYLEG elkapta.
  const wantedReds = [
    /háttere a --citui-navy-950/,
    /NEM natív böngésző-gomb/,
    /lekerekített/,
    /NINCS süti-sáv/,
    // RONTÁS ③ — a címzett-hatókör mindkét vendég-lapján, GET-en ÉS POST-on.
    /GET vendég lemondó — megerősítés \(GET\): a VENDÉG lapja NEM kap Barion Pixelt/,
    /POST vendég lemondó — eredmény \(POST\): a VENDÉG lapja NEM kap Barion Pixelt/,
    // ⑤ A MÁSIK PROCESSZ — a konzol vendég- és operátor-lapjai, a két processz
    // egyezése, és a sáv saját eszközeinek kiszolgálása (ADR-0172).
    /KONZOL \/p\/<token>.*NEM kap Barion Pixelt/,
    /KONZOL \/configure\/<id>.*NEM kap Barion Pixelt/,
    /konzol operátor-belépés \/login.*NINCS süti-sáv/,
    /\/adatvedelem: UGYANÚGY viselkedik mindkét processzen/,
    /cit-consent\.css: a konzol MAGA szolgálja ki/,
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
