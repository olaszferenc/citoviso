// Seed the ELEK-TESZT lead (ADR-0095, SCOPE.md előfeltétel) — DEV-SESSION tool,
// never run by Elek himself (his charter forbids DB writes; setup is ours).
//
// Strategy: CLONE the strongest real no_site lead so every raw field the mock
// pipeline expects is present and consistent, then (a) rename to the ELEK-TESZT
// prefix everywhere in raw, (b) rewrite every *mail* field to Elek's own
// address. Even if an email field slips through, the ElekRecipientGuard refuses
// non-elek recipients at the transport — the seed cannot make sends dangerous.
//
//   npx tsx scripts/seed-elek-lead.mts
//   npx tsx scripts/seed-elek-lead.mts --refresh-photos
//
// ── --refresh-photos: A PARK FOTÓI ELROHADNAK ────────────────────────────────
// A tárolt portál-fotó-URL nem örök: 2026-09-13-ra a hovamenjek.hu átírta a
// fájlneveit, és a fixture MIND A 13 tárolt URL-jéből 11 halott lett (a maradék
// kettő két idegen reklámbanner). Következmény mérve: a leadnek kiküldött lapon
// törött-kép ikonok, az MMS-előnézet egyáltalán nem állt elő (Elek FK-004 H1), és
// az ADR-0134 kiküldés-kapu — helyesen — meg is tagadná a jóváhagyást.
//
// ⛔ A FIXTURE-ÖN a friss begyűjtés NEM MŰKÖDIK, és ez így helyes: a lead ÁT VAN
// NEVEZVE (`ELEK-TESZT Vendégház`), ezért a portál-adatlap entitás-egyezése 0.44-en
// elbukik (név-lefedettség 0.00 — mérve). Ezt a kaput NEM lazítjuk azért, hogy egy
// teszt-rekord átmenjen rajta: pont az a dolga, hogy idegen adatlapot ne ragasszon
// egy leadhez.
// Ezért a frissítés ugyanazon az úton megy, amin a fixture SZÜLETETT: a KLÓN-FORRÁS
// valódi leadet olvassuk újra (ott a név stimmel — mérve: 4 adatlap · 11 fotó ·
// 11/11 él), és a friss fotó-anyagot ugyanazzal az átíró szabállyal (név/e-mail/
// telefon) másoljuk a fixture-be. Ami a seedben invariáns, az itt is az.

import { randomUUID } from "node:crypto";
import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { fetchPhoto } from "../src/console/photoProxy.js";
import { rescrapePhotos } from "../src/scraper/rescrapePhotos.js";

const ELEK_NAME = "ELEK-TESZT Vendégház";
const ELEK_EMAIL = "elek@citoviso.com";
const REFRESH = process.argv.includes("--refresh-photos");

const existing = await db
  .selectFrom("lead")
  .select("id")
  .where("name", "=", ELEK_NAME)
  .executeTakeFirst();
if (existing && !REFRESH) {
  console.log(`már létezik: ${ELEK_NAME} (${existing.id}) — nem duplikálok`);
  console.log("  (a park fotóinak frissítése: --refresh-photos)");
  process.exit(0);
}
if (REFRESH) {
  if (!existing) {
    console.error(`⛔ nincs ${ELEK_NAME} — előbb seedelj (kapcsoló nélkül)`);
    process.exit(1);
  }
  await refreshPhotos(existing.id);
  process.exit(0);
}

// Strongest active no_site lead — measured 2026-09-04: photo count alone picked a
// portal_only lead with NO high-band portal profile, so the marketing guard
// (rightly) flagged the generated mock as data-poor and the send gate blocked it.
// Elek's send loop needs a mock that can PASS the guards, so the clone source must
// carry verified amenities: score = high-band amenities (dominant) + photos.
const candidates = await db
  .selectFrom("lead")
  .selectAll()
  .where("qualification", "=", "no_site")
  .where("lifecycle_status", "=", "qualified")
  .execute();
