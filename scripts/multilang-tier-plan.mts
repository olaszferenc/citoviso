// TERV (nem kód) — a „Többnyelvű honlap" modul SÁVOS árazása 29 nyelvvel.
//
// Tulajdonosi döntések (2026-09-13, e session):
//   ① a választható kör 9 → 29 nyelv (EU 24 hivatalos + szerb, ukrán, orosz, török, norvég)
//   ② az ADR-0063 §2 „fix 3 nyelv" FELÜLÍRVA → három sáv:
//        ALAP      max  3 nyelv — 14 900 Ft
//        BŐVÍTETT  max  6 nyelv — 22 900 Ft
//        TELJES    mind 28      — 30 000 Ft
//   ③ a konzol-nyelv listája szétválik a site-nyelvek listájától
//
// A magyar az oldal elsődleges nyelve, ezért CÉLNYELVKÉNT nem választható → 28 cél.
//
// Ez a fájl a §2b terv-kapu VÁZLATÁT gyártja: három önhordó, KATTINTHATÓ HTML.
// A viselkedés a VALÓDI szabályt tükrözi (sáv-számítás, néma felminősítés tilalma),
// nem egy szebb hazugságot. Jóváhagyás után fagy be a design-refs/console/ alá.
//
//   npx tsx scripts/multilang-tier-plan.mts
//     → assets/design-refs/_drafts/multilang-tiers-{A,B,C}.html

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "assets/design-refs/_drafts");

/* ───────────────────────────── A SÁVOK (tulaj-döntés) ──────────────────────── */

const TIERS = [
  { id: "alap", name: "Alap", cap: 3, price: 14900 },
  { id: "bovitett", name: "Bővített", cap: 6, price: 22900 },
  { id: "teljes", name: "Teljes", cap: 28, price: 30000 },
] as const;

const huf = (n: number): string => `${n.toLocaleString("hu-HU")} Ft`;

/* ─────────────────────────── A 29 NYELV (28 célnyelv) ──────────────────────── */

interface Lang {
  readonly code: string;
  /** Magyar név — a tenant ezt olvassa az adminban. */
  readonly hu: string;
  /** Endonim — ezt látja a VENDÉG a nyelvváltón. */
  readonly endonym: string;
  readonly region: string;
  /** EU hivatalos nyelv-e (a „miért pont ezek" kérdésre a felület válaszol). */
  readonly eu: boolean;
}

const LANGS: readonly Lang[] = [
  // Szomszédok és a Kárpát-medence — a magyar szálláshelyek legnagyobb vendégköre.
  { code: "sk", hu: "szlovák", endonym: "Slovenčina", region: "Szomszédok", eu: true },
  { code: "ro", hu: "román", endonym: "Română", region: "Szomszédok", eu: true },
  { code: "hr", hu: "horvát", endonym: "Hrvatski", region: "Szomszédok", eu: true },
  { code: "sl", hu: "szlovén", endonym: "Slovenščina", region: "Szomszédok", eu: true },
  { code: "sr", hu: "szerb", endonym: "Srpski", region: "Szomszédok", eu: false },
  { code: "uk", hu: "ukrán", endonym: "Українська", region: "Szomszédok", eu: false },
  // Közép-Európa
  { code: "de", hu: "német", endonym: "Deutsch", region: "Közép-Európa", eu: true },
  { code: "pl", hu: "lengyel", endonym: "Polski", region: "Közép-Európa", eu: true },
  { code: "cs", hu: "cseh", endonym: "Čeština", region: "Közép-Európa", eu: true },
  // Nyugat-Európa
  { code: "en", hu: "angol", endonym: "English", region: "Nyugat-Európa", eu: true },
  { code: "fr", hu: "francia", endonym: "Français", region: "Nyugat-Európa", eu: true },
  { code: "nl", hu: "holland", endonym: "Nederlands", region: "Nyugat-Európa", eu: true },
  { code: "ga", hu: "ír", endonym: "Gaeilge", region: "Nyugat-Európa", eu: true },
  // Dél-Európa
  { code: "it", hu: "olasz", endonym: "Italiano", region: "Dél-Európa", eu: true },
  { code: "es", hu: "spanyol", endonym: "Español", region: "Dél-Európa", eu: true },
  { code: "pt", hu: "portugál", endonym: "Português", region: "Dél-Európa", eu: true },
  { code: "el", hu: "görög", endonym: "Ελληνικά", region: "Dél-Európa", eu: true },
  { code: "mt", hu: "máltai", endonym: "Malti", region: "Dél-Európa", eu: true },
  // Észak- és Kelet-Európa
  { code: "da", hu: "dán", endonym: "Dansk", region: "Észak-Európa", eu: true },
  { code: "sv", hu: "svéd", endonym: "Svenska", region: "Észak-Európa", eu: true },
  { code: "fi", hu: "finn", endonym: "Suomi", region: "Észak-Európa", eu: true },
  { code: "no", hu: "norvég", endonym: "Norsk", region: "Észak-Európa", eu: false },
  { code: "et", hu: "észt", endonym: "Eesti", region: "Észak-Európa", eu: true },
  { code: "lv", hu: "lett", endonym: "Latviešu", region: "Észak-Európa", eu: true },
  { code: "lt", hu: "litván", endonym: "Lietuvių", region: "Észak-Európa", eu: true },
  { code: "bg", hu: "bolgár", endonym: "Български", region: "Kelet-Európa", eu: true },
  { code: "ru", hu: "orosz", endonym: "Русский", region: "Kelet-Európa", eu: false },
  { code: "tr", hu: "török", endonym: "Türkçe", region: "Kelet-Európa", eu: false },
];

