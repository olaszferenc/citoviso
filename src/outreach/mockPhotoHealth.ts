// A KISZÁLLÍTOTT MOCK KÉP-EGÉSZSÉGE — a KIKÜLDÉS kapuja (ADR-0134).
//
// ⛔⛔ MÉRT HIBA (2026-09-13, Elek FK-003b L01): a kurátor-lap SAJÁT piros sávja
// kimondta, hogy „4 kép forrása nem érhető el — ezek a képek a LEADNEK kiküldött
// lapon is törötten jelennek meg", a nyitókép-választó mind a négy csempéje „nincs
// kép / 404-et ad" volt, az őr-pirula „nem ítélhető" — és a „Jóváhagyás" gomb
// ennek ellenére AKADÁLYTALANUL átment, a visszaigazolás egy szót sem szólt a
// képekről, majd a felület azonnal felkínálta a leadnek küldhető követett linket.
// A rendszer TUDTA, hogy törött, és mégis engedte kiküldésre.
//
// A mért ok NEM a mi oldalunkon volt (2026-09-13, curl, bot-UA-val és böngésző-UA
// + referer-rel is): a hovamenjek.hu letörölte az `upload/places/…` fotóit — 8/8
// mintavett URL 404. ⚠️ EBBŐL ELŐSZÖR AZT VONTAM LE, hogy „megszűnt a séma" — a
// TELJES mérés (mind a 73 tárolt hovamenjek-URL) ezt megcáfolta: 59 halott / 14 élő,
// 11 leadet érint, ebből 8-nál MIND. A portál nem szűnt meg: az ADATLAPOK ÉLNEK, csak
// a fájlneveket írták át, ezért a TÁROLT URL rohad el. Friss begyűjtéssel visszajönnek
// (a valódi leaden mérve: 4 adatlap · 11 fotó, high sáv).
// ⚠️ A KAPU ettől még kell: a tárolt URL bármikor elrohadhat, és a kurátor nem a
// scraper naplójából tudja meg, hanem abból, hogy mi megy ki a leadhez.
//
// AMIT EZ A MODUL MÉR: a LEMEZEN LÉVŐ, RENDERELT artefaktumot (`mock_artifact.path`)
// — azt a fájlt, amit a lead a `/mock/<id>` és a `/p/<token>` útján megkap. NEM a
// `inputs.siteData.photos` listát: az a generálás BEMENETE, és a ház visszatérő
// hibamintája éppen az, hogy a kapu a fixture-ön mér, nem azon az úton, amin az
// adat tényleg kimegy. (A `photo-health` végpont eddig pontosan ezt a bemeneti
// listát mérte, miközben a mondata a KISZÁLLÍTOTT lapról állított valamit.)
//
// ⚠️ A TÉVES PIROS DRÁGA: egy hamisan „töröttnek" mért kép a FIZETNI AKARÓ vevő
// megkeresését állítaná meg. Ezért a 429/hálózati hiba NEM azonnal verdikt —
// gazdagépenként sorosítunk (a portál a 12 párhuzamos kérésre ad 429-et, l.
// heroShot), és egy udvarias szünet után újrapróbáljuk. A 404/410 viszont NEM
// múlandó: azt nem próbáljuk újra.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { sql } from "kysely";

import { db } from "../db/client.js";
import { T } from "../i18n/mail.js";
// A MÉRÉS EGY FORRÁSBÓL: ugyanaz a `fetchPhoto` (és ugyanaz a cache) dönt itt, mint
// amit a konzol kép-proxyja kiszolgál — vagyis amit a kurátor csempéjén LÁT, és amit
// ez a kapu MÉR, nem térhet el. Két külön lekérő két igazságot adna egy képernyőn.
import { fetchPhoto, photoFailReason, photoKey } from "../console/photoProxy.js";

/** Egy kép-hivatkozás a renderelt lapon. */
export interface ImageRef {
  readonly url: string;
  /** Hol hivatkozik rá a lap — az operátornak mondjuk meg, ne csak az URL-t. */
  readonly where: "img" | "srcset" | "background" | "preload" | "meta";
  /** Hányszor szerepel (ugyanaz a fotó gyakran hero + galéria + JSON-LD). */
  readonly refs: number;
}

