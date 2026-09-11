// ŐR: nem mehet ki MÁS CÉG HIRDETÉSE a szállás fotójaként.
//
// Miért a KISZÁLLÍTOTT fájlon mér, és nem fixture-ön:
// 2026-09-11-én a `photo-quality-check.mts` ZÖLD volt erre az esetre — szó szerint ezzel a
// szöveggel: "vouched, de IDEGEN DOMAIN képe a galériában (Mirabella-banner)". A kép mégis
// kiment. A fixture ugyanis `portalHost: "szalas.hu"`-t adott a balaton.hu-s képhez (egy
// szalas.hu-s adatlapba ágyazott idegen banner), a VALÓS adatban viszont a profil MAGÁRÓL a
// balaton.hu-ról jött, tehát kép-host === portál-host → a cross-site szabály szerkezetileg
// nem tud tüzelni. A teszt a saját forgatókönyvére igaz volt, csak az sosem állt elő.
//
// Tanulság, amit ez az őr testesít meg: a kapu ott mérjen, AHOL AZ ADAT TÉNYLEG KIMEGY —
// a `sites/**` alatti HTML-en, amit a vendég és a Google olvas. Nem a szabályt hisszük el,
// hanem a kimenetet nézzük meg.
//
// Futtatás:  npx tsx scripts/ad-banner-render-check.mts
// Negatív önteszt beépítve: ha a detektor nem tud pirosra menni, az őr semmit nem ér.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "../src/db/client.js";
import { photoUrlKey } from "../src/generator/heroPick.js";

/** Amit a lapon MEGJELENVE sosem fogadunk el — a heroPick NEVER_SHOWN halmaza. */
const NEVER_SHOWN_SUBJECTS = ["ad_banner"];

const SITES_DIR = path.resolve(process.cwd(), "sites");

/** Minden HTML a kiszállított fában (fő lap, nyelvi változatok, egység-aloldalak). */
async function deliveredHtmlFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await deliveredHtmlFiles(full)));
    else if (e.name.endsWith(".html")) out.push(full);
  }
  return out;
}

/**
 * MINDEN kép-URL a lapról, ahány csatornán csak kimehet. A hiba két helyen ült (galéria +
 * JSON-LD), de a fotó-halmaz ennél több felületre folyik be — a szűk kereső itt pont azt a
 * hamis zöldet termelné, ami ezt a hibát szülte.
 */