const REGIONS = [...new Set(LANGS.map((l) => l.region))];

/* ──────────────────────────────── ZÁSZLÓK ──────────────────────────────────────
 * Ugyanaz az egyszerűsítési elv, mint a src/ui/flags.ts-ben: 20×14 px-en a zászló
 * felismerési jel, nem címer. Sávok és az azonosságot vivő keresztek; semmi, ami
 * ezen a méreten sárrá mosódik. ⚠️ Ebből 19 ÚJ — ma a flags.ts 10-et ismer, és a
 * flagSvg() ismeretlen kódra ÜRES stringet ad, tehát nélkülük a vendég-oldali
 * nyelvváltón zászló nélküli, csupasz név állna.
 */
const h3 = (a: string, b: string, c: string): string =>
  `<rect width="20" height="4.67" fill="${a}"/><rect y="4.67" width="20" height="4.66" fill="${b}"/>` +
  `<rect y="9.33" width="20" height="4.67" fill="${c}"/>`;
const v3 = (a: string, b: string, c: string): string =>
  `<rect width="6.67" height="14" fill="${a}"/><rect x="6.67" width="6.66" height="14" fill="${b}"/>` +
  `<rect x="13.33" width="6.67" height="14" fill="${c}"/>`;
/** Skandináv kereszt (a függőleges szár balra tolva, ahogy a valódi zászlókon). */
const cross = (bg: string, fg: string): string =>
  `<rect width="20" height="14" fill="${bg}"/><rect x="5.6" width="2.6" height="14" fill="${fg}"/>` +
  `<rect y="5.7" width="20" height="2.6" fill="${fg}"/>`;

const FLAGS: Readonly<Record<string, string>> = {
  hu: h3("#ce2939", "#fff", "#477050"),
  de: h3("#000", "#dd0000", "#ffce00"),
  it: v3("#008c45", "#fff", "#cd212a"),
  pl: `<rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="7" fill="#dc143c"/>`,
  sk: h3("#fff", "#0b4ea2", "#ee1c25"),
  cs: `<rect width="20" height="7" fill="#fff"/><rect y="7" width="20" height="7" fill="#d7141a"/><path d="M0 0l9 7-9 7z" fill="#11457e"/>`,
  ro: v3("#002b7f", "#fcd116", "#ce1126"),
  hr: h3("#ff0000", "#fff", "#171796"),
  sl: h3("#fff", "#0000c6", "#d50000"),
  en: `<rect width="20" height="14" fill="#012169"/><path d="M0 5.2h20v3.6H0z" fill="#fff"/><path d="M8.2 0h3.6v14H8.2z" fill="#fff"/><path d="M0 6h20v2H0z" fill="#c8102e"/><path d="M9 0h2v14H9z" fill="#c8102e"/>`,
  // ── ÚJ (19) ──
  bg: h3("#fff", "#00966e", "#d62612"),
  da: cross("#c8102e", "#fff"),
  nl: h3("#ae1c28", "#fff", "#21468b"),
  et: h3("#0072ce", "#000", "#fff"),
  fi: cross("#fff", "#003580"),
  fr: v3("#002395", "#fff", "#ed2939"),
  // Görög: a 9 sáv ezen a méreten sár, ezért 4 fehér sáv + a kanton keresztje —
  // az azonosságot ez a kettő viszi.
  el:
    `<rect width="20" height="14" fill="#0d5eaf"/>` +
    `<rect y="1.56" width="20" height="1.56" fill="#fff"/><rect y="4.67" width="20" height="1.56" fill="#fff"/>` +
    `<rect y="7.78" width="20" height="1.56" fill="#fff"/><rect y="10.89" width="20" height="1.56" fill="#fff"/>` +
    `<rect width="7.78" height="7.78" fill="#0d5eaf"/>` +
    `<rect x="3.11" width="1.56" height="7.78" fill="#fff"/><rect y="3.11" width="7.78" height="1.56" fill="#fff"/>`,
  ga: v3("#169b62", "#fff", "#ff883e"),
  lv: `<rect width="20" height="14" fill="#9e3039"/><rect y="5.6" width="20" height="2.8" fill="#fff"/>`,
  lt: h3("#fdb913", "#006a44", "#c1272d"),
  mt: `<rect width="10" height="14" fill="#fff"/><rect x="10" width="10" height="14" fill="#cf142b"/>`,
  pt:
    `<rect width="8" height="14" fill="#006600"/><rect x="8" width="12" height="14" fill="#ff0000"/>` +
    `<circle cx="8" cy="7" r="2.5" fill="#ffcc00"/>`,
  es: `<rect width="20" height="14" fill="#aa151b"/><rect y="3.5" width="20" height="7" fill="#f1bf00"/>`,
  sv: cross("#006aa7", "#fecc00"),
  sr: h3("#c6363c", "#0c4076", "#fff"),
  uk: `<rect width="20" height="7" fill="#0057b7"/><rect y="7" width="20" height="7" fill="#ffd700"/>`,
  ru: h3("#fff", "#0039a6", "#d52b1e"),
  // Török: a félhold a hold-korong + eltolt piros korong különbsége; a csillag
  // ezen a méreten egy apró rombusz, ennél több csak folt lenne.
  tr:
    `<rect width="20" height="14" fill="#e30a17"/><circle cx="8" cy="7" r="3.3" fill="#fff"/>` +
    `<circle cx="9.4" cy="7" r="2.7" fill="#e30a17"/><path d="M13.6 7l1.1-1.5v3z" fill="#fff"/>`,
  // Norvég: a fehér szegélyű kék kereszt — két kereszt egymáson.
  no:
    `<rect width="20" height="14" fill="#ba0c2f"/><rect x="4.9" width="4.4" height="14" fill="#fff"/>` +
    `<rect y="4.8" width="20" height="4.4" fill="#fff"/><rect x="6" width="2.2" height="14" fill="#00205b"/>` +
    `<rect y="5.9" width="20" height="2.2" fill="#00205b"/>`,
};

