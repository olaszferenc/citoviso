// portal-approve-check — a közepes egyezésű portál-adatlapot a kurátor jóvá tudja hagyni.
//
// Miért (Neo, 2026-10-26): a fotó-behúzó „közepes egyezés — kurátori jóváhagyásig” állapotot
// adott, de sem gomb, sem végpont nem volt hozzá, így az ilyen lead örökre TARTVA maradt.
// Példa: Vivien 1108db5a (hovamenjek, 0,70: település, 6 m, utca/házszám egyezik), 0 fotó.
//
// Amit mér:
//   ① approvePortalMatch: a várakozó adatlapot ÚJRAOLVASSA a kurátor szavával (curatorApproved),
//      a régi profilt a frisssel CSERÉLI (nem duplikál), a fotók a leadhez kerülnek;
//   ② elutasít: nem várakozó URL, sikertelen újraolvasás, és ha az adatlap továbbra is vár —
//      ilyenkor a lead érintetlen;
//   ③ readPortalListing: a jóváhagyás csak a közepes sávot/típus-ütközést oldja, a gyenge sávot nem;
//   ④ bekötés: végpont + gomb a lead Fotók paneljén, csak várakozó adatlapnál.
//
// A közös dev DB-be eldobható leadet (és scrape-definíciót) ír egy meglévő régióban, és a végén törli. Hálózat nincs: az
// újraolvasást teszt-olvasó adja (a valódi olvasó szűrői a photo-quality-check tárgya).
//   npx tsx scripts/portal-approve-check.mts

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { db } from "../src/db/client.js";
import { approvePortalMatch } from "../src/scraper/attachPhotoLinks.js";
import { portalPhotoCount, profilesAwaitingApproval } from "../src/scraper/portalPhotos.js";
import type { readPortalListing } from "../src/scraper/sources/portalListing.js";
import type { PortalProfile, QualifiedLead } from "../src/scraper/types.js";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const tag = randomUUID().slice(0, 8);
let REGION = "";
const URL_HELD = "https://hovamenjek.hu/balatonszarszo/vivien-apartmanok";
const held: PortalProfile = {
  portal: "hovamenjek", portalHost: "hovamenjek.hu", url: URL_HELD, title: "Vivien Apartmanok",
  rooms: [], amenities: [], prices: [], photos: [], reviews: [],
  matchConfidence: 0.699, matchBand: "medium",
  matchReasons: ["település egyezik", "koordináta-távolság 6m (0.99)", "utca/házszám egyezik", "közepes sáv — kurátori jóváhagyás kell, fotók NEM tulajdonítva"],
  needsReview: true, extractor: "dom", fetchedAt: "2026-10-26T08:00:00.000Z",
} as unknown as PortalProfile;
const photo = (n: number) => ({
  url: `https://hovamenjek.hu/upload/places/1_x/fullHd/vivien-${n}.jpg`, width: 1600, height: 1067,
  provenance: "portal", sourceUrl: URL_HELD, portalHost: "hovamenjek.hu", vouched: true,
});
const approvedRead: typeof readPortalListing = async (url, _lead, _region, opts) => ({
  url,
  profile: {
    ...held, needsReview: !opts?.curatorApproved, matchBand: opts?.curatorApproved ? "high" : "medium",
    photos: opts?.curatorApproved ? [photo(1), photo(2), photo(3)] : [],
    matchReasons: [...held.matchReasons.slice(0, 3), "kurátor jóváhagyta az egyezést — fotók tulajdonítva"],
  } as unknown as PortalProfile,
});
const stillHeld: typeof readPortalListing = async (url) => ({ url, profile: held });
const unreadable: typeof readPortalListing = async (url) => ({ url, skipped: "gyenge entitás-egyezés — eldobva" });