interface RawProfile {
  matchBand?: string;
  amenities?: unknown[];
  photos?: unknown[];
}
const scored = candidates
  .map((l) => {
    const raw = (l.raw ?? {}) as {
      material?: { placesPhotos?: number };
      photoCount?: number;
      portalProfiles?: RawProfile[];
    };
    const high = (raw.portalProfiles ?? []).filter((p) => p.matchBand === "high");
    const amenities = high.reduce((n, p) => n + (p.amenities?.length ?? 0), 0);
    const photos =
      high.reduce((n, p) => n + (p.photos?.length ?? 0), 0) +
      (raw.material?.placesPhotos ?? raw.photoCount ?? 0);
    return { l, amenities, photos, score: amenities * 10 + photos };
  })
  .sort((a, b) => b.score - a.score);
const src = scored[0];
if (!src || src.photos < 3 || src.amenities < 5) {
  console.error("nincs high-band profilos, fotós no_site forrás-lead a klónhoz");
  process.exit(1);
}

// Deep rewrite: original name → ELEK-TESZT name in every string; *mail* keys →
// Elek's address. URLs are left alone (the exact spaced name does not occur in
// them; replace is string-exact).
function rewrite(value: unknown, origName: string): unknown {
  if (typeof value === "string") {
    return value.split(origName).join(ELEK_NAME);
  }
  // The contacts array stores identity in a {kind, value} SHAPE, not in the key
  // name — the key-based email/phone rewrite was blind to it, and a real third
  // party's email survived one seed (measured 2026-09-05). Shape-aware guard.
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const kv = value as { kind?: unknown; value?: unknown };
    if (kv.kind === "email" && typeof kv.value === "string") {
      return { ...(value as object), value: ELEK_EMAIL };
    }
    if (kv.kind === "phone" && typeof kv.value === "string") {
      return { ...(value as object), value: "" };
    }
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, origName));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (/mail/i.test(k) && typeof v === "string" && v.includes("@")) {
        out[k] = ELEK_EMAIL;
      } else if (/mail/i.test(k) && Array.isArray(v)) {
        out[k] = [ELEK_EMAIL];
      } else if (/phone|telefon/i.test(k)) {
        // The clone must NOT carry the source's real phone number: on the main
        // :4600 console (no ELEK_RUN guard) the mobile-pair button would fire a
        // REAL MMS/SMS at a stranger from the machine's SIM (Elek GYANÚ,
        // FK-004). No phone → the mobile card correctly shows "not sendable".
        out[k] = typeof v === "string" ? "" : v == null ? v : Array.isArray(v) ? [] : v;
      } else {
        out[k] = rewrite(v, origName);
      }
    }
    return out;
  }
  return value;
}

const newRaw = rewrite(src.l.raw ?? {}, src.l.name) as {
  portalProfiles?: { matchBand?: string; photos?: { vouched?: boolean }[] }[];
};
// Legacy-scraped photos predate the `vouched` flag the CURRENT ingest stamps on
// high-band listings — without it the render-time photo gate applies the strict
// 800px floor and drops every 500px portal derivative, so the mock generated
// with ZERO photos (measured 2026-09-05). Same rule, applied to the clone.
for (const p of newRaw.portalProfiles ?? []) {
  if (p.matchBand === "high") {
    for (const photo of p.photos ?? []) photo.vouched = true;
  }
}
const id = randomUUID();
await db
  .insertInto("lead")
  .values({
    id,
    scrape_run_id: src.l.scrape_run_id,
    name: ELEK_NAME,
    lat: src.l.lat,
    lng: src.l.lng,
    address: src.l.address,
    category: src.l.category,
    qualification: src.l.qualification,
    weight: src.l.weight,
    match_confidence: src.l.match_confidence,
    raw: JSON.stringify(newRaw),
    lifecycle_status: src.l.lifecycle_status,
  })
  .execute();

console.log(`ELEK-TESZT lead létrehozva: ${id}`);
console.log(
  `  forrás-klón: "${src.l.name}" (${src.amenities} igazolt szolgáltatás · ${src.photos} fotó) — név/email átírva`,
);
console.log(`  kontakt: ${ELEK_EMAIL}`);
process.exit(0);

// ── --refresh-photos ─────────────────────────────────────────────────────────

interface RawPhotos {
  portalProfiles?: { matchBand?: string; photos?: { url: string; vouched?: boolean }[] }[];
  listings?: unknown;
  material?: unknown;
}

function photoUrls(raw: RawPhotos): string[] {
  return (raw.portalProfiles ?? []).flatMap((p) => (p.photos ?? []).map((x) => x.url));
}