export interface BrokenImage {
  readonly url: string;
  readonly reason: string;
  readonly where: ImageRef["where"];
  readonly refs: number;
}

export type MockPhotoVerdict = "ok" | "broken" | "unknown";

export interface MockPhotoHealth {
  readonly artifactId: string;
  readonly verdict: MockPhotoVerdict;
  /** Hány TÁVOLI (http/https) képet mértünk meg. */
  readonly checked: number;
  /** Hány kép-hivatkozást NEM mértünk (relatív út, data:, blob:) — §B.17: csak arról
   *  állítunk, amit megmértünk. */
  readonly unmeasured: number;
  readonly broken: readonly BrokenImage[];
  /** Miért `unknown` (hiányzó fájl, olvasási hiba) — az operátornak szánt mondat. */
  readonly note?: string;
}

/** A kurátor tudomásul vette, hogy ezekkel a törött képekkel megy ki a lap. */
export interface BrokenPhotoAck {
  readonly at: string;
  readonly by: string;
  readonly urls: readonly string[];
}

/** Egyszerre ennyi távoli kép-lekérés fut (a cache miatt a legtöbb amúgy sem hálózat). */
const CONCURRENCY = 4;
/** Gazdagépenként ennyit várunk két kérés KÖZÖTT — a 429-et a burst termeli, nem a kérés. */
const HOST_GAP_MS = 350;
/** A múlandónak látszó hibát EGYSZER újrapróbáljuk, ennyi szünet után. */
const RETRY_PAUSE_MS = 1500;

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 404/410 = a forrás letörölte. Ez nem múlik el egy szünettől, nincs újrapróba. */
function isPermanent(failure: string | undefined): boolean {
  return failure === "notfound" || failure === "nonimage";
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/**
 * MINDEN kép-hivatkozás a RENDERELT lapról, amit a böngésző letölteni próbál.
 *
 * ⚠️ Ez a függvény az őr VIZSGÁLT ALANYA, ezért az őr NEM ezzel méri magát: a
 * `mock-photo-gate-check.mts` valódi Chromiumban rendereli ugyanazt a lapot, és a
 * böngésző által TÉNYLEGESEN lekért kép-URL-eket veti össze ezzel a listával —
 * független referencia, különben egy vak kivonat önmagát igazolná zöldre.
 */
export function extractImageRefs(html: string): ImageRef[] {
  const found = new Map<string, { where: ImageRef["where"]; refs: number }>();
  const add = (raw: string | undefined, where: ImageRef["where"]): void => {
    const url = (raw ?? "").trim().replace(/&amp;/g, "&");
    if (!url) return;
    const prev = found.get(url);
    // Az ERŐSEBB hivatkozás-típus nyer: ami `<img>`-ként is szerepel, az kép a lapon,
    // akkor is, ha előbb egy meta-tagben találtuk meg.
    if (prev) {
      found.set(url, { where: prev.where === "img" ? "img" : where, refs: prev.refs + 1 });
      return;
    }
    found.set(url, { where, refs: 1 });
  };
  const fromSrcset = (srcset: string | undefined, where: ImageRef["where"]): void => {
    for (const part of (srcset ?? "").split(",")) {
      add(part.trim().split(/\s+/)[0], where);
    }
  };
  const attr = (tag: string, name: string): string | undefined =>
    new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    add(attr(m[0], "src"), "img");
    fromSrcset(attr(m[0], "srcset"), "img");
  }
  for (const m of html.matchAll(/<source\b[^>]*>/gi)) {
    add(attr(m[0], "src"), "srcset");
    fromSrcset(attr(m[0], "srcset"), "srcset");
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    if (/\brel\s*=\s*["']?preload/i.test(m[0]) && /\bas\s*=\s*["']?image/i.test(m[0])) {
      add(attr(m[0], "href"), "preload");
      fromSrcset(attr(m[0], "imagesrcset"), "preload");
    }
  }
  // og:image / twitter:image — nem a lapon látszik, hanem a MEGOSZTÁS előnézetében;
  // egy törött og:image ugyanúgy a mi nevünkben néz ki rosszul.
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (/\b(?:property|name)\s*=\s*["'](?:og:image[^"']*|twitter:image[^"']*)["']/i.test(m[0])) {
      add(attr(m[0], "content"), "meta");
    }
  }
  // Háttérképek: inline `style="…"` ÉS `<style>` blokk egyaránt. A `background`
  // rövidítés is ide tartozik; a `@font-face` url() viszont NEM kép — ezért csak a
  // background-deklarációkból veszünk url()-t.
  for (const m of html.matchAll(/background(?:-image)?\s*:[^;{}"']*?url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    add(m[1], "background");
  }

  return [...found.entries()].map(([url, v]) => ({ url, where: v.where, refs: v.refs }));
}

/** Csak a TÁVOLI képet tudjuk lekérni; a relatív út a kiszolgáló hosztjához kötődik. */
function isRemote(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

/**
 * Megméri a kép-hivatkozásokat — gazdagépenként sorosítva, egy udvarias újrapróbával
 * a múlandónak látszó hibákra.
 */
export async function probeImageRefs(
  refs: readonly ImageRef[],
  lang: string,
): Promise<BrokenImage[]> {
  const remote = refs.filter((r) => isRemote(r.url));
  const broken: BrokenImage[] = [];
  const hostTail = new Map<string, Promise<void>>();

  const measure = async (ref: ImageRef): Promise<void> => {
    const host = hostOf(ref.url);
    // Sorosítás gazdagépenként: a következő kérés megvárja az előzőt + a szünetet.
    const prev = hostTail.get(host) ?? Promise.resolve();
    let release = (): void => {};
    hostTail.set(host, new Promise<void>((r) => (release = r)));
    await prev;
    try {
      let v = await fetchPhoto(ref.url);
      if (!v.ok && !isPermanent(v.failure)) {
        await sleep(RETRY_PAUSE_MS);
        v = await fetchPhoto(ref.url);
      }
      if (!v.ok) {
        broken.push({
          url: ref.url,
          reason: photoFailReason(v, lang, host),
          where: ref.where,
          refs: ref.refs,
        });
      }
    } finally {
      await sleep(HOST_GAP_MS);
      release();
    }
  };

  const queue = [...remote];
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) await measure(next);
  });
  await Promise.all(workers);
  // Determinisztikus sorrend: a lista ugyanazt mondja két futás között.
  broken.sort((a, b) => a.url.localeCompare(b.url));
  return broken;
}