let leadId = "";
let defId = "";
try {
  // An existing active region (the reader resolves only active ones); nothing is written to it.
  REGION = (await db.selectFrom("region").select("id").where("active", "=", true).orderBy("id").executeTakeFirstOrThrow()).id;
  const def = await db.insertInto("scraper_definition")
    .values({ label: `_approve_${tag}`, country: "HU", region: REGION, industry: "accommodation", sources: JSON.stringify(["osm"]) })
    .returning("id").executeTakeFirstOrThrow();
  defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  const raw = { name: "Vivien Balatoni Stúdió Apartmanok", city: "Balatonszárszó", region: REGION, industry: "accommodation", sources: ["osm"], portalProfiles: [held] };
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: run.id, name: `_approve_${tag}`, raw: JSON.stringify(raw) })
    .returning("id").executeTakeFirstOrThrow();
  leadId = lead.id;
  const load = async (): Promise<QualifiedLead> => {
    const r = await db.selectFrom("lead").select("raw").where("id", "=", leadId).executeTakeFirstOrThrow();
    return (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead;
  };

  console.log("② elutasítás: a lead érintetlen");
  const notHeld = await approvePortalMatch(leadId, "https://hovamenjek.hu/mas-szallas", approvedRead);
  check("nem várakozó URL → elutasítva", !notHeld.ok, notHeld.message);
  const bad = await approvePortalMatch(leadId, URL_HELD, unreadable);
  check("sikertelen újraolvasás → elutasítva, az ok a válaszban", !bad.ok && /gyenge entitás-egyezés/.test(bad.message), bad.message);
  const still = await approvePortalMatch(leadId, URL_HELD, stillHeld);
  check("az adatlap továbbra is vár → elutasítva", !still.ok, still.message);
  check("…és közben semmi nem íródott", profilesAwaitingApproval(await load()).length === 1 && portalPhotoCount(await load()) === 0);

  console.log("① jóváhagyás");
  const ok = await approvePortalMatch(leadId, URL_HELD, approvedRead);
  const after = await load();
  check("jóváhagyva, a válasz a fotószámot mondja (0 → 3)", ok.ok && ok.before === 0 && ok.after === 3, ok);
  check("a profil cserélődött, nem duplikálódott", (after.portalProfiles ?? []).filter((p) => p.url === URL_HELD).length === 1, after.portalProfiles?.length);
  check("a profil már nem vár, a fotói a leadhez tartoznak", profilesAwaitingApproval(after).length === 0 && portalPhotoCount(after) === 3);
  const twice = await approvePortalMatch(leadId, URL_HELD, approvedRead);
  check("másodszor: „nem vár jóváhagyásra”", !twice.ok && /nem vár jóváhagyásra/.test(twice.message), twice.message);

  console.log("③ a valódi olvasó: csak a közepes sávot oldja");
  const reader = readFileSync(path.join(import.meta.dirname, "../src/scraper/sources/portalListing.ts"), "utf8");
  const lowReturn = reader.indexOf('if (confidence.band === "low")');
  check("a gyenge sáv a jóváhagyás ELŐTT kiesik", lowReturn > 0 && lowReturn < reader.indexOf("const approved = held && opts.curatorApproved === true"));
  check("jóváhagyott: fotók és vélemények tulajdonítva, a sáv high, az ok kiírva",
    /const needsReview = held && !approved/.test(reader) && /vouchable = confidence\.band === "high" \|\| approved/.test(reader) &&
      /approved \? "high"/.test(reader) && /kurátor jóváhagyta az egyezést/.test(reader));

  console.log("④ bekötés");
  const server = readFileSync(path.join(import.meta.dirname, "../src/console/server.ts"), "utf8");
  check("végpont: POST /lead/:id/portal-approve → approvePortalMatch", /\\\/portal-approve\$/.test(server) && /approvePortalMatch\(leadId, form\.get\("url"\)/.test(server));
  const views = readFileSync(path.join(import.meta.dirname, "../src/console/views.ts"), "utf8");
  check("Fotók panel: gomb csak várakozó adatlapnál (profilesAwaitingApproval → held)",
    /profilesAwaitingApproval\(/.test(views) && /action="\/lead\/\$\{esc\(leadId\)\}\/portal-approve"/.test(views) && /Jóváhagyom az egyezést/.test(views));
} finally {
  if (leadId) await db.deleteFrom("lead").where("id", "=", leadId).execute();
  if (defId) {
    await db.deleteFrom("scrape_run").where("scraper_definition_id", "=", defId).execute();
    await db.deleteFrom("scraper_definition").where("id", "=", defId).execute();
  }
  await db.destroy();
}

if (failures) {
  console.error(`\n❌ portal-approve-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ portal-approve-check: a közepes egyezés kurátori jóváhagyással a leadhez kerül; gyenge sáv, hibás olvasás soha.");
