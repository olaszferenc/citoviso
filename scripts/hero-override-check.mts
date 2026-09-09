// ŐR: az operátori nyitókép-választás VÉGIG megy-e — a kattintástól a kirenderelt lapig.
//
// Amit meg kell fognia (mind mért hiba máshonnan):
//  ① A mentés NEM publikálás. A `lead_hero_override` sor önmagában semmit nem változtat
//     azon, amit a lead lát: a mock statikus pillanatkép. Ezért nem a DB-t nézi, hanem a
//     KIRENDERELT HTML-t — tényleg a választott kép került-e a lap tetejére.
//  ② A választás TÚLÉLI az újragenerálást (tulajdonosi döntés): a jelölés a leadhez tapad.
//  ③ Ami már KI LETT AJÁNLVA, azt nem írjuk át alatta (§I): a prospect-link mögötti mock
//     nyitóképe be van fagyasztva.
//
// Futtatás: npx tsx scripts/hero-override-check.mts

import { db } from "../src/db/client.js";
import { readFile } from "node:fs/promises";
import { applyHeroPin, clearHeroPin, getHeroPin, repointHero, setHeroPin } from "../src/generator/heroOverride.js";
import { orderPhotosForHero, photoUrlKey, scoreHeroCandidates } from "../src/generator/heroPick.js";

const ok = (label: string, pass: boolean): boolean => {
  console.log(`${pass ? "✅" : "⛔"} ${label}`);
  return pass;
};

/** Melyik kép URL-je van a kirenderelt lap ELSŐ <img>/háttérkép helyén? */
function heroInHtml(html: string): string | null {
  const bg = /background-image:\s*url\(['"]?([^'")]+)/i.exec(html);
  const img = /<img[^>]+src=["']([^"']+)["']/i.exec(html);
  // A sablonok fele háttérképként, fele <img>-ként rendereli a herót — amelyik előbb
  // szerepel a dokumentumban, az van a lap tetején.
  if (bg && img) return (bg.index < img.index ? bg[1] : img[1]) ?? null;
  return bg?.[1] ?? img?.[1] ?? null;
}

async function main(): Promise<void> {
  let allOk = true;

  // ── ① tiszta függvény-önteszt: a jelölés tényleg előre emel, és nem dob el képet
  const set = [{ url: "https://x.test/a.jpg" }, { url: "https://x.test/b.jpg?sig=1" }, { url: "https://x.test/c.jpg" }];
  const moved = applyHeroPin(set, "https://x.test/b.jpg?sig=999"); // MÁS aláírás, ugyanaz a kép
  allOk = ok("a jelölés query-string nélkül egyeztet (Places-URL lejár)", moved[0]!.url.includes("b.jpg")) && allOk;
  allOk = ok("egyetlen kép sem vész el a jelöléskor", moved.length === set.length) && allOk;
  allOk = ok("jelölés nélkül a sorrend érintetlen", applyHeroPin(set, null)[0]!.url === set[0]!.url) && allOk;

  // ── ② valódi artefaktum: a kirenderelt HTML-ben MEGVÁLTOZIK-e a nyitókép
  const row = await db
    .selectFrom("mock_artifact")
    .select(["id", "lead_id", "path", "inputs"])
    .where("path", "is not", null)
    .orderBy("generated_at", "desc")
    .execute();
  const target = row.find((r) => {
    const ph = ((r.inputs ?? {}) as { siteData?: { photos?: unknown[] } }).siteData?.photos ?? [];
    return ph.length >= 3;
  });
  if (!target) {
    console.log("⚠️ nincs alkalmas mock a dev DB-ben (≥3 fotó) — a HTML-próba kimarad");
    await db.destroy();
    process.exit(allOk ? 0 : 1);
  }
  const photos = (((target.inputs ?? {}) as { siteData?: { photos?: { url: string }[] } }).siteData?.photos ?? []);
  const before = await readFile(target.path!, "utf8");
  const beforeHero = heroInHtml(before);
  const wanted = photos[2]!.url; // a harmadik kép — biztosan nem az aktuális hero

  const pinned = await getHeroPin(target.lead_id);
  const r = await repointHero(target.id, wanted, "őr-teszt");
  allOk = ok(`az újrarenderelés lefutott (${r.message})`, r.ok) && allOk;
  const after = await readFile(target.path!, "utf8");
  const afterHero = heroInHtml(after);
  allOk =
    ok(
      "a KIRENDERELT lapon tényleg a választott kép a nyitókép",
      Boolean(afterHero && photoUrlKey(afterHero) === photoUrlKey(wanted)),
    ) && allOk;
  allOk = ok("a lap tényleg megváltozott (nem csak a DB)", beforeHero !== afterHero) && allOk;

  // ── ③ a jelölés a LEADHEZ tapad → túléli az újragenerálást
  await setHeroPin(target.lead_id, wanted, "őr-teszt");
  const pin = await getHeroPin(target.lead_id);
  allOk = ok("a választás a leadhez van mentve", photoUrlKey(pin?.url ?? "") === photoUrlKey(wanted)) && allOk;

  // ── ④ visszaállás a gépi választásra.
  // ⚠️ A mércé a MOTOR SZABÁLYA, nem "amit a fájl korábban mutatott": az előző futás
  // állapota bennmaradhat a fában, és akkor egy állapot-függő elvárás pirosat adna ott,
  // ahol a kód helyes (ez pontosan megtörtént 2026-09-09-én).
  await clearHeroPin(target.lead_id);
  const back = await repointHero(target.id, null, "őr-teszt");
  const restored = heroInHtml(await readFile(target.path!, "utf8"));
  const machineTop = orderPhotosForHero(photos, await scoreHeroCandidates(photos, "őr"))[0]!.url;
  allOk =
    ok(
      "visszavonás után a MOTOR választása áll a lapon",
      back.ok && Boolean(restored && photoUrlKey(restored) === photoUrlKey(machineTop)),
    ) && allOk;

  // ── ⑤ §I: kiajánlott mockot nem írunk át
  const offered = await db
    .selectFrom("prospect")
    .select(["id", "mock_artifact_id"])
    .where("mock_artifact_id", "is not", null)
    .executeTakeFirst();
  if (offered?.mock_artifact_id) {
    const blocked = await repointHero(offered.mock_artifact_id, wanted, "őr-teszt");
    allOk = ok("kiajánlott mock nyitóképe be van fagyasztva (§I)", !blocked.ok) && allOk;
  } else {
    console.log("⚠️ nincs kiajánlott mock a dev DB-ben — a §I-ág nem mérhető most");
  }

  // az eredeti állapot vissza
  if (pinned) await setHeroPin(target.lead_id, pinned.url, pinned.actor);

  await db.destroy();
  process.exit(allOk ? 0 : 1);
}

await main();
