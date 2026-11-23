/*
 * The public marketing homepage (public/index.html) rendered with its live parts:
 * the package cards and prices from the LIVE pricing source, and the brand lockups.
 * Approved design: assets/design-refs/public-site/landing/ ("C · Szem", 2026-11-07).
 * Kept apart from the server module so it can be rendered (and tested) on its own.
 */
import type http from "node:http";
import { esc } from "../console/views.js";
import { DEFAULT_MULTILANG_TIER } from "../modules.js";
import { getDisabledModules } from "../moduleSales.js";
import { offeredPackagesFrom, type OfferedPackage } from "../packageOffer.js";
import { isTier, tierHasDomain, type PackageAssignment } from "../packages.js";
import {
  formatPrice,
  getAnnualFreeMonths,
  getMultilangTierPrice,
  getPackageAssignment,
  loadPricing,
  pricingSnapshot,
  HU_PRICING_REGION,
  pricingRegions,
  primaryTld,
  regionPriceGaps,
} from "../pricing.js";
import { lockup } from "../ui/brand.js";
import { jsonForScript } from "../text/jsonForScript.js";
import { babelSeed, packForClient, selectPlural } from "../i18n/packs.js";

/** One line of a homepage package card: shown when the tier's modules carry it. */
interface HomeFeature {
  readonly text: string;
  readonly has: (mods: ReadonlySet<string>, tierHasDomainNow: boolean) => boolean;
}

/** The package-card lines, in display order. Each is bound to the modules (or the domain
 *  pseudo-module) that make it TRUE, so a card can never list what its tier does not carry. */
const HOME_FEATURES: readonly HomeFeature[] = [
  { text: "Személyre szabott honlap, mobilra kész", has: () => true },
  { text: "Galéria, térkép, ajánlatkérő űrlap", has: (m) => m.has("gallery") && m.has("location") && m.has("enquiry") },
  { text: "Saját .hu domain", has: (_m, d) => d },
  { text: "Beküldés a Google-nek", has: () => true },
  { text: "Szobák és felszereltség", has: (m) => m.has("rooms") && m.has("amenities") },
  { text: "Vendégvélemények", has: (m) => m.has("reviews") },
  { text: "„Miért nálunk” szakasz", has: (m) => m.has("usp") },
  { text: "Online foglalás, portál-naptár szinkronnal", has: (m) => m.has("booking") },
  { text: "Szezonális árak, nyitvatartás", has: (m) => m.has("pricing") && m.has("hours") },
  { text: "Programajánló a környékről", has: (m) => m.has("poi") },
];

/** „Minden, ami az Alapban” — the lead line of the next tier up. */
const HOME_TIER_IN: Record<string, string> = { alap: "az Alapban", ajanlott: "az Ajánlottban" };

const HOME_TICK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';

/**
 * The homepage package cards from the LIVE offer (the same packages and monthly list
 * prices as the configurator: offeredPackagesFrom), cheapest first. Both the monthly and
 * the yearly price are rendered; the page's toggle only switches between them.
 * Yearly = monthly × (12 − free months).
 */
