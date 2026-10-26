// HOGYAN JUT EL A FOTÓ A HTTPS-ES MOCKBA — generáláskor dől el (ADR-0341).
//
// ⛔⛔ MÉRT HIBA (2026-10-08, Forrás 880497a6 · Kerékhegy 0ccc74f6): a saját-honlapos
// fotó-behúzás (ADR-0337) `http://` URL-eket hozott, a mock viszont https-en fut. A
// böngésző a vegyes tartalmat https-re emeli — és ahol a hoszt tanúsítványa rossz
// (nem a domainre szól / lejárt / önaláírt), ott a kép NEM jelenik meg. A kapu nem
// szólt: a szerver http-n 200-at kapott, tehát „ép"-nek mérte, amit a lead törötten lát.
//
// Mérve élesen (2026-10-08): 16 lead · 237 http-s fotó-URL, 12 hoszt. Ebből 5 hoszt
// (118 URL) https-en BÁJTRA UGYANAZT adja → (a) út; 6 hoszt (104 élő URL) https-en
// tanúsítvány-hibás → (b) út; 1 hoszt (15 URL) http-n is 403 (bot-tiltás, külön ügy).
//
// A KÉT ÚT:
//   (a) a https-változat UGYANAZT a képet adja (sha256-egyezés) → a https URL kerül a lapra;
//   (b) különben a SAJÁT szerverünkön át jön: `/configure/<artifactId>/photo/<hash>`.
//       ⛔ Nem nyílt proxy: a route CSAK az artefaktum TÁROLT fotó-URL-jei közül szolgál ki
//       (`allowedPhotoSources`), és csak `http://` vagy nem fizetős `https://` forrást
//       (`isPaidPhotoHost`) — a Places-média ide soha nem jut el. A `/configure/` azért, mert élesen ez a
//       konzol nyilvános, nginx-en átengedett előtagja (a `/mock/` operátor-only).
//
// ⛔ HOTLINK-TILTÁS (2026-10-27, Huszár 62a12b3e): a huszar.info https-en, Referer nélkül 200-at
// ad, a mi lapunk Refererével 403-at — mindkét mockon minden kép szürke helyőrző volt, a kapu
// pedig „ép"-et mért (Referer nélkül kér). Ezért a https-forrásokat is megnézzük: hosztonként
// EGY próba a mock Refererével; ha az bukik, de Referer nélkül a kép él, a hoszt minden
// fotója a (b) úton jön. Fizetős hoszt (Places) soha nem próba és soha nem proxy.
//
// FORGATOTT PORTÁLKÉP (2026-10-27, Lakeside Home 79202242): a hovamenjek 17 képéből 9
// 1440×1080-as fekvő fájl EXIF-tájolás nélkül, a pixelek 90°-kal elforgatva — köztük minden
// hálószoba. Kézi mező a lead raw fotóján: `rotate: 90 | 180 | 270` (az óramutató járásával
// egyező fok, a sharp `rotate()` értelmében); a kollégák állítják, automatikus felismerés
// nincs. Az ilyen fotó a (b) úton jön, a route elforgatva szolgálja ki, így a lap a
// forgatott bájtot és méretarányt kapja — CSS transform nincs (az elrontaná a layoutot).
//
// A siteData a FORRÁS-URL-t tartja meg (jogállás, hero-pontszám kulcsa, élesítés) — a
// csere a RENDERELT HTML-en történik, minden íráskor (generálás, hero-csere, szöveg-
// átírás), egyetlen függvénnyel.

import { createHash } from "node:crypto";

import sharp from "sharp";

import { config } from "../config.js";
import { fetchPhoto } from "../console/photoProxy.js";
import { db } from "../db/client.js";
import { PORTAL_USER_AGENT } from "../scraper/sources/portals/politeness.js";

export type PhotoTransportVia = "https" | "proxy";

export interface PhotoTransportRow {
  readonly source: string;
  readonly served: string;
  readonly via: PhotoTransportVia;
}

/**
 * Kell-e a fotónak biztonságos út? `http://`, KIVÉVE a loopbacket: a böngésző a
 * `127.0.0.1` / `localhost` címet „potentially trustworthy"-nak veszi, és https-es lapon
 * sem blokkolja (W3C Mixed Content) — ez a helyi kapu-fixture-ök útja, nem lead-fotó.
 */
