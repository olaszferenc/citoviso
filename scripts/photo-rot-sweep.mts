/**
 * FOTÓ-ROTHADÁS SWEEP — megméri, majd (kérésre) frissíti a park elrohadt fotó-URL-jeit.
 *
 * MIÉRT (ADR-0136, mérve 2026-09-13): a tárolt portál-fotó-URL nem örök. A hovamenjek.hu
 * átírta a fájlneveit, a balaton.hu a saját lapján hivatkozik 404-es i.szalas.hu képekre —
 * és ezek eddig végigmentek a láncon. Az ELEK-TESZT leaden a NYITÓKÉP is halott URL volt: a
 * leadnek kiküldött lapon törött-kép ikon, az MMS-előnézet pedig elő sem állt (FK-004 H1).
 * Egy 40 leades minta szerint a nyitóképek ~22%-a halott — a sweep ezt méri MEG, nem becsli.
 *
 * MIT CSINÁL
 *   (alap, READ-ONLY)  minden lead minden TÁROLT portál-fotó-URL-jét megméri, és leadenként
 *                      kiírja: hány él, hány halott — plusz megjelöli, kinek van már
 *                      JÓVÁHAGYOTT vagy KIKÜLDÖTT mockja (az a sürgős: azt a lapot a lead
 *                      MOST is megnyithatja).
 *   --fix              a halott fotós leadeken FRISSÍT: a MÁR HOZZÁKÖTÖTT adatlapokat
 *                      olvassa újra (keresés nélkül — nem éget Brave/CSE kvótát), majd
 *                      ÚJRAMÉR. ⛔ Ha nem lett TÖBB élő fotó, VISSZAÁLLÍTJA a korábbi
 *                      halmazt: a javítás szerkezetileg nem tud rontani.
 *   --discover         a frissítés KERESÉSSEL is dolgozhat (új adatlapok; kvótát éget).
 *   --limit N          hány leadet érintsen (alapból mind) — a politeness-költség korlátja.
 *
 * ⛔ AMIT NEM CSINÁL, ÉS EZT KI IS MONDJA: nem generál újra mockot. Az AI-költség (mérve
 * $0,1365/mock), és a döntés a kurátoré. A már legenerált, halott képes lapokat az ADR-0134
 * kiküldés-kapu fogja meg az ajtóban — a sweep dolga, hogy az ADAT legyen jó.
 *
 * ⚠️ A mérés UGYANAZZAL a lekérővel megy (`probeImageRefs` → `fetchPhoto`), amit a
 * kiküldés-kapu és a kurátor csempéje használ: egy képernyőn egy igazság. Gazdagépenként
 * sorosít, udvarias szünettel, és a MÚLANDÓ hibát (429, hálózat) nem nevezi halottnak.
 *
 * Futtatás:
 *   npx tsx scripts/photo-rot-sweep.mts                 # mérés
 *   npx tsx scripts/photo-rot-sweep.mts --fix           # mérés + frissítés + újramérés
 */
import { sql } from "kysely";

import { db } from "../src/db/client.js";
import { probeImageRefs, isPermanentFailure } from "../src/outreach/mockPhotoHealth.js";
import { rescrapePhotos } from "../src/scraper/rescrapePhotos.js";

const FIX = process.argv.includes("--fix");
/** FELFEDEZÉS: kereséssel új adatlapokat is keres (Brave/CSE KVÓTÁT éget). Alapból KI —
 *  a frissítés az ismert adatlapok újraolvasása, ami ingyen van. Mérve az Erzsébet
 *  Vendéglőn: a keresés 2 helyett 4 adatlapot talált, és 11/11 élő fotót hozott vissza —
 *  vagyis a felfedezés VALÓDI esély, de kimondott döntés, nem alapértelmezés. */
const DISCOVER = process.argv.includes("--discover");
const LIMIT = Number(
  (process.argv.find((a) => a.startsWith("--limit=")) ?? "").split("=")[1] ?? "0",
);

interface LeadRow {
  id: string;
  name: string;
  raw: unknown;
}
interface RawShape {
  portalProfiles?: { url: string; photos?: { url: string }[] }[];
}

function rawOf(row: LeadRow): RawShape {
  return (typeof row.raw === "string" ? JSON.parse(row.raw) : row.raw) as RawShape;
}
function photoUrlsOf(raw: RawShape): string[] {
  return [
    ...new Set((raw.portalProfiles ?? []).flatMap((p) => (p.photos ?? []).map((x) => x.url))),
  ];
}

/** Hány VÉGLEGESEN halott van a listában? (A múlandó hiba nem számít halottnak.) */
async function deadOf(urls: readonly string[]): Promise<string[]> {
  if (!urls.length) return [];
  const broken = await probeImageRefs(
    urls.map((u) => ({ url: u, where: "img" as const, refs: 1 })),
    "hu",
  );
  return broken.filter((b) => isPermanentFailure(b.failure)).map((b) => b.url);
}

const leads = (await db
  .selectFrom("lead")
  .select(["id", "name", "raw"])
  .orderBy("name")
  .execute()) as unknown as LeadRow[];

// Kinek van JÓVÁHAGYOTT vagy KIKÜLDÖTT mockja? Az a sürgős: azt a lapot a lead megnyithatja.
const delivered = new Map<string, string>();
for (const a of await db
  .selectFrom("mock_artifact")
  .select(["lead_id", "status"])
  .where("status", "in", ["approved", "sent"])
  .execute()) {
  delivered.set(a.lead_id, a.status);
}