export function homepagePlansHtml(
  pkgs: readonly OfferedPackage[],
  freeMonths: number,
  currency: string,
  assignment: PackageAssignment,
  /** ADR-0452: the region's own domain ending (country row → pricing region TLD list); the
   *  card says "Saját .cz domain" for a Czech list. Absent = the file's ".hu". */
  tld?: string | null,
  /** The page language (homepageLang): only the yearly "havonta … helyett …" line is a
   *  template; every other card text is translated by the page's text pass. */
  lang: string = "hu",
): string {
  const tiers = [...pkgs].filter((p) => Number.isFinite(p.monthly) && p.monthly > 0).sort((x, y) => x.monthly - y.monthly);
  if (!tiers.length) return "";
  const yearMonths = Math.max(1, 12 - Math.max(0, freeMonths));
  const lines = (p: OfferedPackage): string[] => {
    const mods = new Set(p.modules);
    const dom = isTier(p.id) && tierHasDomain(assignment, p.id);
    return HOME_FEATURES.filter((f) => f.has(mods, dom)).map((f) => (tld ? withTld(f.text, tld) : f.text));
  };
  let prev: string[] = [];
  let prevId = "";
  const cards = tiers.map((p) => {
    const own = lines(p);
    const shown = prevId ? [`Minden, ami ${HOME_TIER_IN[prevId] ?? "az előző csomagban"}`, ...own.filter((t) => !prev.includes(t))] : own;
    prev = own;
    prevId = p.id;
    const year = p.monthly * yearMonths;
    const hot = p.id === "ajanlott";
    return (
      `<div class="plan${hot ? " hot" : ""} rv" data-tier="${esc(p.id)}">` +
      (hot ? `<span class="tag">Ezt ajánljuk</span>` : "") +
      `<h3>${esc(p.label)}</h3>` +
      `<div class="price"><span class="m">${formatPrice(p.monthly, currency)}<small> / hó</small></span>` +
      `<span class="y">${formatPrice(year, currency)}<small> / év</small></span></div>` +
      `<div class="yr"><span class="y">${T(lang, "havonta {a} helyett {b}", { a: formatPrice(p.monthly, currency), b: formatPrice(Math.round(year / 12), currency) })}</span></div>` +
      `<ul>${shown.map((t) => `<li>${HOME_TICK}${esc(t)}</li>`).join("")}</ul>` +
      `</div>`
    );
  });
  const top = tiers[tiers.length - 1]!;
  return `<div class="plans" data-full-year="${formatPrice(top.monthly * yearMonths, currency)}">${cards.join("")}</div>`;
}

// ── The page language (owner 2026-11-23, ADR-0473; overrides ADR-0452 for the homepage) ──────
// The homepage speaks the visitor's BROWSER language: the first Accept-Language entry the page
// is completely translated into, else English. Hungarian = today's page (Ft, .hu); every other
// language = the euro list (ADR-0465 layer, 7/13/18 €) and .com. No picker, no band, no URL
// scheme, no IP guess. Translations are Bábel's committed packs (src/i18n/babel/packs), read as
// the seed file itself, so a language is served exactly when its committed pack covers the page.

/** The euro price layer every non-Hungarian homepage shows (ADR-0465). */
const HOME_EURO_REGION = "hr";
/** The example night price the payback calculator starts from (euro). */
const HOME_PAY_NIGHT = 85;

/** og:locale per page language (ll_CC). */
const HOME_OG_LOCALE: Readonly<Record<string, string>> = {
  hu: "hu_HU", bg: "bg_BG", cs: "cs_CZ", da: "da_DK", de: "de_DE", el: "el_GR", en: "en_GB", es: "es_ES",
  et: "et_EE", fi: "fi_FI", fr: "fr_FR", ga: "ga_IE", hr: "hr_HR", it: "it_IT", lt: "lt_LT", lv: "lv_LV",
  mt: "mt_MT", nl: "nl_NL", pl: "pl_PL", pt: "pt_PT", ro: "ro_RO", sk: "sk_SK", sl: "sl_SI", sv: "sv_SE",
};

/** Strings the current completeness probe found untranslated (null = not probing). */
let homeMissing: Set<string> | null = null;

/** Raw pack value for `hu` in `l` (Bábel's committed seed); the source when missing. */
function homeLookup(l: string, hu: string): string {
  if (l === "hu") return hu;
  const v = babelSeed(l)[hu];
  if (typeof v === "string" && v.trim()) return v;
  homeMissing?.add(hu);
  return hu;
}