/**
 * A KISZÁLLÍTOTT lap kép-egészsége. `unknown` = nem tudtuk megnézni (hiányzó fájl) —
 * és az ellenőrizetlen mock ugyanúgy nem mehet ki, mint a törött (a ház meglévő
 * szabálya a generáláskori őr-verdiktekre: „ellenőrizetlen mock nem küldhető").
 */
export async function assessMockPhotos(artifactId: string, lang = "hu"): Promise<MockPhotoHealth> {
  const empty = { artifactId, checked: 0, unmeasured: 0, broken: [] as BrokenImage[] };
  let file: string;
  try {
    const a = await db
      .selectFrom("mock_artifact")
      .select("path")
      .where("id", "=", artifactId)
      .executeTakeFirst();
    if (!a?.path) {
      return {
        ...empty,
        verdict: "unknown",
        note: T(lang, "Ehhez a mockhoz nincs renderelt fájl — nincs mit megnézni."),
      };
    }
    file = path.resolve(process.cwd(), a.path);
  } catch (e) {
    return { ...empty, verdict: "unknown", note: (e as Error).message.slice(0, 200) };
  }

  let html: string;
  try {
    html = await readFile(file, "utf8");
  } catch {
    return {
      ...empty,
      verdict: "unknown",
      note: T(lang, "A mock renderelt fájlja nincs meg a lemezen — a képei nem ellenőrizhetők."),
    };
  }

  const refs = extractImageRefs(html);
  const remote = refs.filter((r) => isRemote(r.url));
  const broken = await probeImageRefs(refs, lang);
  return {
    artifactId,
    verdict: broken.length ? "broken" : "ok",
    checked: remote.length,
    unmeasured: refs.length - remote.length,
    broken,
  };
}

