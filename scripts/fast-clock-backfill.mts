// Visszamenőleg: a gyorsított órás gépi látogatások (levélszűrő) → device 'bot'.
//
// A 2026-11-13-i javítás (src/analytics/fastClock.ts + recordEvent) csak az ÚJ látogatásokat
// jelöli. A korábbiak a Tevékenység-lapon, a lead-oldal „{n} megnyitás”-ában és a funnel
// 'opened' státuszában emberként számítanak. Ez a szkript UGYANAZT a szabályt futtatja a
// tárolt eseményeken (a dwell/dwell_end beérkezési ideje a látogatás kezdetéhez mérve), és
// ugyanazt a `markViewAsMachine`-t hívja, amit az élő út: device → 'bot', az 'opened' →
// 'sent', ha nem maradt emberi látogatás, és a látogatás által kiadott, fel nem használt
// eszkalációs ajánlat lejár.
//
// Száraz futás ALAPBÓL (csak listáz). Írás: `--go`.
//
//   npx tsx scripts/fast-clock-backfill.mts           # száraz futás
//   npx tsx scripts/fast-clock-backfill.mts --go      # végrehajtja

import { sql } from "kysely";
import { db } from "../src/db/client.js";
import { isFastClock } from "../src/analytics/fastClock.js";
import { checkShadowView, markViewAsMachine } from "../src/console/data.js";

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== "--go");
if (unknown.length) {
  console.error(`ismeretlen kapcsoló: ${unknown.join(" ")} — csak a --go létezik (alapból száraz futás)`);
  process.exit(2);
}
const GO = args.includes("--go");

const rows = await db
  .selectFrom("mock_event")
  .innerJoin("mock_view", "mock_view.id", "mock_event.mock_view_id")
  .select([
    "mock_view.id as viewId",
    "mock_view.prospect_id as prospectId",
    "mock_view.started_at as startedAt",
    "mock_view.device as device",
    "mock_view.browser as browser",
    "mock_event.payload as payload",
    "mock_event.occurred_at as occurredAt",
  ])
  .where("mock_event.type", "in", ["dwell", "dwell_end"])
  .where((eb) => eb.or([eb("mock_view.device", "is", null), eb("mock_view.device", "!=", "bot")]))
  .execute();

const hits = new Map<string, { prospectId: string; startedAt: Date; browser: string | null; claimed: number; elapsed: number }>();
for (const r of rows) {
  if (hits.has(r.viewId)) continue;
  const pl = (r.payload ?? {}) as Record<string, unknown>;
  const claimed = typeof pl.seconds === "number" ? pl.seconds : Number.NaN;
  const startedAt = new Date(r.startedAt as unknown as string);
  const elapsed = (new Date(r.occurredAt as unknown as string).getTime() - startedAt.getTime()) / 1000;
  if (isFastClock(claimed, elapsed)) {
    hits.set(r.viewId, { prospectId: r.prospectId, startedAt, browser: r.browser, claimed, elapsed });
  }
}

console.log(`${GO ? "VÉGREHAJTVA" : "SZÁRAZ FUTÁS (írás: --go)"} — ${hits.size} gyorsított órás látogatás (${rows.length} olvasás-esemény átnézve)`);
for (const [viewId, h] of hits) {
  console.log(
    `  ${viewId.slice(0, 8)} · prospect ${h.prospectId.slice(0, 8)} · ${h.startedAt.toISOString()} · ${h.browser ?? "?"} · ${h.claimed} mp ${h.elapsed.toFixed(1)} mp alatt`,
  );
  if (GO) await markViewAsMachine(h.prospectId, viewId, h.startedAt);
}
// ② SHADOW opens (fastClock.ts isShadowOpen): desktop, silent, seconds after another view.
// checkShadowView judges AND marks — so the dry run only lists the candidates by the same SQL shape.
const desk = await db
  .selectFrom("mock_view")
  .select(["id", "started_at"])
  .where("device", "=", "desktop")
  .where(sql<boolean>`started_at < now() - interval '2 minutes'`)
  .where(({ not, exists, selectFrom }) =>
    not(exists(selectFrom("mock_event").select("mock_event.id").whereRef("mock_event.mock_view_id", "=", "mock_view.id").where("mock_event.type", "not in", ["open", "section_seen"]))),
  )
  .execute();
let shadows = 0;
for (const d of desk) {
  if (GO) {
    if (await checkShadowView(d.id)) {
      shadows++;
      console.log(`  árnyék: ${d.id.slice(0, 8)} · ${new Date(d.started_at as unknown as string).toISOString()}`);
    }
  } else {
    const prev = await db
      .selectFrom("mock_view as o")
      .innerJoin("mock_view as me", "me.prospect_id", "o.prospect_id")
      .select("o.id")
      .where("me.id", "=", d.id)
      .where("o.id", "!=", d.id)
      .where(sql<boolean>`o.started_at <= me.started_at and o.started_at >= me.started_at - interval '30 seconds'`)
      .executeTakeFirst();
    if (prev) {
      shadows++;
      console.log(`  árnyék-jelölt: ${d.id.slice(0, 8)} · ${new Date(d.started_at as unknown as string).toISOString()}`);
    }
  }
}
console.log(`${GO ? "VÉGREHAJTVA" : "SZÁRAZ FUTÁS"} — ${shadows} árnyék-megnyitás (néma asztali ikerlátogatás)`);
if (GO) {
  const left = await db
    .selectFrom("mock_view")
    .select(db.fn.countAll().as("n"))
    .where("id", "in", hits.size ? [...hits.keys()] : ["00000000-0000-0000-0000-000000000000"])
    .where((eb) => eb.or([eb("device", "is", null), eb("device", "!=", "bot")]))
    .executeTakeFirstOrThrow();
  console.log(`utóellenőrzés: ${left.n} jelöletlen maradt`);
  if (Number(left.n) !== 0) process.exitCode = 1;
}
await db.destroy();