export function isInsecurePhotoUrl(url: string): boolean {
  if (!/^http:\/\//i.test(url)) return false;
  try {
    const h = new URL(url).hostname;
    return !(h === "localhost" || h === "127.0.0.1" || h === "[::1]");
  } catch {
    return true;
  }
}

/** Places / Google photo media: a PAID call — never probed, never proxied (§ cost). */
export function isPaidPhotoHost(url: string): boolean {
  try {
    return /(?:^|\.)(?:googleapis|googleusercontent|gstatic)\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Does the photo load when OUR page asks for it (Referer = the mock's origin)? */
export type HotlinkProbe = (url: string) => Promise<boolean>;

const PROBE_TTL_MS = 30 * 60_000;
const probeCache = new Map<string, { readonly ok: boolean; readonly at: number }>();

/** The default probe: one GET with the mock origin as Referer, the scraper's own user agent. */
export const probeWithMockReferer: HotlinkProbe = async (url) => {
  const hit = probeCache.get(url);
  if (hit && Date.now() - hit.at < PROBE_TTL_MS) return hit.ok;
  let ok = false;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "user-agent": PORTAL_USER_AGENT,
        accept: "image/avif,image/webp,image/*,*/*;q=0.8",
        referer: `${(config.publicBaseUrl ?? "https://citoviso.com").replace(/\/+$/, "")}/`,
      },
    });
    ok = res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
    await res.body?.cancel();
  } catch {
    ok = false;
  }
  if (probeCache.size > 500) probeCache.clear();
  probeCache.set(url, { ok, at: Date.now() });
  return ok;
};

/** A proxy-URL azonosítója: a forrás-URL lenyomata (nem titok — a jogosultság a tárolt lista). */
export function photoSourceHash(source: string): string {
  return createHash("sha256").update(source).digest("hex").slice(0, 24);
}

/** A (b) út URL-je. Abszolút, ha van nyilvános origó: a hero-shot `file://`-ból renderel.
 *  Forgatott fotónál `?r=<fok>`: a böngésző-cache ne a régi tájolást adja vissza. */
export function proxiedMockPhotoUrl(artifactId: string, source: string, rotate?: PhotoRotation): string {
  const base = (config.publicBaseUrl ?? "").replace(/\/+$/, "");
  return `${base}/configure/${artifactId}/photo/${photoSourceHash(source)}${rotate ? `?r=${rotate}` : ""}`;
}

/** Kézi forgatás fokban, az óramutató járásával egyezően (sharp `rotate()`). */
export type PhotoRotation = 90 | 180 | 270;

function asRotation(v: unknown): PhotoRotation | null {
  const n = typeof v === "string" && /^\d+$/.test(v.trim()) ? Number(v.trim()) : v;
  return n === 90 || n === 180 || n === 270 ? n : null;
}

/**
 * A lead raw fotóinak kézi forgatása, forrás-URL szerint: `raw.portalProfiles[].photos[].rotate`
 * és `raw.photos[].rotate`. Más érték (0, 45, "jobbra") nem forgat.
 */
export function photoRotations(raw: unknown): Map<string, PhotoRotation> {
  const r = (raw ?? {}) as {
    photos?: ReadonlyArray<{ url?: unknown; rotate?: unknown }>;
    portalProfiles?: ReadonlyArray<{ photos?: ReadonlyArray<{ url?: unknown; rotate?: unknown }> }>;
  };
  const out = new Map<string, PhotoRotation>();
  const lists = [r.photos ?? [], ...(r.portalProfiles ?? []).map((p) => p?.photos ?? [])];
  for (const list of lists) {
    for (const p of list) {
      const rot = asRotation(p?.rotate);
      if (rot && typeof p?.url === "string") out.set(p.url, rot);
    }
  }
  return out;
}

/** A forrás bájtjai elforgatva, a formátum marad (a route írja ki). */
export async function rotatedPhoto(body: Buffer, rotate: PhotoRotation): Promise<Buffer> {
  return sharp(body).rotate(rotate).toBuffer();
}

/** A lead tárolt forgatásai (üres, ha nincs lead vagy a DB nem válaszol — a lap attól még kész). */
export async function leadPhotoRotations(leadId: string | null | undefined): Promise<Map<string, PhotoRotation>> {
  if (!leadId) return new Map();
  try {
    const row = await db.selectFrom("lead").select("raw").where("id", "=", leadId).executeTakeFirst();
    return photoRotations(row?.raw);
  } catch {
    return new Map();
  }
}