function flag(code: string, size = 20): string {
  const body = FLAGS[code];
  if (!body) return "";
  const hh = Math.round((size * 14) / 20);
  return (
    `<svg width="${size}" height="${hh}" viewBox="0 0 20 14" aria-hidden="true" ` +
    `style="display:block;border-radius:2px;flex:0 0 auto">${body}</svg>`
  );
}

/* ───────────────────────────────── IKONOK ─────────────────────────────────────
 * §B: saját SVG-készlet, emoji tilos.
 */
const ICO_GLOBE =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" width="20" height="20" aria-hidden="true">` +
  `<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>`;
const ICO_CHECK =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18" aria-hidden="true">` +
  `<path d="M20 6 9 17l-5-5"/></svg>`;
const ICO_ALERT =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" width="18" height="18" aria-hidden="true">` +
  `<path d="M12 9v4.5M12 17h.01M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.4h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></svg>`;
const ICO_CHEVRON =
  `<svg class="mlfold__ch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18" aria-hidden="true">` +
  `<path d="m6 9 6 6 6-6"/></svg>`;
const ICO_STAR =
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18" aria-hidden="true">` +
  `<path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z"/></svg>`;

/* ──────────────────────────────── KÖZÖS CSS ────────────────────────────────── */

const DRAFT_CSS = `
.dv-wrap{max-width:var(--citui-container);margin:0 auto;padding:18px 14px 96px;
  container-type:inline-size;transition:max-width .2s ease}
.dv-wrap.is-phone{max-width:390px}
.dv-sizer{position:sticky;top:0;z-index:9;display:flex;gap:6px;justify-content:center;
  padding:8px;background:var(--citui-navy-900)}
.dv-sizer button{font:inherit;font-size:.8rem;cursor:pointer;padding:6px 14px;min-height:32px;
  border-radius:var(--citui-radius-pill);border:1px solid var(--citui-line-strong);
  background:transparent;color:var(--citui-white);opacity:.65;transition:var(--citui-transition)}
.dv-sizer button.is-on{opacity:1;background:var(--citui-cyan-500);color:var(--citui-navy-950);
  border-color:var(--citui-cyan-500);font-weight:600}
.dv-vlabel{position:sticky;top:0;z-index:8;background:var(--citui-navy-950);color:var(--citui-white);
  font-size:.78rem;padding:7px 14px;text-align:center;font-family:var(--citui-font-display)}
.dv-note{font-size:.8rem;color:var(--citui-muted);margin:0 0 14px;
  border:1px dashed var(--citui-line-strong);border-radius:var(--citui-radius-sm);padding:9px 11px;line-height:1.5}

/* ── nyelv-csempe (mindhárom változat közös atomja) ── */
.mlx{display:flex;align-items:center;gap:9px;padding:9px 11px;border:1.5px solid var(--citui-line);
  border-radius:var(--citui-radius-sm);cursor:pointer;background:var(--citui-white);
  transition:var(--citui-transition);min-height:44px}
.mlx:hover{border-color:var(--citui-cyan-400)}
.mlx.is-on{border-color:var(--citui-cyan-500);
  background:color-mix(in srgb, var(--citui-cyan-500) 8%, var(--citui-white))}
.mlx.is-off{opacity:.42;cursor:not-allowed}
.mlx input{width:18px;height:18px;flex:none;accent-color:var(--citui-cyan-500);margin:0}
.mlx__n{font-size:.9rem;line-height:1.25;min-width:0}
.mlx__n b{display:block;font-weight:600}
.mlx__n span{display:block;font-size:.76rem;color:var(--citui-muted);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mlx-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:7px}
@container (max-width:430px){ .mlx-grid{grid-template-columns:1fr 1fr;gap:6px}
  .mlx{padding:8px 9px;gap:7px} .mlx__n{font-size:.84rem} .mlx__n span{display:none} }

/* ── régió-fejléc ── */
.mlrg{margin:16px 0 7px;display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.mlrg h3{margin:0;font-size:.88rem;font-family:var(--citui-font-display);
  text-transform:uppercase;letter-spacing:.06em;color:var(--citui-muted)}
.mlrg button{font:inherit;font-size:.78rem;cursor:pointer;background:none;border:0;padding:4px 2px;
  color:var(--citui-cyan-500);text-decoration:underline;min-height:32px}

/* ── sáv-kártyák ── */
.mltier{display:grid;gap:10px;margin:4px 0 6px;grid-template-columns:repeat(3,1fr)}
@container (max-width:560px){ .mltier{grid-template-columns:1fr} }
.mltc{text-align:left;font:inherit;cursor:pointer;background:var(--citui-white);
  border:1.5px solid var(--citui-line);border-radius:var(--citui-radius);padding:14px 15px;
  transition:var(--citui-transition);display:block;width:100%}
.mltc:hover{border-color:var(--citui-cyan-400)}
.mltc.is-on{border-color:var(--citui-cyan-500);box-shadow:var(--citui-shadow-sm);
  background:color-mix(in srgb, var(--citui-cyan-500) 6%, var(--citui-white))}
.mltc__n{font-family:var(--citui-font-display);font-size:.82rem;text-transform:uppercase;
  letter-spacing:.07em;color:var(--citui-muted)}
.mltc__p{font-family:var(--citui-font-display);font-size:1.45rem;margin:5px 0 1px;line-height:1.1}
.mltc__c{font-size:.85rem;color:var(--citui-muted);line-height:1.4}
.mltc__u{font-size:.78rem;color:var(--citui-cyan-500);margin-top:6px;font-weight:600}

/* ── összegző sáv ── */
.mlsum{display:flex;align-items:center;gap:14px;flex-wrap:wrap;
  background:var(--citui-surface-2);border:1px solid var(--citui-line);
  border-radius:var(--citui-radius);padding:13px 15px;margin:16px 0 0}
.mlsum__l{font-size:.85rem;color:var(--citui-muted);line-height:1.45}
.mlsum__l b{display:block;color:var(--citui-ink);font-size:1.5rem;
  font-family:var(--citui-font-display);line-height:1.15}
.mlsum .citui-btn{margin-left:auto}

/* A MOBIL ÁR-SÁV — a kártyán kívül, ezért tud tapadni (lásd shell() magyarázatát).
 * Asztalon nincs rá szükség: ott a kártyán belüli .mlsum / oldalsó sáv viszi. */
.mlbar{display:none}
@container (max-width:430px){
  .mlsum{display:none}
  .mlbar{display:flex;align-items:center;gap:12px;flex-wrap:wrap;
    position:sticky;bottom:0;z-index:7;margin:0 -14px;
    background:var(--citui-surface-2);border-top:1px solid var(--citui-line);
    border-radius:var(--citui-radius) var(--citui-radius) 0 0;
    box-shadow:var(--citui-shadow-md);padding:11px 15px 13px}
  .mlbar .mlsum__l{flex:1 1 100%}
  /* A gomb felirata 390px-en két sorba tört — a betű enged, nem a mondat. */
  .mlbar .citui-btn{width:100%;font-size:.92rem;padding-left:10px;padding-right:10px}
}

/* ── felminősítés-bejelentő (néma váltás TILOS) ── */
.mlup{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;margin:12px 0 0;
  border-radius:var(--citui-radius-sm);font-size:.87rem;line-height:1.5;
  background:color-mix(in srgb, var(--citui-cyan-500) 10%, transparent);
  border:1px solid color-mix(in srgb, var(--citui-cyan-500) 34%, transparent)}
.mlup b{font-family:var(--citui-font-display)}
.mlup__x{margin-left:auto;flex:none;background:none;border:0;font:inherit;cursor:pointer;
  color:var(--citui-muted);text-decoration:underline;min-height:32px;padding:0 2px}
.mlhint{font-size:.83rem;color:var(--citui-cyan-500);margin:9px 0 0;font-weight:600}

/* ── B változat: kéthasáb asztalon ── */
.mlcols{display:grid;grid-template-columns:1fr 268px;gap:22px;align-items:start}
/* ⛔ MÉRVE: keskenyen NEM elég egy hasábra váltani. Rács-elemként a ragadó sáv
 * mozgástere a SAJÁT rács-cellája, ami pont akkora, mint ő — így sosem ragadt meg,
 * és a végösszeg csak a 28 nyelv ALATT látszott. Blokk-elrendezésben a befoglaló
 * a teljes lista, ott van hova felúsznia. (position:fixed itt NEM jó: a .dv-wrap
 * container-type miatt layout-containment, az elnyelné a fixed pozíciót.) */
@container (max-width:700px){ .mlcols{display:block} }
.mlrail{position:sticky;top:64px}
/* MOBILON MÁS A DÖNTÉS, nem ugyanaz lekicsinyítve: az oldalsó sáv eltűnik, és a
 * szerepét a kártyán kívüli, TAPADÓ ár-sáv veszi át (.mlbar). A 28 nyelv úgy
 * hosszú, hogy a végösszeg egyébként csak a lista ALATT látszana — választás
 * közben nem látná, mit fizet. */
@container (max-width:700px){ .mlrail{display:none} }
.mlrail__box{background:var(--citui-surface-2);border:1px solid var(--citui-line);
  border-radius:var(--citui-radius);padding:15px 16px}
.mlrail__p{font-family:var(--citui-font-display);font-size:1.9rem;line-height:1.05;margin:2px 0 0}
.mlrail__t{font-size:.8rem;text-transform:uppercase;letter-spacing:.07em;color:var(--citui-muted);
  font-family:var(--citui-font-display)}
.mlrail__s{font-size:.85rem;color:var(--citui-muted);margin:9px 0 0;line-height:1.5}
.mlsteps{list-style:none;margin:12px 0 0;padding:0;font-size:.83rem}
.mlsteps li{display:flex;gap:8px;padding:5px 0;color:var(--citui-muted);align-items:center}
.mlsteps li.is-on{color:var(--citui-ink);font-weight:600}
.mlsteps i{width:7px;height:7px;border-radius:50%;background:var(--citui-line-strong);flex:none}
.mlsteps li.is-on i{background:var(--citui-cyan-500)}

/* ── C változat: ajánlott blokk ── */
.mlrec{border:1.5px solid var(--citui-cyan-500);border-radius:var(--citui-radius);
  padding:16px 17px;margin:0 0 8px;
  background:color-mix(in srgb, var(--citui-cyan-500) 6%, var(--citui-white))}
.mlrec__h{display:flex;align-items:center;gap:9px;color:var(--citui-cyan-500);
  font-family:var(--citui-font-display);font-size:.95rem}
.mlrec__w{font-size:.86rem;color:var(--citui-muted);margin:7px 0 12px;line-height:1.55}
.mlrec__row{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 13px}
.mlrec__chip{display:flex;align-items:center;gap:7px;background:var(--citui-white);
  border:1px solid var(--citui-line);border-radius:var(--citui-radius-pill);
  padding:6px 12px 6px 8px;font-size:.86rem}
.mlrec__chip small{color:var(--citui-muted)}
/* ⛔ Az első változatom itt csupasz szöveg volt: a saját képemen NEM látszott
 * kattinthatónak (se jelölő, se keret). A lenyitó VEZÉRLŐ, tehát nézzen ki annak. */
.mlfold > summary{cursor:pointer;font-size:.92rem;padding:13px 15px;min-height:44px;
  display:flex;align-items:center;gap:9px;font-family:var(--citui-font-display);
  list-style:none;margin-top:14px;
  border:1.5px solid var(--citui-line-strong);border-radius:var(--citui-radius);
  background:var(--citui-white);transition:var(--citui-transition)}
.mlfold > summary::-webkit-details-marker{display:none}
.mlfold > summary:hover{border-color:var(--citui-cyan-500);color:var(--citui-cyan-500)}
.mlfold > summary .mlfold__ch{margin-left:auto;flex:none;color:var(--citui-cyan-500);
  transition:transform .18s ease}
.mlfold[open] > summary{border-color:var(--citui-cyan-500);
  border-radius:var(--citui-radius) var(--citui-radius) 0 0;margin-bottom:0}
.mlfold[open] > summary .mlfold__ch{transform:rotate(180deg)}
.mlfold[open] > .mlfold__body{border:1.5px solid var(--citui-cyan-500);border-top:0;
  border-radius:0 0 var(--citui-radius) var(--citui-radius);padding:2px 15px 15px}
.mlchips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 0}
.mlchips span{display:flex;align-items:center;gap:6px;background:var(--citui-white);
  border:1px solid var(--citui-line);border-radius:var(--citui-radius-pill);
  padding:4px 10px 4px 7px;font-size:.8rem}
`;

