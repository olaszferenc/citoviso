// KÉP-PROXY A KONZOLNAK — hogy a felület azt mérje, amit a böngésző tölt, és ha nem
// tölthető be, KIMONDJA, miért.
//
// ⛔ MÉRT HIBA (2026-09-11, Elek FK-003b ①): a nyitókép-választóban a cián kerettel
// kiemelt NYITÓKÉP csempe teljesen ÜRES volt, a négy bélyegből hármon a böngésző
// törött-kép ikonja állt, és egyedül az a kép rendelt, amelyik a „reklámbanner"
// címkét viselte. A kurátor tehát VAKON döntött arról, mi kerül a lap tetejére.
//
// Az ok nem a pontozás volt: a portál (hovamenjek.hu) azóta LETÖRÖLTE/áthelyezte a
// fotókat, mind a négy URL **404**-et ad — a `curl` mérte, referer-rel és anélkül is.
// A felület viszont csak annyit írt a csempe alá, hogy „nem ítélt" (= nincs vision-
// verdikt), ami egy TELJESEN MÁS állítás, és pont a lényeget hallgatta el.
//
// Ezért két dolgot választunk szét, és mindkettőt kimondjuk:
//   • VERDIKT   — van-e vision-ítéletünk a képről (score/tárgy/indok)
//   • FORRÁS    — betölthető-e egyáltalán (200 / 404 / 403 / hálózat / nem kép)
//
// A képek a SAJÁT szerverünkön át jönnek. Nem kényelemből: így ugyanaz a kérés dönt,
// amit a felület megmér és amit a böngésző megjelenít. Közvetlen `<img src>` mellett a
// kettő eltérhet (hotlink-védelem a referer alapján tilt: a szerverünk 200-at kap, a
// böngésző 403-at) — és akkor a panel „betölthető"-t állítana egy törött csempe alatt.
//
// SSRF: a konzol operátor-munkamenet mögött van, de attól még nem lehet belőle tetszőleges
// URL-t lekérő ugródeszka. Az URL-t ezért a nézet ALÁÍRJA (HMAC, session-titok), a route
// pedig csak érvényes aláírással kér le bármit; a séma http/https lehet, más nem.

import { createHmac, timingSafeEqual } from "node:crypto";

import { config } from "../config.js";
import { T } from "../i18n/mail.js";
import { PORTAL_USER_AGENT } from "../scraper/sources/portals/politeness.js";

const REALM = "console-photo";

/** Meddig hisszük el a mért verdiktet (a siker olcsóbban öregszik, mint a hiba). */
const OK_TTL_MS = 30 * 60_000;
const FAIL_TTL_MS = 5 * 60_000;
/** A lekérés nem áshatja be a konzolt: a lassú forrás ugyanúgy „nem tölthető be". */
const FETCH_TIMEOUT_MS = 8_000;
/** Ennél nagyobb képet nem szolgálunk ki bélyegnek (védelem a véletlen óriás ellen). */
const MAX_BYTES = 12 * 1024 * 1024;

export type PhotoFailure = "notfound" | "forbidden" | "upstream" | "network" | "nonimage" | "toolarge";

export interface PhotoVerdict {
  readonly ok: boolean;
  /** HTTP státusz, ha egyáltalán volt válasz. */
  readonly status: number | null;
  readonly failure?: PhotoFailure;
  readonly contentType?: string;
}

interface CacheRow extends PhotoVerdict {
  readonly at: number;
  readonly body?: Buffer;
}

const cache = new Map<string, CacheRow>();

function fresh(row: CacheRow): boolean {
  return Date.now() - row.at < (row.ok ? OK_TTL_MS : FAIL_TTL_MS);
}

/** Ugyanaz a kulcs, amit a hero-pontszám cache használ: query nélküli, kisbetűs URL. */
export function photoKey(url: string): string {
  const q = url.indexOf("?");
  return (q === -1 ? url : url.slice(0, q)).toLowerCase();
}

function sign(url: string): string {
  return createHmac("sha256", config.sessionSecret).update(`${REALM}:${url}`).digest("base64url");
}

/** A nézet ezt teszi az `<img src>`-be. Aláírt, tehát a route nem nyitott proxy. */
export function proxiedPhotoUrl(url: string): string {
  return `/photo?u=${encodeURIComponent(url)}&s=${sign(url)}`;
}

/** Érvényes-e az aláírás? (Időzítés-független összehasonlítás.) */
export function verifyPhotoSignature(url: string, sig: string): boolean {
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(url));
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Lekéri a képet (vagy visszaadja a friss cache-elt eredményt). A VERDIKT és a BÁJTOK
 * ugyanabból a kérésből származnak — nem mérhetünk mást, mint amit kiszolgálunk.
 */
