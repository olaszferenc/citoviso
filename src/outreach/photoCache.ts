// LEMEZ-CACHE a pillanatkép-renderelés forrásképeihez.
//
// ⛔⛔ MÉRT PAZARLÁS (2026-09-22). Egy lead 19 mock-változata UGYANAZT a 24 portál-fotót
// hordozza, és minden pillanatkép-render MINDET újra lekérte a forrás-portálról:
// 19 × 24 = 456 kérés ugyanarra a hostra, amiből 432 fölösleges ismétlés. Mivel a
// politeness-doktrína hostonként EGY kérést enged egyszerre, 500 ms szünettel, ez
// rendernként ~12 s puszta várakozás — és pontosan az a burst-minta, amiért a
// lake-balaton.com egyszer 429-cel válaszolt, és egy ÜRES képű MMS ment ki (2026-08-30).
//
// A cache ezt 456 → 24-re viszi: az első render letölti és lemezre teszi, a többi 18
// onnan eszik. A mock HTML-hez nem kell nyúlni — a kiszolgálás a Playwright
// `route.fulfill()`-jén történik, tehát a lap ugyanazt az URL-t kéri, mint élesben.
//
// ⚠️ A CACHE NEM ÖRÖK. A portál ÁTNEVEZI a fájlokat, amikor cserél (mérve: 73 URL-ből
// 59 lett 404 egy átnevezés után) — tehát egy ÉLŐ URL tartalma stabil, a csere új URL-t
// hoz. A TTL így nem a helyesség, hanem a takarítás miatt kell: egy hét után a bejegyzés
// elévül, és a következő render újra lehúzza.
//
// ⛔ Amit NEM cache-elünk: hibás válasz (nem 200), nem-kép tartalom, üres vagy
// gyanúsan nagy fájl. Egy 404-es HTML-t elmenteni annyi, mint a hibát BEFAGYASZTANI —
// a 2026-09-18-i lecke: egy pillanatnyi kimaradásra épített javítás 45 élő fotót írt 0-ra.

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const CACHE_DIR = path.resolve(process.cwd(), "sites/_outreach-shots/_photos");

/** Egy hét: a takarítás mértéke, nem a helyességé (lásd a fejléc-kommentet). */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** 8 MB fölött nem cache-elünk — az már nem szállásfotó, és a lemezt sem hizlaljuk. */
const MAX_BYTES = 8 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export interface PhotoCacheStats {
  /** Lemezről kiszolgált kérés — ennyivel NEM terheltük a portált. */
  hits: number;
  /** Hálózatról hozott kérés. */
  misses: number;
  /** Ebből ténylegesen el is mentettük (a hibás/nem-kép válaszokat nem). */
  stored: number;
}

export interface PhotoCache {
  /** A cache-elt fájl elérési útja, ha van ÉS friss — különben null. */
  read(url: string): Promise<{ body: Buffer; contentType: string } | null>;
  /** Elmenti, ha a válasz cache-elhető. A döntést KIMONDJA a visszatérési érték. */
  write(url: string, body: Buffer, contentType: string): Promise<boolean>;
  hit(): void;
  miss(): void;
  stats(): PhotoCacheStats;
}

function keyFor(url: string, ext: string): string {
  const h = createHash("sha1").update(url).digest("hex");
  return path.join(CACHE_DIR, `${h}.${ext}`);
}

/** Melyik kiterjesztéssel KERESSÜK: a mentéskori mime-ot olvasáskor nem ismerjük, ezért
 *  mindet végigpróbáljuk — az URL saját kiterjesztésével kezdve (az a tipikus találat). */
function candidates(url: string): string[] {
  const exts = Object.keys(MIME_BY_EXT);
  const guess = /\.([a-z0-9]{3,4})(?:$|\?)/i.exec(url)?.[1]?.toLowerCase();
  const ordered = guess && exts.includes(guess) ? [guess, ...exts.filter((e) => e !== guess)] : exts;
  return ordered.map((ext) => keyFor(url, ext));
}

export function createPhotoCache(): PhotoCache {
  const s: PhotoCacheStats = { hits: 0, misses: 0, stored: 0 };
  return {
    async read(url) {
      for (const file of candidates(url)) {
        try {
          const st = await stat(file);
          if (Date.now() - st.mtimeMs > TTL_MS) continue; // elévült — hozza újra
          if (!st.size) continue;
          const ext = path.extname(file).slice(1);
          return { body: await readFile(file), contentType: MIME_BY_EXT[ext] ?? "image/jpeg" };
        } catch {
          // nincs ilyen fájl ezzel a kiterjesztéssel — próbáljuk a következőt
        }
      }
      return null;
    },
    async write(url, body, contentType) {
      const mime = contentType.split(";")[0]!.trim().toLowerCase();
      const ext = EXT_BY_MIME[mime];
      if (!ext) return false; // nem kép (pl. egy 404-es HTML) — NEM fagyasztjuk be
      if (!body.length || body.length > MAX_BYTES) return false;
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(keyFor(url, ext), body);
      s.stored++;
      return true;
    },
    hit() {
      s.hits++;
    },
    miss() {
      s.misses++;
    },
    stats() {
      return { ...s };
    },
  };
}