/* ──────────────────────────────── KÖZÖS HÉJ ────────────────────────────────── */

/**
 * ⛔ MÉRVE, és ez a termékre is áll: a `.adm-card` `overflow:hidden`, ezért AZ lesz
 * a sticky elem scroll-konténere — a kártyán BELÜL a ragadó ár-sáv néma no-op
 * (a sáv 1:1 görgött a lappal, rect.top 1447 → sosem tapadt meg). A mobil ár-sáv
 * ezért a kártyán KÍVÜL, a .dv-wrap gyermekeként él. Egy forrás tölti a kártyán
 * belüli (asztali) és a kívüli (mobil) példányt is — nem két igazság, két render.
 */
function shell(
  title: string,
  subtitle: string,
  body: string,
  bar: string,
  cssText: string,
  js: string,
): string {
  return (
    `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${title}</title><style>${cssText}\n${DRAFT_CSS}</style></head>` +
    `<body class="citui-admin-body" style="background:var(--citui-surface)">` +
    `<div class="dv-vlabel">${title} · TERV — kattintható, próbálja ki</div>` +
    `<div class="dv-sizer">` +
    `<button type="button" data-size="phone">Mobil 390px</button>` +
    `<button type="button" data-size="desktop" class="is-on">Asztali</button>` +
    `</div>` +
    `<div class="dv-wrap">` +
    `<div class="adm-card">` +
    `<div class="adm-card__head"><span class="adm-ico">${ICO_GLOBE}</span><h2>Többnyelvű honlap</h2></div>` +
    `<p class="dv-note">${subtitle}</p>` +
    body +
    `</div>` +
    bar +
    `</div>` +
    `<script>
      (function(){
        var wrap=document.querySelector('.dv-wrap');
        var btns=[].slice.call(document.querySelectorAll('[data-size]'));
        function set(mode){
          wrap.classList.toggle('is-phone', mode==='phone');
          btns.forEach(function(b){ b.classList.toggle('is-on', b.getAttribute('data-size')===mode); });
        }
        btns.forEach(function(b){ b.addEventListener('click',function(){ set(b.getAttribute('data-size')); }); });
        // ⚠️ A VIEWPORTBÓL indul (reference_mock_size_switch_starts_from_viewport):
        // különben az asztali ui-shot is mobil elrendezést fotózna.
        if(window.innerWidth<600) set('phone');
      })();
      var TIERS=${JSON.stringify(TIERS)};
      var TOTAL=${LANGS.length};
      function huf(n){return n.toLocaleString('hu-HU')+' Ft'}
      /** EGY érték, több megjelenítés: az asztali és a mobil példány sosem térhet el. */
      function setAll(sel,prop,val){
        [].slice.call(document.querySelectorAll(sel)).forEach(function(e){ e[prop]=val; });
      }
      /** A SÁV-SZABÁLY — egy helyen, mindhárom változat ebből él. */
      function tierFor(n){
        for(var i=0;i<TIERS.length;i++){ if(n<=TIERS[i].cap) return TIERS[i]; }
        return TIERS[TIERS.length-1];
      }
      ${js}
    </script></body></html>`
  );
}

