// ÚJRAPONTOZÓ — a `v3-watermark` ELŐTTI fotó-ítéletek pótlása (§A.2 lefedettség).
//
// MIÉRT KELL. A vízjel-verdikt (§A.2) a `v3-watermark` prompt-verzió óta létezik. A cache
// olvasója `model = CACHE_MODEL`-re szűr, tehát a régebbi sorok BE SEM TÖLTŐDNEK — ez
// szándékos (egy hiányos ítélet egy jogi kapu alatt rosszabb, mint a semmi). Csakhogy az
// ÉLESÍTÉS útja (`conversion/provision.ts`) cache-ből dolgozik és NEM indít fizetős hívást:
// egy KORÁBBAN legyártott mocknál így nincs verdikt, és verdikt nélkül a §A.2 vízjel-kizárás
// nem tud lefutni — pont azoknál a leadeknél, amelyek a konverzióhoz a legközelebb állnak.
//
// Ez a szkript zárja a rést: újrapontozza azokat a fotókat, amelyeknek van RÉGI verziójú
// ítéletük, de nincs mai. Az új generálások maguktól `v3`-at kapnak — ez csak a múltra kell.
//
// ⛔ ALAPBÓL SZÁRAZ. Írni (és fizetős hívást indítani) CSAK a `--go` kapcsolóval lehet;
//    ismeretlen kapcsoló = hiba, nem néma átengedés. Mérve 2026-09-19: 222 sor, ebből 194
//    a `v2-adbanner`-en — az újrapontozás nagyságrendileg 1 USD alatt van.
//
//   npx tsx scripts/rescore-photo-verdicts.mts          # SZÁRAZ: megmutatja, mit tenne
//   npx tsx scripts/rescore-photo-verdicts.mts --go     # ÉLES: fizetős vision-hívás
//
// ── --sign-map (Elek F-3, tulaj-döntés „B”, 2026-10-14) ──────────────────────────────
// A v4 prompt (a lefotózott portál-molinó elérhetőséggel = ad_banner) a v3-as ítéleteket
// ELFOGADJA, kivéve a `sign_map`-eket — csak azokat kell újrakérdezni (élesen 277 sor, ~$0,4).
// ⚠️ A `url_key` KISBETŰSÍTETT URL, a Google-fotó azonosítója viszont kis-nagybetű-érzékeny:
// a kulcsból nem lehet letölteni. Az EREDETI URL-t a mockok fotólistáiból (mock_artifact.inputs)
// és a tenantok saját adataiból (site.edited_site_data) keressük ki, kulcs szerint.
//   npx tsx scripts/rescore-photo-verdicts.mts --sign-map        # SZÁRAZ
//   npx tsx scripts/rescore-photo-verdicts.mts --sign-map --go   # ÉLES (deploy UTÁN, utána tenant-rerender)

import { db } from "../src/db/client.js";
import { photoUrlKey, scoreHeroCandidates } from "../src/generator/heroPick.js";

const ARGV = process.argv.slice(2);
let go = false;
let signMap = false;
for (const a of ARGV) {
  if (a === "--go") go = true;
  else if (a === "--sign-map") signMap = true;
  else {
    console.error(`⛔ ismeretlen kapcsoló: ${a}\nÍrni CSAK a --go kapcsolóval lehet.`);
    process.exit(2);
  }
}

// A CACHE_MODEL nem exportált (szándékosan: egy forrás), ezért a mai verziót abból olvassuk
// ki, amit a tábla ténylegesen tartalmaz — a „melyik a mai" kérdést nem találgatjuk.
const rows = await db
  .selectFrom("photo_hero_score")
  .select(["url_key", "model", "subject", "watermarked"])
  .execute();