/** Page translation: a plural value picks its form by {n}; {vars} are filled after the lookup. */
function T(l: string, hu: string, vars?: Record<string, string | number>): string {
  let s = homeLookup(l, hu);
  if (!vars) return s;
  s = selectPlural(l, s, vars.n);
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** The page's own texts. `plain` are whole text nodes / attribute values of the rendered page
 *  (the non-Hungarian forms: ".com"); the named ones are placed structurally. */
function homeTexts(l: string, ml: { n: number; p: string }) {
  return {
    h1: T(l, "Előbb megmutatjuk.<br><em>Aztán döntesz.</em>"),
    lede: T(l, "Elkészítjük a szállásod modern, mobilra kész honlapját a nyilvános adataiból — mielőtt bármit fizetnél. Utána 14 napig élesben, ingyen kipróbálod, bankkártya nélkül."),
    // The example lodging is in Hungary, and the sentence says so (fact-true abroad).
    pelda: T(l, "Egy magyarországi szállás, a Duna Vibe House ezen az oldalon fogad vendéget: <b>{domain}</b>. A te mintád ugyanígy a saját szállásod adataiból készül.", { domain: "dunavibehouse.hu" }),
    // Calendar sync abroad: the portals that exist there (no Szállás.hu).
    naptar: T(l, "Kétirányú szinkron a Booking.com és az Airbnb naptárával (Teljes csomag)."),
    faq: T(l, "Fent vagyok a Bookingon és az Airbnb-n. Maradhatok?"),
    // The Hungarian commission claim's source is Hungarian; abroad a payback calculator instead.
    pay: T(l, "Megtérülés"),
    payH2: T(l, "Hány közvetlen éjszaka fizeti ki?"),
    paySub: T(l, "Írd be a saját átlagos éjszakai árad és a portálod jutalékát. A számoló megmutatja, hány közvetlen foglalás után nyersz a saját oldaladdal."),
    payNight: T(l, "Átlagos ár / éjszaka"),
    payPct: T(l, "A portálod jutaléka (%)"),
    payFine: T(l, "A számoló a te számaiddal dolgozik, nem ígéret: hogy hány vendég foglal közvetlenül, az nem rajtunk múlik."),
    ml: T(l, "Több nyelv egyszeri díjjal kérhető ({n} nyelv {p}-tól).", ml),
    // ADR-0103: the domain is registered and held by Citoviso.
    domainNote: T(l, "A domaint a rendelés után a Citoviso regisztrálja és kezeli, neked nincs vele teendőd. A próba alatt az oldal a citoviso.com alatt fut."),
    copy: T(l, "© {year} Citoviso. Minden jog fenntartva.", { year: '<span id="year">' + new Date().getFullYear() + "</span>" }),
    plain: [
    T(l, "Citoviso – Honlap szálláshelyeknek: előbb megmutatjuk, aztán döntesz"),
    T(l, "Citoviso – modern honlap szálláshelyeknek. Előbb elkészítjük és megmutatjuk a szállásod honlapját, utána 14 napig ingyen kipróbálod, bankkártya nélkül."),
    T(l, "Citoviso – Előbb megmutatjuk. Aztán döntesz."),
    T(l, "Modern, mobilra kész honlap a szállásodnak a nyilvános adataiból. 14 nap ingyen, bankkártya nélkül."),
    T(l, "Példa"),
    T(l, "Hogyan működik"),
    T(l, "Árak"),
    T(l, "GYIK"),
    T(l, "Belépés"),
    T(l, "Kérem a mintát"),
    T(l, "Honlap szálláshelyeknek"),
    T(l, "Bankkártya nélkül"),
    T(l, "Saját .com domain a csomagban"),
    T(l, "GÖRGESS"),
    T(l, "Nem ígéret — kész oldal"),
    T(l, "Így néz ki egy szállás, amit mi építettünk."),
    T(l, "Telefonon is első osztályú"),
    T(l, "A vendég telefonról is végignézi a szobákat, és egy gombbal megkeres."),
    T(l, "Saját .com domain"),
    T(l, "A csomag része. A rendelés után a Citoviso regisztrálja és kezeli, neked nincs vele teendőd."),
    T(l, "Bent van a Google-nél"),
    T(l, "Az oldalt beküldjük a Google-nek, a szerkezete keresőbarát. Helyezést senki nem ígérhet — mi sem."),
    T(l, "Foglalási naptár, dupla foglalás nélkül"),
    T(l, "Te szerkeszted"),
    T(l, "Képek, szövegek, szobák, árak, szezonok, zárt napok — egy egyszerű felületen, amikor akarod."),
    T(l, "Nincs projekt. Nincs megbeszélés."),
    T(l, "Nem kell briefet írnod, képeket gyűjtened vagy egyeztetned. Megnézed a kész oldalt, és eldöntöd."),
    T(l, "Megkapod a mintát"),
    T(l, "A szállásod nyilvános adataiból és képeiből elkészítjük a személyre szabott honlapot. Ha még nem kaptál tőlünk, kérd lent."),
    T(l, "Egy kattintás, és az oldal élőben fut. Bankkártya nem kell, semmire nem kötelez."),
    T(l, "Maradsz, ha megéri"),
    T(l, "Választasz csomagot, és az oldal a saját .com domainedre költözik. Havonta vagy évente fizetsz."),
    T(l, "Alap"),
    T(l, "Ajánlott"),
    T(l, "Teljes"),
    T(l, "Havonta kevesebb, mint egy vendégéjszaka."),
    T(l, "Minden csomaghoz jár a saját .com domain és a 14 napos ingyenes próba."),
    T(l, "Havonta"),
    T(l, "Évente — 2 hónap ingyen"),
    T(l, "/ hó"),
    T(l, "/ év"),
    T(l, "Személyre szabott honlap, mobilra kész"),
    T(l, "Galéria, térkép, ajánlatkérő űrlap"),
    T(l, "Beküldés a Google-nek"),
    T(l, "Ezt ajánljuk"),
    T(l, "Minden, ami az Alapban"),
    T(l, "Szobák és felszereltség"),
    T(l, "Vendégvélemények"),
    T(l, "„Miért nálunk” szakasz"),
    T(l, "Minden, ami az Ajánlottban"),
    T(l, "Online foglalás, portál-naptár szinkronnal"),
    T(l, "Szezonális árak, nyitvatartás"),
    T(l, "Programajánló a környékről"),
    T(l, "Amit kérdezni szoktak."),
    T(l, "Mibe kerül a minta?"),
    T(l, "Semmibe. A minta és a 14 napos próba is ingyenes, bankkártyát nem kérünk."),
    T(l, "Honnan vannak a képek és a szövegek?"),
    T(l, "A szállásod nyilvános adataiból: a Google-ön és a szállásportálokon közzétett leírásból és fotókból. Bármikor lecserélheted őket a sajátjaidra."),
    T(l, "Kell hozzá technikai tudás?"),
    T(l, "Nem. A képeket, szövegeket, szobákat, árakat és a naptárat egy egyszerű felületen állítod be."),
    T(l, "Igen. A Teljes csomag foglalási naptára szinkronban van a portálok naptárával, így nem lesz dupla foglalás."),
    T(l, "Mi történik a próba végén?"),
    T(l, "Ha nem rendelsz, nem fizetsz semmit — kártyát sem adtál meg, nincs mit terhelni. Ha rendelsz, a választott csomag díját fizeted."),
    T(l, "Csak szálláshelyeknek szól?"),
    T(l, "Ma igen. A rendszer a szálláshelyek igényeire készült: szobák, szezonális árak, foglalási naptár."),
    T(l, "Ingyenes minta"),
    T(l, "Nézd meg a saját szállásodat."),
    T(l, "Add meg a szállás nevét, tedd le a tűt a térképen, és e-mailben elküldjük a kész minta linkjét."),
    T(l, "Szálláshely neve *"),
    T(l, "Írd be a szállás nevét."),
    T(l, "Hol van? Keress rá, vagy kattints a pontos helyre *"),
    T(l, "Még nincs kiválasztva hely."),
    T(l, "Tedd le a tűt a szállásodra."),
    T(l, "E-mail-cím *"),
    T(l, "Ez nem tűnik e-mail-címnek."),
    T(l, "Az adataidat csak a minta elkészítéséhez és elküldéséhez használjuk."),
    T(l, "Adatkezelési tájékoztató"),
    T(l, "Modern honlap szálláshelyeknek — előbb megmutatjuk, aztán döntesz."),
    T(l, "Oldal"),
    T(l, "Kapcsolat"),
    T(l, "Jogi"),
    T(l, "Impresszum"),
    T(l, "ÁSZF"),
    T(l, "Elállási tájékoztató"),
    T(l, "Fő navigáció"),
    T(l, "Menü"),
    T(l, "A Duna Vibe House honlapja asztali gépen"),
    T(l, "Ugyanaz az oldal telefonon"),
    T(l, "Fizetés gyakorisága"),
    T(l, "pl. Napsugár Vendégház"),
    T(l, "Település vagy cím, majd Enter"),
    T(l, "nev@pelda.hu"),
    T(l, "Elfogadott fizetési módok: Barion, Mastercard, VISA, Apple Pay, Google Pay"),
    T(l, "14 nap ingyen"),
    T(l, "14 napig élesben próbálod"),
    T(l, "Térkép a szállás helyének kiválasztásához"),
    ],
  };
}

/** The strings home.js shows at runtime (its tr()/trn() keys), raw (plural values intact). */
function homeClientTexts(l: string): string[] {
  const tr = (hu: string): string => homeLookup(l, hu);
  return [
    tr("Hely rögzítve: {town}. Ha nem pontos, kattints máshova."),
    tr("Hely rögzítve. Ha nem pontos, kattints máshova."),
    tr("Nem találtam ilyen helyet. Írd pontosabban, vagy kattints a térképre."),
    tr("Küldés…"),
    tr("Nem sikerült elküldeni. Kérlek, próbáld újra egy perc múlva."),
    tr("<b>Megkaptuk: „{name}”.</b><br>Elkészítjük a mintát, és a linkjét elküldjük ide: <b>{email}</b>."),
    tr("A csomag évente:"),
    tr("jutalék éjszakánként:"),
    tr("{n} közvetlen éjszaka / év"),
    tr("Ennyi közvetlen foglalás után a saját oldalad olcsóbb, mint a portál jutaléka."),
    tr("Írj be egy éjszakai árat, pl. 85."),
    tr("A jutalék 1 és 50% között legyen."),
  ];
}

const homeComplete = new Map<string, boolean>();
/** Is the homepage completely translated into `l` (every page, card and runtime string)? */
export function homepageLangComplete(l: string): boolean {
  if (l === "hu") return true;
  if (!/^[a-z]{2,3}$/.test(l)) return false;
  let ok = homeComplete.get(l);
  if (ok === undefined) {
    homeMissing = new Set();
    try {
      homeTexts(l, { n: 3, p: "1" });
      homeClientTexts(l);
      // the card template (the card lines themselves are in `plain`)
      T(l, "havonta {a} helyett {b}", { a: "1", b: "1" });
      ok = homeMissing.size === 0;
    } finally {
      homeMissing = null;
    }
    homeComplete.set(l, ok);
  }
  return ok;
}

/** The page language for an Accept-Language header: q order, first complete one; else "en". */
export function homepageLang(acceptLanguage: string | string[] | undefined): string {
  const raw = Array.isArray(acceptLanguage) ? acceptLanguage.join(",") : acceptLanguage ?? "";
  const tags = raw
    .split(",")
    .map((part, i) => {
      const [tag, ...params] = part.trim().split(";");
      const qp = params.map((x) => x.trim()).find((x) => x.startsWith("q="));
      const q = qp ? Number(qp.slice(2)) : 1;
      return { l: (tag ?? "").trim().toLowerCase().split("-")[0] ?? "", q: Number.isFinite(q) ? q : 0, i };
    })
    .filter((t) => t.l && t.l !== "*" && t.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i);
  for (const t of tags) if (homepageLangComplete(t.l)) return t.l;
  return "en";
}

/** Whole text nodes and translatable attribute values → their translation (exact match). */
function translateTextNodes(html: string, dict: ReadonlyMap<string, string>): string {
  const swap = (v: string): string => {
    const k = v.trim();
    const t = k ? dict.get(k) : undefined;
    return t === undefined ? v : v.replace(k, () => t);
  };
  return html
    .replace(/>([^<>]+)</g, (_m, text: string) => `>${swap(text)}<`)
    .replace(/\b(content|alt|aria-label|placeholder)="([^"]*)"/g, (_m, a: string, v: string) => `${a}="${swap(v)}"`);
}