/** Egy nyelv-csempe. */
function tile(l: Lang, checked: boolean): string {
  return (
    `<label class="mlx${checked ? " is-on" : ""}" data-lang="${l.code}">` +
    `<input type="checkbox" name="lang" value="${l.code}"${checked ? " checked" : ""}>` +
    flag(l.code, 22) +
    `<span class="mlx__n"><b>${l.hu}</b><span>${l.endonym}</span></span></label>`
  );
}

/** Összegző sáv — ugyanaz a jelölés a kártyán belül (asztali) és kívül (mobil). */
function sumBar(cls: "mlsum" | "mlbar"): string {
  return (
    `<div class="${cls}">` +
    `<span class="mlsum__l" data-sum-left></span>` +
    `<button class="citui-btn citui-btn--primary" type="button" data-pay></button>` +
    `</div>`
  );
}

/** Régiókra bontott teljes lista. */
function regionList(preset: readonly string[], withGroupToggle: boolean): string {
  return REGIONS.map((r) => {
    const inRegion = LANGS.filter((l) => l.region === r);
    return (
      `<div class="mlrg"><h3>${r}</h3>` +
      (withGroupToggle
        ? `<button type="button" data-region="${r}">mind a ${inRegion.length}</button>`
        : "") +
      `</div><div class="mlx-grid">` +
      inRegion.map((l) => tile(l, preset.includes(l.code))).join("") +
      `</div>`
    );
  }).join("");
}