const withPhotos = leads
  .map((l) => ({ l, urls: photoUrlsOf(rawOf(l)) }))
  .filter((x) => x.urls.length > 0);
const scope = LIMIT > 0 ? withPhotos.slice(0, LIMIT) : withPhotos;

console.log(
  `Fotó-rothadás sweep — ${scope.length} lead portál-fotókkal · ` +
    `${scope.reduce((n, x) => n + x.urls.length, 0)} tárolt URL` +
    (LIMIT > 0 ? ` (--limit=${LIMIT}, a teljes kör ${withPhotos.length} lead)` : "") +
    `\nmód: ${FIX ? "MÉRÉS + FRISSÍTÉS" : "csak mérés (a frissítéshez: --fix)"}\n`,
);

let leadsWithDead = 0;
let deadTotal = 0;
let urlTotal = 0;
let fixedLeads = 0;
let rolledBack = 0;
let recovered = 0;
const stillBroken: string[] = [];

for (const [i, { l, urls }] of scope.entries()) {
  const dead = await deadOf(urls);
  urlTotal += urls.length;
  deadTotal += dead.length;
  const mark = delivered.has(l.id) ? ` [${delivered.get(l.id)} mock!]` : "";
  if (!dead.length) {
    console.log(`  ${String(i + 1).padStart(3)}. ✓ ${l.name} — ${urls.length}/${urls.length} él${mark}`);
    continue;
  }
  leadsWithDead++;
  console.log(
    `  ${String(i + 1).padStart(3)}. ⛔ ${l.name} — ${urls.length - dead.length}/${urls.length} él, ${dead.length} HALOTT${mark}`,
  );
  if (!FIX) continue;

  // ⛔⛔ A JAVÍTÁS NE TUDJON RONTANI (mérve 2026-09-13, saját káron). Az első futásom a
  // frissítést feltétel nélkül ráírta a leadre — és a friss olvasat SEHOL nem nyert vissza
  // élő fotót (0), több leaden viszont KISEBB halmazt írt a régi helyére: a Mákszem 45 élő
  // fotója 0-ra, a Lavia 45-je 19-re esett. A park 18:15-ös mentéséből állt vissza.
  // Ezért a frissítés innentől: PILLANATKÉP → írás → ÚJRAMÉRÉS → ha nem lett TÖBB élő
  // fotó, VISSZAÁLLÍTÁS. Így a `--fix` szerkezetileg csak javítani tud.
  const liveBefore = urls.length - dead.length;
  const snapshot = JSON.stringify(rawOf(l));
  const r = await rescrapePhotos(l.id, { knownUrlsOnly: !DISCOVER });
  const after = photoUrlsOf(
    rawOf(
      (await db
        .selectFrom("lead")
        .select(["id", "name", "raw"])
        .where("id", "=", l.id)
        .executeTakeFirst()) as unknown as LeadRow,
    ),
  );
  const deadAfter = await deadOf(after);
  const liveAfter = after.length - deadAfter.length;
  if (liveAfter > liveBefore) {
    fixedLeads++;
    recovered += liveAfter - liveBefore;
    console.log(`        → JAVULT: ${liveBefore} → ${liveAfter} élő fotó (${r.message})`);
  } else {
    await db
      .updateTable("lead")
      .set({ raw: sql`${snapshot}::jsonb` })
      .where("id", "=", l.id)
      .execute();
    rolledBack++;
    stillBroken.push(`${l.name} (${liveBefore} élő maradt)`);
    console.log(
      `        → nem javult (${liveBefore} → ${liveAfter} élő) — VISSZAÁLLÍTVA a korábbi halmaz`,
    );
  }
}

console.log(
  `\n── ÖSSZEGZÉS ──\n` +
    `  lead portál-fotókkal: ${scope.length} · tárolt URL: ${urlTotal}\n` +
    `  halott URL a méréskor: ${deadTotal} (${Math.round((deadTotal / Math.max(1, urlTotal)) * 100)}%) · ` +
    `érintett lead: ${leadsWithDead}`,
);
if (FIX) {
  console.log(
    `  JAVULT: ${fixedLeads} lead · visszanyert élő fotó: ${recovered}` +
      ` · visszaállítva (nem javult): ${rolledBack} lead`,
  );
  if (stillBroken.length) {
    // ⛔ Néma csonkítás tilos: ami NEM javult, azt névvel kiírjuk — az elhallgatott
    // maradék úgy olvasódna, mintha mindent megoldottunk volna.
    console.log(`  ⚠️ NEM javult (${stillBroken.length}): ${stillBroken.join(" · ")}`);
    console.log(
      DISCOVER
        ? `     Ezeknél a keresés sem talált élő fotót — a képek eltűntek a portálról.`
        : `     Ezeknél az ismert adatlap újraolvasása nem hozott többet. A KERESÉSES kör` +
          ` (--discover) esélyes: mérve az Erzsébet Vendéglőn 2 helyett 4 adatlapot talált.` +
          ` Kvótát éget, ezért kimondott döntés.`,
    );
  }
}
console.log(
  `  ⛔ mock-újragenerálás NEM történt (AI-költség + kurátori döntés). A már legenerált, ` +
    `halott képes lapokat az ADR-0134 kiküldés-kapu fogja meg.`,
);
process.exit(0);