/**
 * Render the marketing homepage with its prices bound to the LIVE pricing source (§C-gated),
 * in the visitor's browser language (homepageLang). public/index.html carries markers we fill
 * server-side: <!--CIT_PRICE_BLOCK--> (the package cards, homepagePlansHtml) and
 * <!--CIT_ML_PRICE--> (the one-time multilingual from-price). If the region's price is NOT
 * owner-confirmed, no number is shown at all — a "custom offer" fallback instead (Fttv./§C).
 * Hungarian: today's page byte for byte. `?region=` stays an operator price preview.
 */
export async function renderHomepage(
  html: string,
  headers: http.IncomingHttpHeaders,
  regionOverride: string | null,
): Promise<string> {
  await loadPricing();
  const lang = homepageLang(headers["accept-language"]);
  const foreign = lang !== "hu";
  const defaultRegion = foreign ? HOME_EURO_REGION : HU_PRICING_REGION;
  const region = regionOverride && pricingRegions().some((r) => r.region === regionOverride.toLowerCase())
    ? regionOverride.toLowerCase()
    : defaultRegion;
  // The domain ending is the region's own (its TLD list on /pricing), not a literal.
  const tld = primaryTld(region)?.tld ?? null;
  const snap = pricingSnapshot(region);
  let plans = "";
  let ml = "";
  let mlArgs: { n: number; p: string } | null = null;
  let offered: OfferedPackage[] = [];
  // ADR-0443: an incomplete region shows NO price (the "custom offer" block), never a guess.
  if (snap.pricingConfirmed && regionPriceGaps(region).length === 0) {
    offered = offeredPackagesFrom(await getDisabledModules(), region);
    plans = homepagePlansHtml(offered, getAnnualFreeMonths(region), snap.currency, getPackageAssignment(), tld, lang);
    const mlPrice = getMultilangTierPrice(DEFAULT_MULTILANG_TIER, region);
    if (mlPrice > 0 && DEFAULT_MULTILANG_TIER.cap) {
      mlArgs = { n: DEFAULT_MULTILANG_TIER.cap, p: formatPrice(mlPrice, snap.currency) };
      ml = ` (${DEFAULT_MULTILANG_TIER.cap} nyelv ${formatPrice(mlPrice, snap.currency)}-tól)`;
    }
  }
  // No confirmed price (or no valid package): the file's static "custom offer" block stays.
  let rendered = plans
    ? html.replace(/<!--CIT_PRICE_BLOCK-->[\s\S]*?<!--\/CIT_PRICE_BLOCK-->/, () => `<!--CIT_PRICE_BLOCK-->${plans}<!--/CIT_PRICE_BLOCK-->`)
    : html;
  rendered = rendered.replace(/<!--CIT_ML_PRICE-->[\s\S]*?<!--\/CIT_ML_PRICE-->/, () => ml);
  if (!plans) rendered = rendered.replace(/<div class="toggle"[\s\S]*?<\/div>/, "");
  // The page's own ".hu domain" sentences follow the region's ending (identical for HU).
  if (tld) rendered = withTld(rendered, tld);
  const free = getAnnualFreeMonths(region);
  rendered = rendered.replace("Évente — 2 hónap ingyen", free > 0 ? `Évente — ${free} hónap ingyen` : "Évente");
  if (foreign) rendered = await foreignHomepage(rendered, lang, mlArgs, offered, free, snap.currency);
  // The header follows the stage (dark over the intro, light after it): the themed
  // lockup (brand-slot flips data-citui-theme). The footer is dark. One brand source
  // (ADR-0236); the file only carries a plain-text fallback.
  let brandN = 0;
  rendered = rendered.replace(/<!--CIT_BRAND-->[\s\S]*?<!--\/CIT_BRAND-->/g, () =>
    brandN++ === 0
      ? lockup({ on: "themed", href: "#top" })
      : lockup({ on: "dark", href: "#top" }),
  );
  return rendered;
}