/* ═══════════════════════════ A VÁLTOZAT — sáv előbb ═══════════════════════════
 * Döntés: a tenant ELŐSZÖR csomagot választ, utána nyelvet. A picker sapkája a
 * sávból jön; a TELJES sávnál nincs mit választani, ezért a lista helyére a 28
 * nyelv olvasható felsorolása lép.
 */
function variantA(): { body: string; bar: string; js: string } {
  const body =
    `<div class="mltier">` +
    TIERS.map(
      (t, i) =>
        `<button type="button" class="mltc${i === 0 ? " is-on" : ""}" data-tier="${t.id}">` +
        `<span class="mltc__n">${t.name}</span>` +
        `<div class="mltc__p">${huf(t.price)}</div>` +
        `<div class="mltc__c">${t.id === "teljes" ? `mind a ${LANGS.length} nyelv` : `legfeljebb ${t.cap} nyelv`}</div>` +
        (t.id === "teljes"
          ? `<div class="mltc__u">${Math.round(t.price / LANGS.length).toLocaleString("hu-HU")} Ft / nyelv</div>`
          : `<div class="mltc__u">${Math.round(t.price / t.cap).toLocaleString("hu-HU")} Ft / nyelv</div>`) +
        `</button>`,
    ).join("") +
    `</div>` +
    `<p class="mlhint" data-cap-line></p>` +
    `<div data-picker>${regionList(["de", "en"], false)}</div>` +
    `<div data-allbox hidden>` +
    `<div class="mlrg"><h3>A csomag tartalma</h3></div>` +
    `<div class="mlchips">` +
    LANGS.map((l) => `<span>${flag(l.code, 18)}${l.hu}</span>`).join("") +
    `</div></div>` +
    sumBar("mlsum");

  const js = `
    var curTier='alap';
    function boxes(){return [].slice.call(document.querySelectorAll('.mlx input'))}
    function picked(){return boxes().filter(function(c){return c.checked})}
    function render(){
      var t=null; TIERS.forEach(function(x){ if(x.id===curTier) t=x; });
      var isAll = t.id==='teljes';
      document.querySelector('[data-picker]').hidden = isAll;
      document.querySelector('[data-allbox]').hidden = !isAll;
      var n = isAll ? TOTAL : picked().length;
      // A sapka a SÁVBÓL jön: a fölös csempe kikapcsol, nem némán, hanem láthatóan.
      boxes().forEach(function(c){
        var over = !c.checked && picked().length >= t.cap;
        c.disabled = over;
        c.closest('.mlx').classList.toggle('is-off', over);
        c.closest('.mlx').classList.toggle('is-on', c.checked);
      });
      var left = t.cap - n;
      document.querySelector('[data-cap-line]').textContent = isAll
        ? 'A teljes csomagban nincs mit választani — mind a '+TOTAL+' nyelv elkészül.'
        : (left>0 ? 'Még '+left+' nyelvet választhat UGYANEZÉRT az árért.' : 'Betelt a csomag — nagyobb sávra váltva választhat többet.');
      // Kártyán belüli (asztali) ÉS kártyán kívüli (mobil) példány — egy forrásból.
      setAll('[data-sum-left]','innerHTML',
        '<span>'+t.name+' csomag · '+n+' nyelv · egyszeri díj</span><b>'+huf(t.price)+'</b>');
      setAll('[data-pay]','textContent','Fizetés és generálás ('+huf(t.price)+')');
    }
    document.querySelectorAll('[data-tier]').forEach(function(b){
      b.addEventListener('click',function(){
        curTier=b.getAttribute('data-tier');
        document.querySelectorAll('[data-tier]').forEach(function(x){
          x.classList.toggle('is-on', x===b); });
        // Sávot LEFELÉ váltva a fölös jelölés lekerül — kimondva, nem csendben.
        var t=null; TIERS.forEach(function(x){ if(x.id===curTier) t=x; });
        var p=picked();
        if(p.length>t.cap){ p.slice(t.cap).forEach(function(c){c.checked=false}); }
        render();
      });
    });
    document.addEventListener('change',function(e){ if(e.target.name==='lang') render(); });
    render();
  `;
  return { body, bar: sumBar("mlbar"), js };
}

