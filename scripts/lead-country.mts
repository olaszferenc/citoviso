// ORSZÁG-RÉTEG 3/4 (ADR-0455) — a lead's country rules, for the colleagues (Vera, Neo, Poe).
// READ-ONLY: reads the lead and the country row, writes nothing, sends nothing.
//
//   npx tsx scripts/lead-country.mts <lead-id | first 8 chars of it>
//   npx tsx scripts/lead-country.mts --country <ISO-2>      (the row only — e.g. for a live lead)
//
// Prints: the lead's country (from its coordinate, ADR-0437 ②), language, zone and local time,
// whether the answer window is open there now (weekday, public holidays), the phone verdict in
// that country (Vera §3b ①), the country's mobile ranges, portal hosts (an intermediary's
// contact is not the lodging's own) and own-site TLDs (Neo's domain guesses).
import { db } from "../src/db/client.js";
import { countryConfig, countryOfLead } from "../src/country.js";
import { leadPhoneVerdict } from "../src/crm/leadContact.js";
import { answerWindowOpenIn, isHolidayDay } from "../src/crm/countryClock.js";
import { hhmmIn, isoDayIn } from "../src/text/zoneTime.js";
import { sql } from "kysely";

if (process.argv[2] === "--country") {
  const cfg = await countryConfig(process.argv[3] ?? "");
  if (!cfg) {
    console.log(`${(process.argv[3] ?? "").toUpperCase() || "?"}: NINCS sora az ország-rétegben — mock, levél, válasz ZÁRVA`);
  } else {
    const now = new Date();
    console.log(`${cfg.iso2} — ${cfg.name} · nyelv: ${cfg.defaultLang} · időzóna: ${cfg.timeZone} · helyi idő most: ${isoDayIn(now, cfg.timeZone)} ${hhmmIn(now, cfg.timeZone)}`);
    console.log(`  válasz-ablak most: ${answerWindowOpenIn(now, cfg) ? "NYITVA" : "zárva"} · munkaszüneti napok: ${cfg.publicHolidays.join(", ") || "nincs megadva (csak hétvége)"}`);
    console.log(`  hívószám: +${cfg.dialCode} · trönk: ${cfg.trunkPrefix || "nincs"} · mobil-előtagok: ${cfg.mobilePrefixes.map((p) => `+${cfg.dialCode} ${p}`).join(", ")}`);
    console.log(`  helyi portálok (közvetítő, NEM saját kontakt/honlap): ${cfg.portalDomains.join(", ") || "—"}`);
    console.log(`  saját-honlap TLD-k (domain-tipp sorrendben): ${cfg.ownSiteTlds.join(", ") || "—"}`);
  }
  await db.destroy();
  process.exit(0);
}
const arg = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[0-9a-f-]{8,36}$/.test(arg)) {
  console.error("Használat: npx tsx scripts/lead-country.mts <lead-id | az első 8 karaktere>");
  process.exit(2);
}
const lead = await db
  .selectFrom("lead")
  .select(["id", "name", "raw"])
  .where(sql<boolean>`id::text like ${`${arg}%`}`)
  .limit(2)
  .execute();
if (lead.length !== 1) {
  console.error(lead.length ? "Több lead illeszkedik — adj meg hosszabb azonosítót." : "Nincs ilyen lead.");
  await db.destroy();
  process.exit(2);
}
const l = lead[0]!;
const raw = (l.raw ?? {}) as { phone?: string; email?: string; city?: string };
const iso = await countryOfLead(l.id);
const cfg = await countryConfig(iso);
const now = new Date();
console.log(`${l.name} (${l.id.slice(0, 8)}) · ${raw.city ?? "—"}`);
console.log(`  ország: ${iso ?? "ismeretlen"}${cfg ? ` — ${cfg.name}` : " — NINCS sora az ország-rétegben: mock, levél, válasz ZÁRVA"}`);
if (cfg) {
  const day = isoDayIn(now, cfg.timeZone);
  console.log(`  nyelv: ${cfg.defaultLang} · időzóna: ${cfg.timeZone} · helyi idő most: ${day} ${hhmmIn(now, cfg.timeZone)}`);
  console.log(
    `  válasz-ablak most: ${answerWindowOpenIn(now, cfg) ? "NYITVA" : "zárva"}` +
      `${isHolidayDay(day, cfg.publicHolidays) ? " (ma munkaszüneti nap)" : ""} · munkaszüneti napok: ${cfg.publicHolidays.length ? cfg.publicHolidays.join(", ") : "nincs megadva (csak hétvége)"}`,
  );
}
console.log(`  telefon: ${leadPhoneVerdict(raw.phone, cfg).note}`);
console.log(`  e-mail: ${raw.email ?? "nincs"} (saját vagy közvetítő: a te ítéleted)`);
if (cfg) {
  console.log(`  mobil-előtagok: ${cfg.mobilePrefixes.map((p) => `+${cfg.dialCode} ${p}`).join(", ")}`);
  console.log(`  helyi portálok (közvetítő, NEM saját kontakt/honlap): ${cfg.portalDomains.join(", ") || "—"}`);
  console.log(`  saját-honlap TLD-k (domain-tipp sorrendben): ${cfg.ownSiteTlds.join(", ") || "—"}`);
}
await db.destroy();