/** The non-Hungarian page: today's layout and motion, the language's texts, the payback
 *  calculator, the world map and the language's legal pages (mock c2, 2026-11-23). */
async function foreignHomepage(
  page: string,
  lang: string,
  mlArgs: { n: number; p: string } | null,
  offered: readonly OfferedPackage[],
  freeMonths: number,
  currency: string,
): Promise<string> {
  const tx = homeTexts(lang, mlArgs ?? { n: 3, p: "" });
  const src = homeTexts("hu", mlArgs ?? { n: 3, p: "" });
  const dict = new Map<string, string>();
  src.plain.forEach((hu, i) => dict.set(hu, tx.plain[i]!));
  const block = (re: RegExp, inner: string) => (s: string) => s.replace(re, (_m, a: string, b: string) => a + inner + b);
  const steps: ((s: string) => string)[] = [
    (s) => s.replace('<html lang="hu">', `<html lang="${lang}">`),
    (s) => s.replace(/(<meta property="og:locale" content=")[^"]*(")/, (_m, a: string, b: string) => a + (HOME_OG_LOCALE[lang] ?? lang) + b),
    block(/(<h1>)[\s\S]*?(<\/h1>)/, tx.h1),
    block(/(<p class="lede">)[\s\S]*?(<\/p>)/, tx.lede),
    block(/(<h2 id="pelda">[\s\S]*?<p class="sub">)[\s\S]*?(<\/p>)/, tx.pelda),
    block(/(<\/b><span>)[^<]*Booking\.com[^<]*(<\/span>)/, tx.naptar),
    block(/(<summary>)[^<]*Bookingon[^<]*(<\/summary>)/, tx.faq),
    (s) => s.replace(/(<a href="#jutalek">)[^<]*(<\/a>)/g, (_m, a: string, b: string) => a + tx.pay + b),
    (s) => s.replace(/<section class="s band" id="jutalek">[\s\S]*?<\/section>/, () => paybackSection(lang, tx, offered, freeMonths, currency)),
    block(/(<!--\/CIT_PRICE_BLOCK-->\s*<p class="fine rv">)[\s\S]*?(<\/p>)/, mlArgs ? `${tx.ml} ${tx.domainNote}` : tx.domainNote),
    block(/(<div class="wrap foot-bottom">)[\s\S]*?(<\/div>)/, tx.copy),
  ];
  let out = steps.reduce((s, f) => f(s), page);
  out = translateTextNodes(out, dict);
  // Legal pages in the page's language where that country pack is complete; else today's link.
  const { legalCountryForLang } = await import("../legalPack.js");
  const { countryLegalPack } = await import("../legalPackCountry.js");
  const cc = legalCountryForLang(lang);
  if (cc && (await countryLegalPack(cc))) {
    out = out.replace(/href="\/(impresszum|aszf|adatvedelem|elallas)"/g, (_m, p: string) => `href="/${p}?l=${lang}"`);
  }
  // home.js reads its runtime strings and the page language from here.
  const client: Record<string, string> = {};
  const huClient = homeClientTexts("hu");
  homeClientTexts(lang).forEach((t, i) => (client[huClient[i]!] = t));
  out = out.replace(
    '<script src="/assets/home/home.js" defer></script>',
    () => `<script>window.CIT_HOME=${jsonForScript({ lang, s: client })};</script>\n  <script src="/assets/home/home.js" defer></script>`,
  );
  return out;
}

/** The payback calculator card (non-Hungarian page): how many direct nights pay for a package. */
function paybackSection(
  lang: string,
  tx: ReturnType<typeof homeTexts>,
  offered: readonly OfferedPackage[],
  freeMonths: number,
  currency: string,
): string {
  const tiers = [...offered].filter((p) => Number.isFinite(p.monthly) && p.monthly > 0).sort((x, y) => x.monthly - y.monthly);
  const data = { months: Math.max(1, 12 - Math.max(0, freeMonths)), currency, lang, tiers: tiers.map((p) => ({ id: p.id, monthly: p.monthly })) };
  const hot = tiers.some((p) => p.id === "ajanlott") ? "ajanlott" : tiers[tiers.length - 1]?.id;
  const seg = tiers
    .map((p) => `<button type="button" data-pk="${esc(p.id)}" aria-pressed="${p.id === hot}">${esc(T(lang, p.label))}</button>`)
    .join("");
  return (
    `<section class="s band" id="jutalek">\n      <div class="wrap calc">\n        <div class="rv">\n` +
    `          <span class="eyebrow">${tx.pay}</span>\n          <h2>${tx.payH2}</h2>\n          <p class="sub">${tx.paySub}</p>\n        </div>\n` +
    `        <div class="calc-card rv" id="pay" data-pay="${esc(JSON.stringify(data))}">\n` +
    `          <div class="pay-two"><label><span>${tx.payNight}</span><input id="pay-night" inputmode="decimal" value="${HOME_PAY_NIGHT}"></label>` +
    `<label><span>${tx.payPct}</span><input id="pay-pct" inputmode="decimal" value="15"></label></div>\n` +
    `          <div class="pay-err" id="pay-err" role="alert" hidden></div>\n` +
    (tiers.length ? `          <div class="pay-seg" id="pay-pk">${seg}</div>\n` : "") +
    `          <div class="calc-out"><small id="pay-l1"></small><strong id="pay-out">—</strong><small id="pay-l2"></small></div>\n` +
    `        </div>\n      </div>\n      <div class="wrap"><p class="fine fine-dark">${tx.payFine}</p></div>\n    </section>`
  );
}

/** ".hu domain" → "<tld> domain" in a sentence (the file's wording is Hungarian; only the
 *  ending moves). A Hungarian region's ".hu" leaves the text byte-for-byte as it was. */
function withTld(text: string, tld: string): string {
  return tld === ".hu" ? text : text.replace(/(^|[\s>])\.hu(?=\s+domain)/g, `$1${tld}`);
}
