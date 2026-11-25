// MAINTENANCE of the stored town picture sets (ADR-0479, plan kepnelkuli-hero). There is NO backfill (owner
// 2026-11-25): a town's pictures are gathered just in time by the mock generation (generator/townHero.ts).
// When the rules change, the stored sets are re-judged here without searching again:
//   npx tsx scripts/town-photo-sets.mts --restyle   (only the sample-room style of the stored sets)
//   npx tsx scripts/town-photo-sets.mts --rescreen  (re-judge the stored pictures under the current rules)

import { db } from "../src/db/client.js";
import { rescreenTownPicks, townStyleOf, TOWN_PICK_THRESHOLD, TOWN_PICK_VERSION, type TownPick } from "../src/media/townPick.js";
import { langForCountry } from "../src/i18n/lang.js";

const args = process.argv.slice(2);
const all = (k: string): string[] => args.flatMap((a, i) => (a === k && args[i + 1] ? [args[i + 1]!] : []));
const redo = args.includes("--redo");

if (args.includes("--rescreen")) {
  // Re-judge the stored sets under the CURRENT rules (no new search): rejected pictures leave, heroes are
  // re-chosen, the set is stamped with the current version.
  const rows = await db.selectFrom("town_photo_set").selectAll().execute();
  for (const r of rows) {
    if (r.version === TOWN_PICK_VERSION && !redo) continue;
    const res = await rescreenTownPicks(r.heroes as TownPick[], r.gallery as TownPick[]);
    await db
      .updateTable("town_photo_set")
      .set({
        heroes: JSON.stringify(res.heroes) as never,
        gallery: JSON.stringify(res.gallery) as never,
        tier: (res.heroes[0]?.tier ?? "none") as never,
        version: TOWN_PICK_VERSION,
        threshold: TOWN_PICK_THRESHOLD,
      })
      .where("country", "=", r.country)
      .where("city_key", "=", r.city_key)
      .execute();
    console.log(`${r.city}: ${(r.heroes as unknown[]).length}→${res.heroes.length} hero, ${(r.gallery as unknown[]).length}→${res.gallery.length} galéria${res.dropped.length ? " · ki: " + res.dropped.map((d) => `${d.title.slice(0, 40)} (${d.why})`).join("; ") : ""}`);
  }
  process.exit(0);
}

if (args.includes("--restyle")) {
  // Recompute only the sample-room style of the stored sets (the style rule changed; no picture is re-picked).
  const rows = await db.selectFrom("town_photo_set").select(["country", "city_key", "city", "lat", "lon", "stats", "style"]).execute();
  const only = all("--town").map((t) => t.split(":")[0]!.toLowerCase());
  for (const r of rows) {
    if (r.lat == null || r.lon == null) continue;
    if (only.length && !only.includes(r.city.toLowerCase())) continue;
    const wd = (r.stats as { wikidata?: string }).wikidata;
    const style = await townStyleOf({ city: r.city, country: r.country, lat: r.lat, lon: r.lon, lang: langForCountry(r.country) ?? "en" }, wd);
    if (style !== r.style) await db.updateTable("town_photo_set").set({ style }).where("country", "=", r.country).where("city_key", "=", r.city_key).execute();
    console.log(`${r.city}: ${r.style} → ${style}`);
  }
  process.exit(0);
}

console.log("Használat: --rescreen | --restyle [--town <név:ORSZÁG>]… (előre futtatott pótlás nincs: a gyűjtés just-in-time, a mock előtt fut — tulaj 2026-11-25)");
process.exit(0);