/**
 * A kurátor tudomásulvétele. NEM a `curator_decision.notes`-ba megy: az a mező az
 * operátor szeme előtt jelenik meg a mock-kártyán, és egy nyers gépi jelölő ott
 * pontosan az a „gépi szöveg az operátornak", amit a legutóbbi kör leletezett.
 * Az artefaktum `inputs`-a viszont amúgy is a mock gépi kísérője, és a kártya
 * kiírásából az objektum-értékek ki vannak szűrve.
 */
export async function recordBrokenPhotoAck(
  artifactId: string,
  urls: readonly string[],
  by: string,
  now = new Date(),
): Promise<void> {
  const ack: BrokenPhotoAck = { at: now.toISOString(), by, urls: [...urls].sort() };
  // Célzott `jsonb_set`, nem olvasás-módosítás-visszaírás: az `inputs`-ba a
  // nyitókép-felülbírálás is ír (`heroOverride`), és egy teljes objektum-visszaírás
  // elnyelné a közben született `siteData`-t.
  await db
    .updateTable("mock_artifact")
    .set({
      inputs: sql`jsonb_set(coalesce(inputs, '{}'::jsonb), '{brokenPhotoAck}', ${JSON.stringify(
        ack,
      )}::jsonb, true)` as never,
    })
    .where("id", "=", artifactId)
    .execute();
}

export function brokenPhotoAckOf(inputs: unknown): BrokenPhotoAck | null {
  const ack = (inputs as { brokenPhotoAck?: BrokenPhotoAck } | null)?.brokenPhotoAck;
  return ack && Array.isArray(ack.urls) ? ack : null;
}

/**
 * Fedezi-e a korábbi tudomásulvétel a MOSTANI törést?
 *
 * ⛔ Nem elég, hogy „valamit már tudomásul vett": a lap a jóváhagyás ÓTA tovább
 * romolhat (a portál a következő képet is letörli). Amit a kurátor látott, az egy
 * NÉVSOR volt — ha új név kerül a listára, arról nem döntött.
 */
export function ackCoversBroken(ack: BrokenPhotoAck | null, broken: readonly BrokenImage[]): boolean {
  if (!ack) return false;
  const known = new Set(ack.urls.map((u) => photoKey(u)));
  return broken.every((b) => known.has(photoKey(b.url)));
}

/**
 * EGY PREDIKÁTUM dönt minden kapun (jóváhagyás · követett link · levél · SMS):
 * mehet-e ki ez a mock. Három példányban három igazság lenne egy képernyőn.
 *
 * ⛔ Az `unknown` (nincs renderelt fájl) NEM tudomásul vehető: ott nem törött kép
 * van, hanem NINCS mit kiküldeni — a lead linkje üres lapra vinne. Azt generálni
 * kell újra, nem lenyugtázni. (Enélkül az üres `broken` tömbön az `every` igazat
 * adna, és egy régi pipa átengedné a fájl nélküli mockot.)
 */
export function photoGateBlocks(health: MockPhotoHealth, ack: BrokenPhotoAck | null): boolean {
  if (health.verdict === "ok") return false;
  if (health.verdict === "unknown") return true;
  return !ackCoversBroken(ack, health.broken);
}

/** Egy mondat az operátornak: mi a baj, és mi a következménye. */
export function brokenPhotoSentence(health: MockPhotoHealth, lang = "hu"): string {
  if (health.verdict === "unknown") {
    return health.note ?? T(lang, "A mock képei nem ellenőrizhetők.");
  }
  const n = health.broken.length;
  return n === 1
    ? T(lang, "1 kép forrása nem érhető el — ez a kép a LEADNEK kiküldött lapon is törött lesz.")
    : T(lang, "{n} kép forrása nem érhető el — ezek a képek a LEADNEK kiküldött lapon is törötten jelennek meg.", {
        n: String(n),
      });
}
