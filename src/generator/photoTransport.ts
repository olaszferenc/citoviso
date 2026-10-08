// HOGYAN JUT EL A FOTÓ A HTTPS-ES MOCKBA — generáláskor dől el (ADR-XXXX).
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
//       (`allowedPhotoSources`), és csak `http://` forrást — a Places (fizetős) URL-je
//       https, tehát ide soha nem jut el. A `/configure/` azért, mert élesen ez a
//       konzol nyilvános, nginx-en átengedett előtagja (a `/mock/` operátor-only).
//
// A siteData a FORRÁS-URL-t tartja meg (jogállás, hero-pontszám kulcsa, élesítés) — a
// csere a RENDERELT HTML-en történik, minden íráskor (generálás, hero-csere, szöveg-
// átírás), egyetlen függvénnyel.

import { createHash } from "node:crypto";

import { config } from "../config.js";
import { fetchPhoto } from "../console/photoProxy.js";

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

/** A proxy-URL azonosítója: a forrás-URL lenyomata (nem titok — a jogosultság a tárolt lista). */
export function photoSourceHash(source: string): string {
  return createHash("sha256").update(source).digest("hex").slice(0, 24);
}

/** A (b) út URL-je. Abszolút, ha van nyilvános origó: a hero-shot `file://`-ból renderel. */
export function proxiedMockPhotoUrl(artifactId: string, source: string): string {
  const base = (config.publicBaseUrl ?? "").replace(/\/+$/, "");
  return `${base}/configure/${artifactId}/photo/${photoSourceHash(source)}`;
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
 * Eldönti a http-s fotók útját. https-forrással nem foglalkozik (az már jó).
 * Költség: http-fotónként egy https-kérés a szállás SAJÁT hosztjára — $0, Places nincs.
 */
export async function planPhotoTransport(
  urls: readonly string[],
  artifactId: string,
  fetcher: PhotoFetcher = fetchPhoto,
): Promise<PhotoTransportRow[]> {
  const http = [...new Set(urls.filter(isInsecurePhotoUrl))];
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
  const rows: PhotoTransportRow[] = [];
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
): Promise<{ html: string; transport: PhotoTransportRow[] }> {
  const transport = await planPhotoTransport(photoUrls, artifactId);
  return { html: transport.length ? applyPhotoTransport(html, transport) : html, transport };
}