/* ═══════════════════ B VÁLTOZAT — a lista vezet, az ár követ ═══════════════════
 * Döntés: nincs külön csomagválasztó. A tenant nyelveket pipál, a sáv és az ár
 * ebből SZÁRMAZIK. A 7. pipa a teljes csomagra visz — de ezt a felület KIMONDJA
 * és megerősítteti, mert a néma felminősítés pont az a hiba, amitől a képernyő
 * kevesebbet mond, mint ami történik.
 */
function variantB(): { body: string; bar: string; js: string } {
  const body =
    `<div class="mlcols">` +
    `<div>` +
    `<div data-upsell hidden></div>` +
    regionList(["de", "en", "sk"], true) +
    `</div>` +
    `<aside class="mlrail"><div class="mlrail__box">` +
    `<div class="mlrail__t" data-rail-tier></div>` +
    `<div class="mlrail__p" data-rail-price></div>` +
    `<p class="mlrail__s" data-rail-sub></p>` +
    `<ul class="mlsteps">` +
    TIERS.map(
      (t) =>
        `<li data-step="${t.id}"><i></i><span>${t.name} · ${t.id === "teljes" ? `mind a ${LANGS.length}` : `max ${t.cap}`} · ${huf(t.price)}</span></li>`,
    ).join("") +
    `</ul>` +
    `<button class="citui-btn citui-btn--primary" type="button" data-pay ` +
    `style="width:100%;margin-top:13px"></button>` +
    `</div></aside></div>`;

  const js = `
    function boxes(){return [].slice.call(document.querySelectorAll('.mlx input'))}
    function picked(){return boxes().filter(function(c){return c.checked})}
    var allMode=false;
    function render(){
      var n = allMode ? TOTAL : picked().length;
      var t = tierFor(n);
      boxes().forEach(function(c){ c.closest('.mlx').classList.toggle('is-on', c.checked); });
      setAll('[data-rail-tier]','textContent', t.name+' csomag · '+n+' nyelv');
      setAll('[data-rail-price]','textContent', huf(t.price));
      var left = t.cap - n;
      setAll('[data-rail-sub]','textContent', allMode
        ? 'Mind a '+TOTAL+' nyelv — ennél több nincs.'
        : (left>0
            ? 'Még '+left+' nyelv fér ebbe a csomagba, felár nélkül.'
            : 'Ez a csomag betelt. A következő nyelv a teljes csomagra vinne.'));
      document.querySelectorAll('[data-step]').forEach(function(li){
        li.classList.toggle('is-on', li.getAttribute('data-step')===t.id); });
      setAll('[data-pay]','textContent', 'Fizetés ('+huf(t.price)+')');
    }
    /** A 7. nyelv = teljes csomag. NEM csendben: bejelentve, visszavonhatóan. */
    function announce(){
      var box=document.querySelector('[data-upsell]');
      box.hidden=false;
      box.innerHTML='<div class="mlup">${ICO_ALERT.replace(/'/g, "\\'")}<div>'+
        '<b>Ez a 7. nyelv — a teljes csomagra váltottunk.</b><br>'+
        'Hat nyelv fölött csak a teljes csomag van, ezért most <b>mind a '+TOTAL+' nyelv</b> '+
        'elkészül, egyszeri <b>'+huf(30000)+'</b> díjért (a bővített '+huf(22900)+' volt).'+
        '</div><button type="button" class="mlup__x" data-undo>Mégsem, maradjon hat</button></div>';
      box.querySelector('[data-undo]').addEventListener('click',function(){
        allMode=false; box.hidden=true;
        // A visszavonás annyira érjen el, amennyire a váltás: a 7. pipa is lekerül.
        var p=picked(); p.slice(6).forEach(function(c){c.checked=false});
        render();
      });
    }
    document.addEventListener('change',function(e){
      if(e.target.name!=='lang') return;
      if(!allMode && picked().length>6){ allMode=true; announce(); }
      if(allMode && picked().length<=6){ allMode=false; document.querySelector('[data-upsell]').hidden=true; }
      render();
    });
    document.querySelectorAll('[data-region]').forEach(function(b){
      b.addEventListener('click',function(){
        var grid=b.closest('.mlrg').nextElementSibling;
        var cbs=[].slice.call(grid.querySelectorAll('input'));
        var on=cbs.every(function(c){return c.checked});
        cbs.forEach(function(c){c.checked=!on});
        if(!allMode && picked().length>6){ allMode=true; announce(); }
        render();
      });
    });
    render();
  `;
  // MOBIL: a kártyán kívüli tapadó sáv viszi ugyanazt a három adatot, tömörebben.
  const bar =
    `<div class="mlbar">` +
    `<span class="mlsum__l" style="flex:1 1 100%">` +
    `<span data-rail-tier></span><b data-rail-price></b>` +
    `<span data-rail-sub style="display:block;font-size:.82rem;margin-top:3px"></span></span>` +
    `<button class="citui-btn citui-btn--primary" type="button" data-pay></button>` +
    `</div>`;
  return { body, bar, js };
}

/* ═════════════ C VÁLTOZAT — az ajánlás a vendég-adatból jön ════════════════════
 * Döntés: a felület NE egy 28 elemű, vélemény nélküli falat adjon. A szállás SAJÁT
 * vendég-adatából (Google-vélemények nyelve, portál-profil) ajánl készletet, és a
 * teljes lista mögé van hajtva.
 * ⚠️ ADAT-FÜGGŐSÉG: ez a változat csak akkor mondhat ilyet, ha tényleg MÉRJÜK a
 * vélemények nyelvét. Ha nincs adat, a blokk NEM jelenhet meg találgatással (§B.17).
 */
