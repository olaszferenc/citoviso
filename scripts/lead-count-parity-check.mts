// A lead-lista könnyítése nem változtathat azon, AMIT mutat (Elek IT P-1, 2026-10-14). A konzol
// /leads és az Irányítópult mind a ~9000 lead teljes `raw` JSONB-jét betöltötte (4,2 MB, 1,75 s);
// most a lista csak a használt 7 mezőt kéri, és az Irányítópult „kvalifikált lead” száma egy COUNT.
//   ① countWorkableLeads() === listLeadPage(defaultLeadQuery()).counts.matching (a közös dev DB-n);
//   ② minden lead cellái (fotó, anyag, utcakép, kapcsolat, ország, város) a 7 mezős vetítésből
//      UGYANAZOK, mint a teljes `raw`-ból — független újraszámolással (nem a termék leképezőjével);
//   ③ az Irányítópult a COUNT-ot használja, nem a teljes listát (forrás-ellenőrzés).
// Futtatás: npx tsx scripts/lead-count-parity-check.mts
import { readFile } from "node:fs/promises";
import path from "node:path";
const { db, pool } = await import("../src/db/client.js");
const { countWorkableLeads, listLeadPage, defaultLeadQuery } = await import("../src/console/data.js");
const { normalizeCountry } = await import("../src/console/leadContactRules.js");

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(typeof d === "string" ? d : JSON.stringify(d)).slice(0, 300)}`}`);
  if (!c) fail++;
};

try {
  console.log("\n① az Irányítópult száma = a lista száma");
  const list = await listLeadPage(defaultLeadQuery());
  const n = await countWorkableLeads();
  check(`⭐ COUNT (${n}) = a /leads alapnézet sorai (${list.counts.matching})`, n === list.counts.matching, { n, matching: list.counts.matching });
  check("a közös dev DB-ben van mit mérni (> 0)", n > 0, n);

  console.log("\n② a vetítés ugyanazokat a cellákat adja, mint a teljes raw");
  const full = await db.selectFrom("lead").select(["id", "raw"]).execute();
  const all = await listLeadPage({ all: "1" } as never);
  const dq = await listLeadPage({ disqualified: "1" } as never);
  const byId = new Map([...all.rows, ...dq.rows].map((r) => [r.id, r]));
  let compared = 0;
  const bad: string[] = [];
  for (const f of full) {
    const row = byId.get(f.id);
    if (!row) continue;
    const raw = (f.raw ?? {}) as { material?: { placesPhotos?: number; totalImages?: number; streetView?: boolean }; contactChannel?: string; photoCount?: number; country?: string; city?: string };
    const mat = raw.material ?? {};
    const want = {
      photos: mat.placesPhotos ?? raw.photoCount ?? 0,
      material: mat.totalImages ?? 0,
      streetView: Boolean(mat.streetView),
      contact: raw.contactChannel ?? "none",
      country: normalizeCountry(raw.country),
      city: raw.city ?? null,
    };
    const got = { photos: row.photos, material: row.material, streetView: row.streetView, contact: row.contact, country: row.country, city: row.city };
    compared++;
    if (JSON.stringify(want) !== JSON.stringify(got)) bad.push(`${f.id}: ${JSON.stringify(want)} ≠ ${JSON.stringify(got)}`);
  }
  check(`⭐ ${compared} lead cellái egyeznek a teljes raw-ból számolttal`, bad.length === 0 && compared > 0, bad.slice(0, 3));

  console.log("\n③ az Irányítópult nem tölti be a listát");
  const src = await readFile(path.resolve(import.meta.dirname, "../src/console/data.ts"), "utf8");
  // one function's body: from its signature to the next top-level declaration
  const body = (sig: string): string => {
    const i = src.indexOf(sig);
    const j = src.indexOf("\nexport ", i + sig.length);
    return src.slice(i, j < 0 ? undefined : j);
  };
  // code only — the comment above the COUNT names the list it replaces
  const fr = body("export async function getFunnelReport").split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");
  check("getFunnelReport: countWorkableLeads, nem listLeadPage", /countWorkableLeads\(\)/.test(fr) && !/listLeadPage\(/.test(fr));
  check("listLeadPage nem kéri a teljes raw-t", !/"lead\.raw as raw"/.test(body("export async function listLeadPage")));
} finally {
  await pool.end();
}
console.log(fail ? `\n⛔ LEAD-COUNT-PARITY: ${fail} bukás` : "\n🟢 LEAD-COUNT-PARITY: a könnyített lista és az Irányítópult ugyanazt mutatja, mint eddig");
process.exit(fail ? 1 : 0);
