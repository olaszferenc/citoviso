// Manual probe for the portal-listing source (ADR-0037 seed, §A.3 / §F.17b).
// Reads ONE stored lead, hunts its portal listings, prints exactly what was
// extracted and — just as important — why every rejected candidate was rejected.
//
//   npx tsx scripts/portal-probe.mts "Rózsakő ház"          # by (partial) name
//   npx tsx scripts/portal-probe.mts <lead-uuid>
//   npx tsx scripts/portal-probe.mts "Rózsakő ház" --url https://…/adatlap
//   npx tsx scripts/portal-probe.mts --list                 # candidate leads
//
// Read-only: it touches no DB row and writes no file.

import { db } from "../src/db/client.js";
import { portalLookup } from "../src/scraper/sources/portalListing.js";
import { getRegion, loadRegions } from "../src/scraper/regions.js";
import { webSearchBackend } from "../src/scraper/sources/webSearch.js";
import type { PortalProfile, QualifiedLead } from "../src/scraper/types.js";

interface Args {
  needle?: string;
  urls: string[];
  list: boolean;
}

function parseArgs(argv: string[]): Args {
  const args = argv.slice(2);
  const out: Args = { urls: [], list: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--url") out.urls.push(args[++i] ?? "");
    else if (a === "--list") out.list = true;
    else if (!a.startsWith("--") && !out.needle) out.needle = a;
  }
  out.urls = out.urls.filter(Boolean);
  return out;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function printProfile(p: PortalProfile): void {
  console.log(`\n  ── ${p.portalHost} (${p.portal}) ──`);
  console.log(`  URL:            ${p.url}`);
  console.log(
    `  Egyezés:        ${p.matchBand.toUpperCase()} ${p.matchConfidence.toFixed(2)}` +
      (p.needsReview ? "  ⚠️ kurátori ellenőrzés kell" : ""),
  );
  console.log(`                  ${p.matchReasons.join(" · ")}`);
  console.log(`  Kinyerés:       ${p.extractor}`);
  if (p.title) console.log(`  Cím:            ${p.title}`);
  if (p.address) console.log(`  Postai cím:     ${p.address}`);
  if (p.lat != null && p.lon != null) console.log(`  Koordináta:     ${p.lat}, ${p.lon}`);
  if (p.phone) console.log(`  Telefon:        ${p.phone}`);
  if (p.email) console.log(`  E-mail:         ${p.email}`);
  if (p.checkIn || p.checkOut) {
    console.log(`  Be/kijelentkezés: ${p.checkIn ?? "?"} / ${p.checkOut ?? "?"}`);
  }
  if (p.capacity) console.log(`  Férőhely:       ${p.capacity.value} fő  ← "${p.capacity.evidence}"`);
  if (p.roomCount) console.log(`  Szobaszám:      ${p.roomCount.value}  ← "${p.roomCount.evidence}"`);
  if (p.rating != null) {
    console.log(`  Értékelés:      ${p.rating}${p.reviewCount != null ? ` (${p.reviewCount} db)` : ""}`);
  }
  if (p.description) {
    console.log(`  Leírás (${p.description.length} karakter):`);
    console.log(`    ${p.description.slice(0, 400).replace(/\n/g, "\n    ")}${p.description.length > 400 ? " …" : ""}`);
  }
  if (p.rooms.length) {
    console.log(`  Egységek (${p.rooms.length}):`);
    for (const r of p.rooms.slice(0, 8)) {
      console.log(
        `    · ${r.name ?? "(névtelen)"}${r.capacity ? ` — ${r.capacity} fő` : ""}` +
          `${r.beds ? ` — ${r.beds}` : ""}${r.amenities.length ? ` [${r.amenities.slice(0, 6).join(", ")}]` : ""}`,
      );
    }
  }
  if (p.amenities.length) {
    console.log(`  Szolgáltatások (${p.amenities.length}): ${p.amenities.slice(0, 25).join(", ")}${p.amenities.length > 25 ? " …" : ""}`);
  }
  if (p.prices.length) {
    console.log(`  Árak (${p.prices.length}, szó szerint):`);
    for (const pr of p.prices.slice(0, 8)) {
      console.log(`    · "${pr.raw}"${pr.unit ? ` /${pr.unit}` : ""}`);
    }
  }
  console.log(`  Fotók: ${p.photos.length} db`);
  for (const ph of p.photos.slice(0, 5)) {
    console.log(`    · [${ph.provenance}] ${ph.url}${ph.caption ? `  — "${ph.caption}"` : ""}`);
  }
  if (p.photos.length > 5) console.log(`    · … +${p.photos.length - 5} további`);
  const wrong = p.photos.filter((ph) => ph.provenance !== "portal").length;
  console.log(
    wrong
      ? `  ⛔ JOGÁLLÁS-HIBA: ${wrong} fotó nem "portal" osztályú!`
      : `  ✔ Minden fotó jogállása "portal" (§A.3)`,
  );
}

async function main(): Promise<void> {
  const { needle, urls, list } = parseArgs(process.argv);
  await loadRegions(true);

  const rows = (await db
    .selectFrom("lead")
    .select(["id", "name", "raw"])
    .execute()) as unknown as { id: string; name: string; raw: QualifiedLead | string }[];
  const leads = rows.map((r) => ({
    id: r.id,
    name: r.name,
    raw: (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead,
  }));

  if (list || !needle) {
    console.log("Elérhető leadek (isLead, város szerint):");
    for (const l of leads.filter((x) => x.raw.isLead).slice(0, 40)) {
      console.log(`  ${l.id}  ${l.name} — ${l.raw.city ?? "?"} (${l.raw.region})`);
    }
    console.log("\nHasználat: npx tsx scripts/portal-probe.mts \"<név vagy uuid>\" [--url <adatlap>]");
    await db.destroy();
    return;
  }

  const hay = needle.toLowerCase();
  const match = UUID_RE.test(needle)
    ? leads.find((l) => l.id === needle)
    : leads.find((l) => l.name.toLowerCase().includes(hay));
  if (!match) {
    console.error(`⛔ Nincs ilyen lead: "${needle}". Listához: --list`);
    await db.destroy();
    process.exit(1);
  }

  const lead = match.raw;
  let region;
  try {
    region = getRegion(lead.region);
  } catch {
    console.error(`⛔ Ismeretlen régió: ${lead.region}`);
    await db.destroy();
    process.exit(1);
  }

  console.log(
    `LEAD: ${lead.name} · ${lead.city ?? "?"} · ${lead.address ?? "cím ismeretlen"}\n` +
      `      honlap: ${lead.website ?? "-"} (${lead.websiteStatus}) · telefon: ${lead.phone ?? "-"}\n` +
      `      tárolt portál-találatok: ${lead.listings?.length ?? 0} · kereső: ${webSearchBackend()}`,
  );
  console.log(urls.length ? `\nKézzel megadott adatlap(ok): ${urls.join(", ")}` : "\nJelöltek keresése…");

  const started = Date.now();
  const { profiles, attempts } = await portalLookup(lead, region, {
    urls: urls.length ? urls : undefined,
    maxProfiles: 3,
    maxCandidates: 8,
  });

  console.log(`\nMegvizsgált jelöltek (${attempts.length}):`);
  for (const a of attempts) {
    console.log(a.profile ? `  ✔ ${a.url}` : `  ✗ ${a.url}\n      → ${a.skipped}`);
  }

  if (!profiles.length) {
    console.log("\nNincs elfogadott portál-adatlap — a lead adat nélkül marad (ez a helyes viselkedés, ha nincs bizonyíték).");
  } else {
    console.log(`\n=== ${profiles.length} ELFOGADOTT ADATLAP ===`);
    for (const p of profiles) printProfile(p);
  }
  console.log(`\n(${((Date.now() - started) / 1000).toFixed(1)} s)`);
  await db.destroy();
}

main().catch(async (err) => {
  console.error("Portál-próba hiba:", err);
  await db.destroy().catch(() => {});
  process.exit(1);
});