/** Felismeri a (b) út URL-jét (bármely origón vagy relatívan). */
export const PROXIED_MOCK_PHOTO = /\/configure\/([0-9a-f-]{36})\/photo\/([0-9a-f]{24})(?=$|[?#])/i;

export function parseProxiedMockPhoto(url: string): { artifactId: string; hash: string } | null {
  const m = PROXIED_MOCK_PHOTO.exec(url);
  return m ? { artifactId: m[1]!.toLowerCase(), hash: m[2]!.toLowerCase() } : null;
}

/**
 * Az artefaktum TÁROLT fotó-forrásai — a proxy engedélylistája. A motor-út a
 * `siteData.photos`-ban, a régebbi utak a `photoTransport`-ban hagyják.
 */
export function allowedPhotoSources(inputs: unknown): string[] {
  const i = (inputs ?? {}) as {
    siteData?: { photos?: ReadonlyArray<{ url?: unknown } | string> };
    photoTransport?: ReadonlyArray<{ source?: unknown }>;
  };
  const out = new Set<string>();
  for (const p of i.siteData?.photos ?? []) {
    const u = typeof p === "string" ? p : p?.url;
    if (typeof u === "string") out.add(u);
  }
  for (const r of i.photoTransport ?? []) if (typeof r?.source === "string") out.add(r.source);
  return [...out];
}

/** A hash melyik tárolt forrásra mutat — `null`, ha egyikre sem (nem szolgálunk ki). */
export function resolveProxiedSource(inputs: unknown, hash: string): string | null {
  const h = hash.toLowerCase();
  return allowedPhotoSources(inputs).find((u) => photoSourceHash(u) === h) ?? null;
}

/** The fetch the decision rides on — the gate's own fetcher by default (one cache, one truth). */
export type PhotoFetcher = (url: string) => Promise<{ readonly ok: boolean; readonly body?: Buffer }>;

const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

/**
 * Eldönti a http-s fotók útját, és a hotlink-tiltó https-hosztokét (fent). Költség:
 * http-fotónként egy https-kérés a szállás SAJÁT hosztjára, https-hosztonként egy
 * Referer-próba (+ egy Referer nélküli, ha a próba bukik) — $0, Places nincs.
 */
export async function planPhotoTransport(
  urls: readonly string[],
  artifactId: string,
  fetcher: PhotoFetcher = fetchPhoto,
  probe: HotlinkProbe = probeWithMockReferer,
  rotations: ReadonlyMap<string, PhotoRotation> = new Map(),
): Promise<PhotoTransportRow[]> {
  const rows: PhotoTransportRow[] = [];
  // A rotated photo always rides the proxy (the route turns it); a paid host never does.
  const rotated = new Set<string>();
  for (const u of new Set(urls)) {
    const rot = rotations.get(u);
    if (!rot || isPaidPhotoHost(u)) continue;
    rotated.add(u);
    rows.push({ source: u, served: proxiedMockPhotoUrl(artifactId, u, rot), via: "proxy" });
  }
  const rest = urls.filter((u) => !rotated.has(u));
  const http = [...new Set(rest.filter(isInsecurePhotoUrl))];
  const byHost = new Map<string, string[]>();
  for (const u of http) {
    let host = "";
    try {
      host = new URL(u).host;
    } catch {
      /* unparsable → proxy */
    }
    byHost.set(host, [...(byHost.get(host) ?? []), u]);
  }
  // Hosts in parallel, one host's requests serially (the same politeness as the gate).
  await Promise.all(
    [...byHost.values()].map(async (list) => {
      for (const source of list) {
        const secure = source.replace(/^http:/i, "https:");
        const [a, b] = await Promise.all([fetcher(source), fetcher(secure)]);
        const same = a.ok && b.ok && a.body && b.body && sha(a.body) === sha(b.body);
        rows.push(
          same
            ? { source, served: secure, via: "https" }
            : { source, served: proxiedMockPhotoUrl(artifactId, source), via: "proxy" },
        );
      }
    }),
  );
  const secureByHost = new Map<string, string[]>();
  for (const u of new Set(rest)) {
    if (!/^https:\/\//i.test(u) || isPaidPhotoHost(u)) continue;
    let host = "";
    try {
      host = new URL(u).host;
    } catch {
      continue;
    }
    secureByHost.set(host, [...(secureByHost.get(host) ?? []), u]);
  }
  await Promise.all(
    [...secureByHost.values()].map(async (list) => {
      const first = list[0]!;
      if (await probe(first)) return;
      // Blocked for our page — but is it alive at all? A dead photo is the gate's to report.
      if (!(await fetcher(first)).ok) return;
      for (const source of list) rows.push({ source, served: proxiedMockPhotoUrl(artifactId, source), via: "proxy" });
    }),
  );
  rows.sort((x, y) => x.source.localeCompare(y.source));
  return rows;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A forrás-URL MINDEN előfordulását cseréli a renderelt lapon (attribútum, srcset,
 * CSS url(), JSON-LD, inline JS) — nyersen és `&amp;`-kódolva is. A határ-feltétel miatt
 * `…/a.jpg` nem harap bele egy `…/a.jpg2`-be.
 */
export function applyPhotoTransport(html: string, rows: readonly PhotoTransportRow[]): string {
  let out = html;
  // Longest first: a source that prefixes another must not eat its tail.
  for (const r of [...rows].sort((x, y) => y.source.length - x.source.length)) {
    for (const form of new Set([r.source, r.source.replace(/&/g, "&amp;")])) {
      out = out.replace(new RegExp(`${escapeRe(form)}(?![A-Za-z0-9\\-._~%/?#=+@!$*:])`, "g"), r.served);
    }
  }
  return out;
}

/** Generálás/átírás egy lépésben: a lapon lévő http-s fotók biztonságos útra kerülnek. */
export async function secureMockPhotos(
  html: string,
  artifactId: string,
  photoUrls: readonly string[],
  leadId?: string | null,
): Promise<{ html: string; transport: PhotoTransportRow[] }> {
  const rotations = await leadPhotoRotations(leadId);
  const transport = await planPhotoTransport(photoUrls, artifactId, fetchPhoto, probeWithMockReferer, rotations);
  return { html: transport.length ? applyPhotoTransport(html, transport) : html, transport };
}