function imageUrlsIn(html: string): { url: string; where: string }[] {
  const found: { url: string; where: string }[] = [];
  const push = (url: string, where: string) => {
    const u = url.trim().replace(/&amp;/g, "&");
    if (/^https?:\/\//i.test(u)) found.push({ url: u, where });
  };

  for (const m of html.matchAll(/<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)) push(m[1]!, "galéria <img src>");
  for (const m of html.matchAll(/\ssrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const cand of m[1]!.split(",")) push(cand.trim().split(/\s+/)[0]!, "srcset");
  }
  for (const m of html.matchAll(/<meta\b[^>]*?(?:property|name)\s*=\s*["'][^"']*image[^"']*["'][^>]*?\scontent\s*=\s*["']([^"']+)["']/gi)) {
    push(m[1]!, "meta og:image/twitter:image");
  }
  for (const m of html.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) push(m[1]!, "CSS background url()");

  // JSON-LD: a strukturált adat a GOOGLE-nek szóló állítás a szállásról.
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const walk = (node: unknown): void => {
      if (typeof node === "string") {
        if (/^https?:\/\//i.test(node)) push(node, "JSON-LD image");
      } else if (Array.isArray(node)) node.forEach(walk);
      else if (node && typeof node === "object") {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          if (/^(image|logo|photo|thumbnailUrl)$/i.test(k)) walk(v);
          else if (v && typeof v === "object") walk(v);
        }
      }
    };
    try {
      walk(JSON.parse(m[1]!));
    } catch {
      // A törött JSON-LD nem ennek az őrnek a dolga — a nyers URL-eket akkor is megnézzük.
      for (const u of m[1]!.matchAll(/https?:\/\/[^"'\s\\]+/g)) push(u[0], "JSON-LD (nyers)");
    }
  }
  return found;
}

async function main(): Promise<void> {
  const banned = await db
    .selectFrom("photo_hero_score")
    .select(["url_key", "subject", "reason"])
    .where("subject", "in", NEVER_SHOWN_SUBJECTS)
    .execute();
  const bannedByKey = new Map(banned.map((r) => [r.url_key, r]));

  console.log(`ŐR: idegen hirdetés a kiszállított lapon`);
  console.log(`  tiltott (látás-ítélet ${NEVER_SHOWN_SUBJECTS.join("/")}): ${bannedByKey.size} kép-URL`);

  // ── NEGATÍV ÖNTESZT: a detektornak BIZONYÍTANIA kell, hogy tud pirosra menni. Egy üres
  // korpuszon minden őr zöld — az a hamis zöld, ami ezt a hibát kitermelte.
  const probe = "https://balaton.hu/wp-content/uploads/2021/05/MIR_640_360.png";
  const probeHtml =
    `<img src="${probe}" alt="x">` +
    `<script type="application/ld+json">{"@type":"Hotel","image":["${probe}"]}</script>`;
  const probeHits = imageUrlsIn(probeHtml);
  const probeOk =
    probeHits.some((h) => h.where.startsWith("galéria")) && probeHits.some((h) => h.where.startsWith("JSON-LD"));
  if (!probeOk) {
    console.error(`  ✖ ÖNTESZT BUKOTT: a kivonat nem találja meg a képet a saját próba-HTML-ben.`);
    console.error(`    Az őr ilyenkor VAK — a zöld eredménye semmit nem jelentene.`);
    await db.destroy();
    process.exit(1);
  }
  console.log(`  ✅ önteszt: a kivonat galériából ÉS JSON-LD-ből is kiolvassa a képet`);

  const files = await deliveredHtmlFiles(SITES_DIR);
  console.log(`  vizsgált kiszállított HTML: ${files.length} db\n`);

  let violations = 0;
  let scannedImages = 0;
  // Csatornánkénti számláló: bizonyítja, hogy az őr NEM üres halmazon zöld. Egy kereső,
  // ami történetesen egyetlen JSON-LD-t sem talál, ugyanúgy "✅"-t írna ki — és pont a
  // JSON-LD volt a hiba egyik fele.
  const perChannel = new Map<string, number>();
  for (const file of files) {
    const html = await readFile(file, "utf8");
    const hits = imageUrlsIn(html);
    scannedImages += hits.length;
    for (const h of hits) perChannel.set(h.where, (perChannel.get(h.where) ?? 0) + 1);
    const bad = new Map<string, string[]>();
    for (const h of hits) {
      const row = bannedByKey.get(photoUrlKey(h.url));
      if (!row) continue;
      const list = bad.get(h.url) ?? [];
      if (!list.includes(h.where)) list.push(h.where);
      bad.set(h.url, list);
    }
    for (const [url, wheres] of bad) {
      violations++;
      const row = bannedByKey.get(photoUrlKey(url))!;
      console.error(`  ✖ ${path.relative(process.cwd(), file)}`);
      console.error(`      ${url}`);
      console.error(`      ítélet: ${row.subject} — ${row.reason}`);
      console.error(`      megjelenik itt: ${wheres.join(", ")}`);
    }
  }

  console.log(`  átvizsgált kép-hivatkozás: ${scannedImages}`);
  for (const [where, n] of [...perChannel].sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(n).padStart(5)} · ${where}`);
  }
  // A galéria és a JSON-LD volt a KÉT hely, ahol a banner ült. Ha az egyiket sem látjuk a
  // korpuszban, az őr vak — és a zöldje semmit nem bizonyít.
  const sawGallery = [...perChannel.keys()].some((k) => k.startsWith("galéria"));
  const sawJsonLd = [...perChannel.keys()].some((k) => k.startsWith("JSON-LD"));
  if (!sawGallery || !sawJsonLd) {
    console.error(
      `\n⛔ BUKÓ: az őr nem talált ${!sawGallery ? "galéria-képet" : "JSON-LD image-et"} a kiszállított lapokon — ` +
        `így a "nincs hirdetés" állítás megalapozatlan.`,
    );
    await db.destroy();
    process.exit(1);
  }
  if (violations) {
    console.error(`\n⛔ BUKÓ: ${violations} helyen megy ki más cég hirdetése a szállás képeként.`);
    await db.destroy();
    process.exit(1);
  }
  console.log(`\n✅ Egyetlen kiszállított lapon sincs hirdetésnek ítélt kép.`);
  await db.destroy();
}

await main();