/** Hány URL él MA? A mérés ugyanazzal a lekérővel megy, amit a kapu és a konzol használ. */
async function liveCount(urls: readonly string[]): Promise<number> {
  let live = 0;
  for (const u of urls) {
    if ((await fetchPhoto(u)).ok) live++;
    await new Promise((r) => setTimeout(r, 350)); // udvariasság: sorosított, szünetes
  }
  return live;
}

async function refreshPhotos(fixtureId: string): Promise<void> {
  const fixture = await db
    .selectFrom("lead")
    .select(["id", "name", "lat", "lng", "raw"])
    .where("id", "=", fixtureId)
    .executeTakeFirst();
  if (!fixture) throw new Error("nincs fixture-lead");
  const fixtureRaw = (
    typeof fixture.raw === "string" ? JSON.parse(fixture.raw) : fixture.raw
  ) as RawPhotos & Record<string, unknown>;

  const beforeUrls = photoUrls(fixtureRaw);
  const beforeLive = await liveCount(beforeUrls);
  console.log(`fixture ELŐTTE: ${beforeUrls.length} fotó-URL, ebből ÉL ${beforeLive}`);

  // A KLÓN-FORRÁS: a seed a koordinátát VERBATIM másolja, tehát az egyezés pontos.
  // Ha nem pontosan egy találat van, HANGOSAN állunk meg — egy rossz forrásból
  // frissíteni annyi, mint idegen szállás fotóit tenni a fixture-be.
  const sources = await db
    .selectFrom("lead")
    .select(["id", "name"])
    .where("lat", "=", fixture.lat)
    .where("lng", "=", fixture.lng)
    .where("id", "!=", fixture.id)
    .execute();
  if (sources.length !== 1) {
    console.error(
      `⛔ a klón-forrás nem egyértelmű (${sources.length} találat azonos koordinátán): ` +
        sources.map((s) => `${s.name} (${s.id})`).join(" · "),
    );
    process.exit(1);
  }
  const source = sources[0]!;
  console.log(`klón-forrás: "${source.name}" (${source.id})`);

  // A valódi leaden a név egyezik, tehát a portál-adatlap entitás-kapuja átengedi.
  const r = await rescrapePhotos(source.id);
  console.log(`  forrás újra-scrape: ${r.message}`);

  const srcRow = await db
    .selectFrom("lead")
    .select(["name", "raw"])
    .where("id", "=", source.id)
    .executeTakeFirst();
  const srcRaw = (
    typeof srcRow!.raw === "string" ? JSON.parse(srcRow!.raw) : srcRow!.raw
  ) as RawPhotos;

  // UGYANAZ az átíró szabály, mint a seedben: név → ELEK-TESZT, *mail* → elek@,
  // telefon KIÜRÍTVE (különben a mobil-páros gomb egy idegen számra élesedne).
  const moved = rewrite(
    {
      portalProfiles: srcRaw.portalProfiles ?? [],
      listings: srcRaw.listings ?? [],
      material: srcRaw.material ?? {},
    },
    srcRow!.name,
  ) as RawPhotos;
  // A seed `vouched`-szabálya is ugyanaz: high sávú adatlap fotói igazoltak, különben
  // a render-kori 800px-es küszöb az összes 500px-es portál-derivátumot eldobná.
  for (const p of moved.portalProfiles ?? []) {
    if (p.matchBand === "high") for (const photo of p.photos ?? []) photo.vouched = true;
  }

  const afterUrls = photoUrls(moved);
  const afterLive = await liveCount(afterUrls);
  console.log(`fixture UTÁNA:  ${afterUrls.length} fotó-URL, ebből ÉL ${afterLive}`);
  if (!afterLive) {
    console.error("⛔ a friss halmazban sincs ÉLŐ fotó — nem írom felül a fixture-t");
    process.exit(1);
  }

  const merged = { ...fixtureRaw, ...moved };
  await db
    .updateTable("lead")
    .set({ raw: sql`${JSON.stringify(merged)}::jsonb` })
    .where("id", "=", fixture.id)
    .execute();
  console.log(
    `✅ fixture fotói frissítve: ${beforeUrls.length} (${beforeLive} élő) → ${afterUrls.length} (${afterLive} élő)`,
  );
  console.log("   következő lépés: a mock ÚJRAGENERÁLÁSA (a régi HTML még a halott URL-eket hordozza)");
}