if (signMap) {
  const targets = rows.filter((r) => r.model.endsWith("#v3-watermark") && r.subject === "sign_map");
  const want = new Set(targets.map((r) => r.url_key));
  console.log(`v3 „sign_map” ítélet: ${targets.length} — ezeket kell a v4 szabállyal újrakérdezni.`);
  // The ORIGINAL urls (case intact) — every photo list we hold, keyed the cache's way.
  const urlByKey = new Map<string, string>();
  const take = (photos: unknown): void => {
    if (!Array.isArray(photos)) return;
    for (const p of photos as { url?: unknown }[]) {
      const u = typeof p?.url === "string" ? p.url : null;
      if (!u) continue;
      const k = photoUrlKey(u);
      if (want.has(k) && !urlByKey.has(k)) urlByKey.set(k, u);
    }
  };
  for (const a of await db.selectFrom("mock_artifact").select("inputs").execute()) {
    take(((a.inputs ?? {}) as { siteData?: { photos?: unknown } }).siteData?.photos);
  }
  for (const s of await db.selectFrom("site").select("edited_site_data").execute()) {
    take(((s.edited_site_data ?? {}) as { photos?: unknown }).photos);
  }
  const found = [...urlByKey.values()];
  console.log(`eredeti URL megvan: ${found.length} · nincs meg (nincs rá élő fotólista — nem is kerül lapra): ${targets.length - found.length}`);
  if (!go) {
    console.log(`\nSZÁRAZ FUTÁS — semmit nem írtam és nem hívtam. Nagyságrendileg $${(found.length * 0.0015).toFixed(2)}.\n` +
      `Éles futás: npx tsx scripts/rescore-photo-verdicts.mts --sign-map --go`);
    await db.destroy();
    process.exit(0);
  }
  let got = 0;
  for (let i = 0; i < found.length; i += 24) {
    const batch = found.slice(i, i + 24).map((url) => ({ url }));
    got += (await scoreHeroCandidates(batch, "újrapontozás (sign_map → v4)")).size;
    console.log(`  ${Math.min(i + 24, found.length)}/${found.length}`);
  }
  const left = await db
    .selectFrom("photo_hero_score")
    .select("url_key")
    .where("model", "like", "%#v3-watermark")
    .where("subject", "=", "sign_map")
    .execute();
  const banners = await db
    .selectFrom("photo_hero_score")
    .select("url_key")
    .where("model", "like", "%#v4-contactbanner")
    .where("subject", "=", "ad_banner")
    .where("url_key", "in", found.length ? [...urlByKey.keys()] : ["-"])
    .execute();
  console.log(`\n✅ Kész. v3 „sign_map” maradt: ${left.length} (előtte ${targets.length}) · ebből most reklámnak ítélt (lekerül a lapokról): ${banners.length}`);
  console.log("Utána: a tenant-oldalak újrarenderelése, hogy az élő lapokról is lekerüljön.");
  // UTÓ-FELTÉTEL: ha egyetlen megtalált fotó sem kapott új ítéletet, a futás NEM sikerült.
  if (found.length && left.length > targets.length - found.length) {
    console.error("⛔ A megtalált fotók egy része NEM kapott v4 ítéletet (letöltés / API) — futtasd újra, vagy nézd meg a naplót.");
    await db.destroy();
    process.exit(1);
  }
  await db.destroy();
  process.exit(0);
}

const byModel = new Map<string, number>();
for (const r of rows) byModel.set(r.model, (byModel.get(r.model) ?? 0) + 1);
console.log("Cache-ben lévő ítéletek modell-verziónként:");
for (const [m, n] of [...byModel].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(4)} · ${m}`);

// „Mai" = amelyik sorban már VAN vízjel-ítélet. Ez a tényleges kérdés, nem a verzió-sztring.
const current = rows.filter((r) => r.watermarked !== null);
const stale = rows.filter((r) => r.watermarked === null);
console.log(`\nvízjel-ítélettel: ${current.length} · vízjel-ítélet NÉLKÜL: ${stale.length}`);

if (stale.length === 0) {
  console.log("✅ Minden cache-sorban van vízjel-ítélet — nincs mit pótolni.");
  await db.destroy();
  process.exit(0);
}

if (!go) {
  console.log(
    `\nSZÁRAZ FUTÁS — semmit nem írtam és nem hívtam.\n` +
      `${stale.length} fotó újrapontozása következne (fizetős vision-hívás, ` +
      `nagyságrendileg $${(stale.length * 0.0015).toFixed(2)}).\n` +
      `Éles futás: npx tsx scripts/rescore-photo-verdicts.mts --go`,
  );
  await db.destroy();
  process.exit(0);
}

// A pontozó a cache-t maga kezeli: ami már `v3`, azt nem hívja újra, a hiányzót megveszi.
// A `url_key` a query nélküli, kisbetűs URL — a pontozó ugyanezzel a kulccsal dolgozik.
const urls = [...new Set(stale.map((r) => r.url_key))];
console.log(`\nÉLES: ${urls.length} fotó újrapontozása…`);
let done = 0;
// Kötegelve, a vision-plafon szerint — egy hívás egy köteg, ahogy a generálás is csinálja.
for (let i = 0; i < urls.length; i += 24) {
  const batch = urls.slice(i, i + 24).map((url) => ({ url }));
  const got = await scoreHeroCandidates(batch, "újrapontozás");
  done += got.size;
  console.log(`  ${Math.min(i + 24, urls.length)}/${urls.length} — eddig ${done} ítélet`);
}

const after = await db
  .selectFrom("photo_hero_score")
  .select(["watermarked"])
  .where("watermarked", "is not", null)
  .execute();
console.log(`\n✅ Kész. Vízjel-ítélettel rendelkező sorok: ${current.length} → ${after.length}`);
// UTÓ-FELTÉTEL: ha a szám nem nőtt, a futás NEM sikerült, bármit is írt ki fentebb.
if (after.length <= current.length) {
  console.error("⛔ A vízjel-ítéletek száma NEM nőtt — az újrapontozás nem ért célba.");
  await db.destroy();
  process.exit(1);
}
await db.destroy();