function variantC(): { body: string; bar: string; js: string } {
  const evidence = [
    { code: "de", n: 12 },
    { code: "en", n: 5 },
    { code: "pl", n: 3 },
  ];
  const recCodes = evidence.map((e) => e.code);
  const body =
    `<div class="mlrec">` +
    `<div class="mlrec__h">${ICO_STAR}<span>Az Ön vendégei szerint</span></div>` +
    `<p class="mlrec__w">A szállásáról <b>20 vélemény</b> érkezett idegen nyelven. ` +
    `Ezeket mértük — nem tippeltük:</p>` +
    `<div class="mlrec__row">` +
    evidence
      .map((e) => {
        const l = LANGS.find((x) => x.code === e.code)!;
        return `<span class="mlrec__chip">${flag(e.code, 18)}<b>${l.hu}</b><small>${e.n} vélemény</small></span>`;
      })
      .join("") +
    `</div>` +
    `<button class="citui-btn citui-btn--primary" type="button" data-takerec>` +
    `Ezt a 3 nyelvet választom (${huf(14900)})</button>` +
    `</div>` +
    `<details class="mlfold" data-fold>` +
    `<summary>Vagy válasszon maga — mind a ${LANGS.length} nyelv${ICO_CHEVRON}</summary>` +
    `<div class="mlfold__body">` +
    `<p class="mlhint" data-cap-line></p>` +
    regionList(recCodes, true) +
    `</div></details>` +
    sumBar("mlsum");

  const js = `
    function boxes(){return [].slice.call(document.querySelectorAll('.mlx input'))}
    function picked(){return boxes().filter(function(c){return c.checked})}
    function render(){
      var n=picked().length, t=tierFor(n);
      boxes().forEach(function(c){ c.closest('.mlx').classList.toggle('is-on', c.checked); });
      var left=t.cap-n;
      document.querySelector('[data-cap-line]').textContent = n>6
        ? 'Hat nyelv fölött a teljes csomag jár: mind a '+TOTAL+' nyelv elkészül.'
        : (left>0 ? 'Még '+left+' nyelv fér a(z) '+t.name.toLowerCase()+' csomagba, felár nélkül.'
                  : 'Ez a csomag betelt — a következő nyelv a teljes csomagra vinne.');
      var shown = n>6 ? TOTAL : n;
      setAll('[data-sum-left]','innerHTML',
        '<span>'+t.name+' csomag · '+shown+' nyelv · egyszeri díj</span><b>'+huf(t.price)+'</b>');
      setAll('[data-pay]','textContent','Fizetés és generálás ('+huf(t.price)+')');
    }
    document.querySelector('[data-takerec]').addEventListener('click',function(){
      boxes().forEach(function(c){ c.checked = ${JSON.stringify(recCodes)}.indexOf(c.value)>=0; });
      render();
      document.querySelector('[data-fold]').open=false;
      window.scrollTo(0,document.body.scrollHeight);
    });
    document.addEventListener('change',function(e){ if(e.target.name==='lang') render(); });
    document.querySelectorAll('[data-region]').forEach(function(b){
      b.addEventListener('click',function(){
        var grid=b.closest('.mlrg').nextElementSibling;
        var cbs=[].slice.call(grid.querySelectorAll('input'));
        var on=cbs.every(function(c){return c.checked});
        cbs.forEach(function(c){c.checked=!on});
        render();
      });
    });
    render();
  `;
  return { body, bar: sumBar("mlbar"), js };
}

/* ──────────────────────────────────── MAIN ─────────────────────────────────── */

const SUB =
  `Az oldala a választott nyelveken is elérhető lesz — a szövegei és a teljes felület lefordítva, ` +
  `egyszeri díjért. A magyar az oldal saját nyelve, ezért nem számít bele. ` +
  `<b>Választható: ${LANGS.length} nyelv</b> (EU 24 hivatalos + szerb, ukrán, orosz, török, norvég).`;

async function main(): Promise<void> {
  const cssText =
    (await readFile(path.join(ROOT, "public/assets/ui/citui.css"), "utf8")) +
    "\n" +
    (await readFile(path.join(ROOT, "public/assets/ui/citui-admin.css"), "utf8"));
  await mkdir(OUT, { recursive: true });

  const variants = [
    { key: "A", title: "A — Sáv előbb, nyelv utána", make: variantA },
    { key: "B", title: "B — A lista vezet, az ár követ", make: variantB },
    { key: "C", title: "C — Az ajánlás a vendég-adatból", make: variantC },
  ];

  for (const v of variants) {
    const { body, bar, js } = v.make();
    const file = path.join(OUT, `multilang-tiers-${v.key}.html`);
    await writeFile(file, shell(v.title, SUB, body, bar, cssText, js), "utf8");
    console.log(`✓ ${file}`);
  }
  console.log(`\n${LANGS.length} célnyelv · sávok: ${TIERS.map((t) => `${t.name} ${huf(t.price)}`).join(" · ")}`);
  const missing = LANGS.filter((l) => !FLAGS[l.code]).map((l) => l.code);
  console.log(missing.length ? `⛔ zászló hiányzik: ${missing.join(", ")}` : "✓ mind a 29 zászló megvan");
}

await main();