export async function fetchPhoto(url: string): Promise<CacheRow> {
  const key = photoKey(url);
  const hit = cache.get(key);
  if (hit && fresh(hit)) return hit;

  const put = (row: Omit<CacheRow, "at">): CacheRow => {
    const full = { ...row, at: Date.now() };
    // A bájtokat csak sikeres, ésszerű méretű képnél tartjuk meg; a cache egy
    // lead-nyi bélyegre való, nem képtár.
    if (cache.size > 240) cache.clear();
    cache.set(key, full);
    return full;
  };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return put({ ok: false, status: null, failure: "network" });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return put({ ok: false, status: null, failure: "network" });
  }

  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // A SAJÁT nevünkben kérünk, ahogy a scraper is (politeness.PORTAL_USER_AGENT).
      // Böngészőnek álcázni magunkat itt is tilos: ha egy host tiltja a botunkat, az
      // egy VALÓDI ok, amit a kurátornak látnia kell — nem valami, amit megkerülünk.
      // Az URL-t egyébként is a polite scraper-úton gyűjtöttük be, ez csak megmutatja.
      headers: { "user-agent": PORTAL_USER_AGENT, accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    });
    if (!res.ok) {
      return put({
        ok: false,
        status: res.status,
        failure: res.status === 404 || res.status === 410 ? "notfound" : res.status === 401 || res.status === 403 ? "forbidden" : "upstream",
      });
    }
    const type = res.headers.get("content-type") ?? "";
    const body = Buffer.from(await res.arrayBuffer());
    if (!type.startsWith("image/")) {
      // ⚠️ A 200-as válasz sem garancia: a hovamenjek.hu is 200-at adhatna egy HTML
      // hibalapra. „Kép helyett weboldalt kaptunk" külön ok, nem elnyelendő siker.
      return put({ ok: false, status: res.status, failure: "nonimage", contentType: type });
    }
    if (body.byteLength > MAX_BYTES) {
      return put({ ok: false, status: res.status, failure: "toolarge", contentType: type });
    }
    return put({ ok: true, status: res.status, contentType: type, body });
  } catch {
    return put({ ok: false, status: null, failure: "network" });
  }
}

/**
 * MIÉRT nem tölthető be — egy mondatban, az operátornak.
 *
 * ⛔ A „nem ítélt" NEM magyarázat: az a vision-verdikt hiányáról szól, nem a képről.
 * Amit a kurátor látott (törött-kép ikon + „nem ítélt"), abból nem derült ki, hogy a
 * portál letörölte a fotót — és hogy emiatt a KISZÁLLÍTOTT lapon is törött lesz.
 */
export function photoFailReason(v: PhotoVerdict, lang: string, host: string): string {
  // ⚠️ A gazdagép-név SOHA nem kerül határozott névelő mögé: magyarul az „a/az" a
  // KIEJTÉSTŐL függ („a hovamenjek.hu", de „az lh3.googleusercontent.com"), és az
  // „a(z)" toldalék a mi szövegeinkben tiltott (ADR-0101). Ezért a host mindig
  // zárójelben, a mondat végén áll.
  switch (v.failure) {
    case "notfound":
      return T(lang, "Ez a kép már nincs meg a forrásnál — {status}-et ad ({host}).", {
        status: String(v.status ?? 404),
        host,
      });
    case "forbidden":
      return T(lang, "A forrás megtagadta a képet — {status}, hotlink-védelem vagy lejárt hivatkozás ({host}).", {
        status: String(v.status ?? 403),
        host,
      });
    case "nonimage":
      return T(lang, "Kép helyett weboldal érkezett — elavult hivatkozás ({host}).", { host });
    case "toolarge":
      return T(lang, "A kép túl nagy ahhoz, hogy bélyegként betöltsük.");
    case "network":
      return T(lang, "A forrás nem válaszolt időben — hálózati hiba vagy időtúllépés ({host}).", { host });
    default:
      return T(lang, "A forrás hibát adott — {status} ({host}).", { host, status: String(v.status ?? "?") });
  }
}

/**
 * Helyettesítő KÉP a törött csempe helyére. Azért kép és nem `onerror`-os JS: a proxy
 * mindig 200-at ad, tehát a böngésző törött-kép ikonja soha nem jelenik meg — a csempe
 * mindig MOND valamit.
 *
 * ⚠️ A RÉSZLETES OKOT NEM IDE ÍRJUK. Mérve (2026-09-11): egy 96 px-es bélyegre
 * skálázva a 320 px széles SVG betűje ~4 px — olvashatatlan, vagyis pont annyit ér,
 * mint a törött-kép ikon. Az indok ezért HTML-ben, a csempe alatt áll (`.hp-dead`),
 * ahol valódi méretű; az SVG csak azt mondja, hogy nincs kép. A teljes mondat így is
 * itt van az `aria-label`-ben, a képernyőolvasónak és a `title`-nek.
 */
export function placeholderSvg(title: string, reason: string): string {
  const esc = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // A színek a dizájn-mag tükrei (--citui-surface-2 / --citui-bad / --citui-muted):
  // ez az SVG ÖNÁLLÓ dokumentumként megy ki egy <img>-be, ahol a citui.css nincs
  // betöltve, tehát a var() nem oldódna fel. Értékben a maggal szinkronban tartandó —
  // ugyanaz a kivétel, mint a patternBadge-nél (design-token-lint ALLOW).
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240" role="img" aria-label="${esc(reason)}">
  <style>
    .bg { fill: #eef7fa }
    .t { font: 700 22px system-ui, sans-serif; fill: #e5484d; text-anchor: middle }
  </style>
  <rect class="bg" width="320" height="240"/>
  <path d="M160 78l34 58h-68z" fill="none" stroke="#e5484d" stroke-width="7" stroke-linejoin="round"/>
  <circle cx="160" cy="124" r="4" fill="#e5484d"/>
  <text x="160" y="176" class="t">${esc(title)}</text>
</svg>`;
}

/** A már MEGMÉRT (cache-elt) verdikt, hálózati kérés nélkül — a lap-render ezt olvassa. */
export function cachedVerdict(url: string): PhotoVerdict | null {
  const row = cache.get(photoKey(url));
  if (!row || !fresh(row)) return null;
  return { ok: row.ok, status: row.status, failure: row.failure, contentType: row.contentType };
}
