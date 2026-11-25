// ONE-TIME BACKFILL of the town picture sets (owner 2026-11-25, ADR-XXXX, plan kepnelkuli-hero):
// the towns of the e-mail leads with no / few own photos, most such leads first. Dev DB by default —
// on the live box only at the owner's word. The scrape chain and the mock generation gather new towns
// themselves afterwards; this is no manual step of the process.
//
//   npx tsx scripts/town-photo-sets.mts [--top 500] [--country HU] [--town "Makarska:HR"]… [--redo] [--dry]
//   npx tsx scripts/town-photo-sets.mts --restyle   (only the sample-room style of the stored sets)
//
// Prints per town the tier, the hero / gallery counts and the time, and at the end the measured cost:
// API calls, downloaded bytes, CLIP runs, seconds — and $0 (no paid call exists on this path).

import { db } from "../src/db/client.js";
import { ensureTownPhotoSet, isCurrentPick, readTownPhotoSet, townsInNeed } from "../src/media/townPhotoSet.js";
import { townStyleOf } from "../src/media/townPick.js";
import { langForCountry } from "../src/i18n/lang.js";

const args = process.argv.slice(2);
const val = (k: string): string | undefined => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};
const all = (k: string): string[] => args.flatMap((a, i) => (a === k && args[i + 1] ? [args[i + 1]!] : []));
const top = Number(val("--top") ?? "500");
const country = val("--country");
const redo = args.includes("--redo");
const dry = args.includes("--dry");

if (args.includes("--restyle")) {
  // Recompute only the sample-room style of the stored sets (the style rule changed; no picture is re-picked).
  const rows = await db.selectFrom("town_photo_set").select(["country", "city_key", "city", "lat", "lon", "stats", "style"]).execute();
  for (const r of rows) {
    if (r.lat == null || r.lon == null) continue;
    const wd = (r.stats as { wikidata?: string }).wikidata;
    const style = await townStyleOf({ city: r.city, country: r.country, lat: r.lat, lon: r.lon, lang: langForCountry(r.country) ?? "en" }, wd);
    if (style !== r.style) await db.updateTable("town_photo_set").set({ style }).where("country", "=", r.country).where("city_key", "=", r.city_key).execute();
    console.log(`${r.city}: ${r.style} → ${style}`);
  }
  process.exit(0);
}

const needed = await townsInNeed({ ...(country ? { country } : {}) });
const named = all("--town").map((s) => {
  const [city, cc] = s.split(":");
  return { city: city!, country: (cc ?? "HU").toUpperCase() };
});
const list = [
  ...needed.slice(0, top),
  ...named.flatMap((n) => {
    const hit = needed.find((t) => t.country === n.country && t.city.toLowerCase() === n.city.toLowerCase());
    if (!hit) console.log(`! ${n.city} (${n.country}): nincs e-mailes, kép nélküli lead ezen a településen — kihagyva (csak ott gyűjtünk)`);
    return hit && !needed.slice(0, top).includes(hit) ? [hit] : [];
  }),
];
console.log(`${needed.length} település vár képre (e-mailes, kép nélküli / kevés képes lead); most: ${list.length}`);
if (dry) {
  for (const t of list) console.log(`  ${t.leads}\t${t.city} (${t.country})`);
  process.exit(0);
}

const sum = { towns: 0, town: 0, land: 0, region: 0, none: 0, apiCalls: 0, bytes: 0, clipRuns: 0, seconds: 0, heroes: 0, gallery: 0 };
const t0 = Date.now();
for (const t of list) {
  const have = await readTownPhotoSet(t.country, t.city);
  if (have && isCurrentPick(have) && !redo) {
    console.log(`= ${t.city}: megvan (${have.tier})`);
    continue;
  }
  if (redo && have) await db.deleteFrom("town_photo_set").where("country", "=", have.country).where("city_key", "=", have.cityKey).execute();
  const set = await ensureTownPhotoSet(t, "backfill").catch((e: Error) => {
    console.log(`✗ ${t.city}: ${e.message}`);
    return null;
  });
  if (!set) continue;
  const row = await db.selectFrom("town_photo_set").select("stats").where("country", "=", set.country).where("city_key", "=", set.cityKey).executeTakeFirst();
  const st = (row?.stats ?? {}) as { apiCalls?: number; bytes?: number; clipRuns?: number; seconds?: number };
  sum.towns++;
  sum[set.tier]++;
  sum.apiCalls += st.apiCalls ?? 0;
  sum.bytes += st.bytes ?? 0;
  sum.clipRuns += st.clipRuns ?? 0;
  sum.seconds += st.seconds ?? 0;
  sum.heroes += set.heroes.length;
  sum.gallery += set.gallery.length;
  console.log(`✓ ${t.city} (${t.country}, ${t.leads} lead): ${set.tier} · ${set.heroes.length} hero · ${set.gallery.length} galéria · ${set.style} · ${st.seconds ?? "?"} s`);
}
console.log(
  `\nÖSSZESEN ${sum.towns} település: saját kép ${sum.town} · környék ${sum.land} · régió ${sum.region} · semmi ${sum.none}` +
    ` · ${sum.heroes} hero, ${sum.gallery} galériakép\nKÖLTSÉG: $0 · ${sum.apiCalls} API-hívás · ${(sum.bytes / 1e6).toFixed(1)} MB · ${sum.clipRuns} CLIP-futás · ${sum.seconds} s mérve (${Math.round((Date.now() - t0) / 1000)} s falióra)`,
);
process.exit(0);
