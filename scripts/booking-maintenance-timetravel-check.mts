// ⏰ IDŐUTAZÓ ŐR az óránkénti foglalás-karbantartás két, eddig csak egy-egy pontján mért
// söprésére (scripts/booking-maintenance.mts → systemd `citoviso-booking-maintenance`, óránként):
//
//   ⑫ expireStaleOffers   — a vendég által meg nem válaszolt árajánlat lejár (booking-offer ⑫)
//   ⑥ maintainDatedPrices — a dátumos ár 14 nappal a vége előtt EGYSZER emlékeztet, a vége
//                           után lekerül, és az oldal újrarenderelődik (booking-offer ⑥)
//
// A MÉRT HIÁNY, amiért létezik (deploy-készenlét, 2026-09-29). A 48 órás kérés-lejáratnak
// (FK-006 `bookingexpire`) és a megújításnak VAN időutazó mérése; ennek a kettőnek csak a
// `booking-offer-check` egy-egy mintavétele (49 óra → lejárt; egyszer lefuttatva → egy levél).
// Ami ott NINCS mérve, és egy óránként futó söprésnél a valódi kockázat:
//   · a HATÁR — 47 óra még él, 48 óra + 1 perc már nem; a 15. nap még csendes, a 14. szól;
//     a lejárat NAPJÁN az ár még érvényes, másnap tűnik el;
//   · az IDEMPOTENCIA az óránkénti futásra — napokon át, óránként kétszer söpörve is PONTOSAN
//     egy emlékeztető és pontosan egy lejárat-levélpár;
//   · a site SAJÁT határideje (autoDeclineHours 24 / 0 = soha) — nem a beégetett 48;
//   · a NEGATÍV kontrollok: a „kért napokra” (bélyeggel született) sor és a szezon ÉVES ára
//     nem kap levelet (ADR-0267 ③, 0074), az időtlen alapár és a szezon sosem kerül le.
//
// ⭐ AZ ÓRA ELTOLÁSA = A FIXTÚRA DÁTUMAINAK VISSZATOLÁSA, nem előretolt `today`/`now`. Mindkét
// söprés GLOBÁLIS (a gate-lane-check SWEEPS listáján is): egy előretolt `today` a közös dev DB
// idegen, MA még érvényes dátumos árait törölné, és a tulajuknak levelet küldene. A fixtúra
// visszatolásával a söprés pontosan azt látja, amit a valódi óra N nappal/órával később — és
// idegen sorhoz csak annyiban nyúl, amennyiben az óránkénti időzítő most úgyis nyúlna. Ezt az
// ELŐ-ellenőrzés méri: ha a söprés ma idegen sort érintene, az őr NEM fut (hangosan bukik).
// Ezért az őr NEM `gate-lane: own-fixture-only` — a sorosított sávban fut.
//
// Levelek: mock postafiók (EMAIL_PROVIDER=mock, a dinamikus import ELŐTT), @example.com címek.
// Az időzítő (fő fa, cwd = /home/citoviso/citoviso) a futás közben a mi fixtúránkat is
// söpörheti — a levele akkor a FŐ FA outbox/-ába kerül (ReservedRecipientGuard). Ezért a
// levél-számlálás MINDKÉT outbox/-ot olvassa, a futásra egyedi címzett-bélyegre és a futás
// kezdeténél frissebb mtime-ra szűrve, és az ítélet a DB-állapotra + a levelekre épül, nem a
// függvények visszatérési számára (azt az időzítő elvehetné).
//
// Takarítás: fixtúra + a tenant_message sorai (a levél-naplózás DB-t ír,
// reference_booking_mail_preview_writes_tenant_message) + a sites/<slug>/ mappa.
// Chromium NEM kell.
//
//   npx tsx scripts/booking-maintenance-timetravel-check.mts

process.env.PUBLIC_PORT = "0";
// ⛔ Mindkét söprés LEVELET küld; dev-ben EMAIL_PROVIDER=smtp él. A mock adapter outbox/-ba ír.
// A dinamikus import ELŐTT kell (a config az env-et betöltéskor olvassa).
process.env.EMAIL_PROVIDER = "mock";

if (process.env.DATABASE_URL) {
  console.error("⛔ DATABASE_URL be van állítva — ez az őr CSAK a lokál dev DB-n futhat.");
  process.exit(1);
}

import { readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const MAIN_TREE = "/home/citoviso/citoviso";
const { db, pool } = await import("../src/db/client.js");
const { setTenantModules } = await import("../src/tenant/modules.js");
const { setSiteModuleConfig } = await import("../src/tenant/siteModuleConfig.js");
const { addSeasonPrice, setSeasonYearPrice, setBasePrice, addDatedBasePrice, getUnitPrices } = await import(
  "../src/tenant/prices.js"
);
const { rerenderTenantSnapshot } = await import("../src/tenant/editor.js");
const req = await import("../src/booking/requests.js");
const { maintainDatedPrices, REMIND_DAYS } = await import("../src/tenant/priceExpiry.js");

const ids: Record<string, string> = {};
let siteDir = "";
let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  if (c) console.log(`  ✓ ${n}`);
  else {
    fail++;
    console.error(`  ✗ ${n}${d === undefined ? "" : " — " + JSON.stringify(d).slice(0, 500)}`);
  }
};

const STARTED = Date.now() - 1000;
const STAMP = Date.now().toString(36);
const OWNER = `tt-owner-${STAMP}@example.com`;
const GUEST = `tt-guest-${STAMP}@example.com`;

interface Mail {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  readonly file: string;
}
/** Every mail of THIS run to `who`, from our outbox and the hourly timer's (main tree). */
async function mailsTo(who: string): Promise<Mail[]> {
  // Sends are awaited in both sweeps; the beat is for a timer run overlapping ours.
  await new Promise((r) => setTimeout(r, 150));
  const out: Mail[] = [];
  const dirs = [...new Set([path.join(ROOT, "outbox"), path.join(MAIN_TREE, "outbox")])];
  for (const dir of dirs) {
    let files: string[] = [];
    try {
      files = await readdir(dir);
    } catch {
      continue;
    }
    for (const f of files) {
      const p = path.join(dir, f);
      const st = await stat(p).catch(() => null);
      if (!st || st.mtimeMs < STARTED) continue;
      const raw = await readFile(p, "utf8");
      const to = /^To: (.*)$/m.exec(raw)?.[1] ?? "";
      if (!to.includes(who)) continue;
      out.push({
        to,
        subject: /^Subject: (.*)$/m.exec(raw)?.[1] ?? "",
        body: raw.slice(raw.indexOf("\n\n") + 2),
        file: p,
      });
    }
  }
  return out.sort((a, b) => a.file.localeCompare(b.file));
}
const seen = new Set<string>();
/** Mails to `who` not returned by an earlier call. */
async function newMailsTo(who: string): Promise<Mail[]> {
  const n = (await mailsTo(who)).filter((m) => !seen.has(m.file));
  n.forEach((m) => seen.add(m.file));
  return n;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const niceIso = (iso: string): string => `${iso.slice(0, 4)}. ${iso.slice(5, 7)}. ${iso.slice(8, 10)}.`;
const HOUR = 3_600_000;
/** One simulated hourly tick: the two sweeps in the order booking-maintenance.mts runs them. */
async function tick(today: string): Promise<void> {
  await req.expireStaleOffers();
  await maintainDatedPrices(today);
}

try {
  // The sweeps' clock is UTC-dated (priceExpiry: `new Date().toISOString().slice(0, 10)`).
  const today = new Date().toISOString().slice(0, 10);

  // ── ELŐ-ellenőrzés: a globális söprés ma NEM érinthet idegen sort ────────────────────
  console.log("\n⓪ Elő-ellenőrzés — a söprés most csak a saját fixtúrát érintheti");
  const foreignOffers = (await db
    .selectFrom("booking_request")
    .select(["id", "site_id", "offered_at"])
    .where("status", "=", "offered")
    .execute()) as { id: string; site_id: string; offered_at: Date | null }[];
  let foreignLapsed = 0;
  for (const r of foreignOffers) {
    const exp = req.offerExpiresAt(r.offered_at, await req.bookingExpireHours(r.site_id));
    if (exp && exp.getTime() <= Date.now()) foreignLapsed++;
  }
  const foreignDated = await db
    .selectFrom("unit_price")
    .select(["id", "valid_to", "date_from", "expiry_notified_at"])
    .where("valid_to", "is not", null)
    .where((eb) =>
      eb.or([
        eb("valid_to", "<", today),
        eb.and([
          eb("date_from", "is", null),
          eb("expiry_notified_at", "is", null),
          eb("valid_to", "<=", addDays(today, REMIND_DAYS)),
        ]),
      ]),
    )
    .execute();
  check(
    "a söprés ma egyetlen idegen ajánlatot sem járatna le (különben az időzítő dolgát venném el, levéllel)",
    foreignLapsed === 0,
    { foreignLapsed },
  );
  check(
    "…és egyetlen idegen dátumos árat sem emlékeztetne/törölne",
    foreignDated.length === 0,
    foreignDated.map((r) => r.id),
  );
  if (fail) throw new Error("ELŐ-ELLENŐRZÉS: a söprés idegen sort érintene — az őr NEM fut (futtasd az óránkénti időzítő után újra)");

  // ── fixture ──────────────────────────────────────────────────────────────────────────
  const def = await db.insertInto("scraper_definition").values({ label: "_timetravel", country: "HU", region: "_t", industry: "accommodation", sources: JSON.stringify(["osm"]) }).returning("id").executeTakeFirstOrThrow();
  ids.defId = def.id;
  const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, stats: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.runId = run.id;
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id, name: "_timetravel lead", raw: JSON.stringify({}) }).returning("id").executeTakeFirstOrThrow();
  ids.leadId = lead.id;
  const tenant = await db.insertInto("tenant").values({ lead_id: lead.id, display_name: "Időutazó Vendégház (teszt)" }).returning("id").executeTakeFirstOrThrow();
  ids.tenantId = tenant.id;
  const art = await db.selectFrom("site").innerJoin("mock_artifact", "mock_artifact.id", "site.source_artifact_id")
    .select("site.source_artifact_id as id").where("site.status", "=", "live").where("site.source_artifact_id", "is not", null).executeTakeFirst();
  if (!art?.id) throw new Error("nincs használható artifact");
  const slug = `timetravel-${STAMP}`;
  const site = await db.insertInto("site").values({
    tenant_id: tenant.id, preview_token: `timetravel_${STAMP}`, slug, status: "live", live_at: new Date(),
    path: `sites/${slug}/index.html`, source_artifact_id: art.id,
    edited_site_data: JSON.stringify({ name: "Időutazó Vendégház", intro: "Időutazó teszt.", photos: [], highlights: ["a", "b"], contact: { address: "8600 Siófok, Teszt u. 2.", email: OWNER }, businessType: "accommodation" }),
  }).returning("id").executeTakeFirstOrThrow();
  ids.siteId = site.id;
  siteDir = path.join(ROOT, "sites", slug);
  const legacy = await db.insertInto("site_unit").values({ site_id: site.id, name: "Emeleti szoba", capacity: 4, sort_order: 1 }).returning("id").executeTakeFirstOrThrow();
  const stamped = await db.insertInto("site_unit").values({ site_id: site.id, name: "Padlásszoba", capacity: 2, sort_order: 2 }).returning("id").executeTakeFirstOrThrow();
  const seasonal = await db.insertInto("site_unit").values({ site_id: site.id, name: "Földszinti szoba", capacity: 2, sort_order: 3 }).returning("id").executeTakeFirstOrThrow();
  const annex = await db.insertInto("site_unit").values({ site_id: site.id, name: "Kerti ház", capacity: 2, sort_order: 4 }).returning("id").executeTakeFirstOrThrow();
  const tu = await db.insertInto("tenant_user").values({ tenant_id: tenant.id, username: `timetravel_${STAMP}`, contact_email: OWNER, password_hash: null }).returning("id").executeTakeFirstOrThrow();
  ids.tuId = tu.id;
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: OWNER }, "test");
  await setTenantModules(tenant.id, ["booking", "pricing", "rooms"]);

  // ═══ ⑫ AZ ÁRAJÁNLAT LEJÁRATA ═══════════════════════════════════════════════════════════
  console.log("\n⑫ Árajánlat-lejárat — határ, a site saját határideje, idempotencia");
  const mk = async (from: string, to: string): Promise<string> => {
    const r = await req.createBookingRequest(
      { siteId: site.id, unitId: annex.id, guestName: "Tóth Zsófia", guestEmail: GUEST, guestPhone: "+36 30 222 3333", dateFrom: from, dateTo: to, guests: 2, message: null },
      null,
    );
    if (!r.ok || !r.id) throw new Error("kérés bukott: " + r.errors.join(","));
    const tokRow = await db.selectFrom("booking_request").select("action_token").where("id", "=", r.id).executeTakeFirstOrThrow();
    const s = await req.sendOffer(tokRow.action_token, { amount: "21 000" }, null);
    if (!s.ok) throw new Error("ajánlat bukott: " + s.errors.join(","));
    return r.id;
  };
  /** Move the offer's clock: it was sent `hours` ago. */
  const age = async (id: string, hours: number): Promise<void> => {
    await db.updateTable("booking_request").set({ offered_at: new Date(Date.now() - hours * HOUR) }).where("id", "=", id).execute();
  };
  const row = async (id: string) =>
    db.selectFrom("booking_request").select(["status", "decided_by", "decided_at", "date_from", "date_to"]).where("id", "=", id).executeTakeFirstOrThrow();
  const dayStr = (d: unknown): string => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

  const s = (k: number): [string, string] => [addDays(today, 40 + 4 * k), addDays(today, 42 + 4 * k)];
  const oA = await mk(...s(0)); // 49 h → lapses
  const oB = await mk(...s(1)); // 47 h → stays under 48, lapses under 24
  const oC = await mk(...s(2)); // 48 h + 1 min → lapses (the boundary)
  const oD = await mk(...s(3)); // 23 h under 24 → stays; 500 h under 0 → stays
  ids.offers = [oA, oB, oC, oD].join(",");
  await newMailsTo(GUEST);
  await newMailsTo(OWNER);

  await age(oA, 49);
  await age(oB, 47);
  await age(oC, 48 + 1 / 60);
  await age(oD, 1);
  await tick(today);
  const [rA, rB, rC, rD] = await Promise.all([row(oA), row(oB), row(oC), row(oD)]);
  check("49 óra (alap 48) → lejárt, a rendszer döntött", rA.status === "expired" && rA.decided_by === "system" && !!rA.decided_at, rA);
  check("48 óra + 1 perc → lejárt (a határ a küldéstől számít)", rC.status === "expired", rC);
  check("NEGATÍV: 47 óra → még él", rB.status === "offered", rB);
  check("NEGATÍV: 1 óra → még él", rD.status === "offered", rD);

  const gM = await newMailsTo(GUEST);
  const oM = await newMailsTo(OWNER);
  const guestExp = (id: string, r: { date_from: unknown; date_to: unknown }) =>
    gM.filter((m) => m.subject === `Az árajánlat lejárt: ${niceIso(dayStr(r.date_from))} — ${niceIso(dayStr(r.date_to))}`);
  const ownerExp = (r: { date_from: unknown; date_to: unknown }) =>
    oM.filter((m) => m.subject === `Lejárt egy árajánlat: Tóth Zsófia, ${niceIso(dayStr(r.date_from))} — ${niceIso(dayStr(r.date_to))}`);
  check("a vendég PONTOSAN egy lejárat-levelet kap mindkét lejárt ajánlatra", guestExp(oA, rA).length === 1 && guestExp(oC, rC).length === 1, gM.map((m) => m.subject));
  check("…a levél megszólítja, és új ajánlatot kínál", /Kedves Tóth Zsófia!/.test(guestExp(oA, rA)[0]?.body ?? "") && /kérjen új ajánlatot/.test(guestExp(oA, rA)[0]?.body ?? ""), (guestExp(oA, rA)[0]?.body ?? "").slice(0, 400));
  check("a tulaj PONTOSAN egy „Lejárt egy árajánlat” levelet kap mindkettőre", ownerExp(rA).length === 1 && ownerExp(rC).length === 1, oM.map((m) => m.subject));
  check("…a levél kimondja: a vendéget értesítettük, a napok szabadok", /A vendéget értesítettük, a napok szabadok/.test(ownerExp(rA)[0]?.body ?? ""), (ownerExp(rA)[0]?.body ?? "").slice(0, 400));
  check("NEGATÍV: az élő ajánlatokról senki nem kap levelet", gM.length === 2 && oM.length === 2, { g: gM.map((m) => m.subject), o: oM.map((m) => m.subject) });
  const logged = await db.selectFrom("tenant_message").select(["subject", "related_id"]).where("tenant_id", "=", tenant.id).where("related_id", "in", [oA, oC]).execute();
  check("a tulaj-levél a tenant üzenetei közé naplózva (a lejárt kéréshez kötve)", logged.filter((l) => /^Lejárt egy árajánlat/.test(l.subject)).length === 2, logged);

  // Idempotency: the hourly timer keeps running over the same rows.
  for (let h = 1; h <= 3; h++) await tick(today);
  check("IDEMPOTENS: három további óránkénti söprés → egyetlen új levél sem", (await newMailsTo(GUEST)).length === 0 && (await newMailsTo(OWNER)).length === 0);
  check("…és a státusz nem mozdul", (await row(oA)).status === "expired" && (await row(oB)).status === "offered");

  // The site's own deadline decides, not the built-in 48.
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: OWNER, autoDeclineHours: 24 }, "test");
  await age(oD, 23);
  await tick(today);
  check("autoDeclineHours = 24: a 47 órás ajánlat MOST lejár", (await row(oB)).status === "expired", await row(oB));
  check("NEGATÍV: …a 23 órás él", (await row(oD)).status === "offered", await row(oD));
  const g24 = await newMailsTo(GUEST);
  const o24 = await newMailsTo(OWNER);
  check("…és csak róla megy egy-egy levél", g24.length === 1 && o24.length === 1, { g: g24.map((m) => m.subject), o: o24.map((m) => m.subject) });

  await setSiteModuleConfig(site.id, "booking", { notifyEmail: OWNER, autoDeclineHours: 0 }, "test");
  await age(oD, 500);
  await tick(today);
  check("autoDeclineHours = 0 (soha): 500 óra után is él", (await row(oD)).status === "offered", await row(oD));
  check("…levél nélkül", (await newMailsTo(GUEST)).length === 0 && (await newMailsTo(OWNER)).length === 0);
  await setSiteModuleConfig(site.id, "booking", { notifyEmail: OWNER }, "test");
  // Positive control for the ≥0 branch: back on the default, the SAME row lapses — the
  // "stays" above is the setting, not a sweep that skips this row.
  await tick(today);
  check("POZITÍV KONTROLL: vissza az alapra (48) → ugyanez a sor lejár", (await row(oD)).status === "expired", await row(oD));
  await newMailsTo(GUEST);
  await newMailsTo(OWNER);

  // ═══ ⑥ A DÁTUMOS ÁR AZ IDŐBEN ═════════════════════════════════════════════════════════
  console.log(`\n⑥ Dátumos ár — napról napra, óránként kétszer söpörve (${REMIND_DAYS} napos emlékeztető)`);
  const LEGACY_AMT = 23_457;
  const STAMPED_AMT = 23_458;
  const YEAR_AMT = 23_459;
  const BASE_AMT = 11_113;
  // Rows are placed with their window already ending in 20 days; each simulated day then
  // moves the window one day closer — exactly what the real clock does to a stored row.
  const START = 20;
  const vFrom = (d: number): string => addDays(today, d - 30);
  // ① a pre-ADR-0267 row: no stamp → owed the reminder (inserted as it was written then).
  const lg = await db.insertInto("unit_price").values({ unit_id: legacy.id, label: null, date_from: null, date_to: null, amount: LEGACY_AMT, min_nights: null, sort_order: 0, valid_from: vFrom(START), valid_to: addDays(today, START) }).returning("id").executeTakeFirstOrThrow();
  // ② the offer path's „a kért napokra” row: born stamped (ADR-0267 ③) → no mail, still removed.
  await addDatedBasePrice(stamped.id, STAMPED_AMT, vFrom(START), addDays(today, START), { remind: false });
  // ③ a season's YEAR price (0074): no "lejár egy ár" mail, removed when it lapses.
  const season = await addSeasonPrice(seasonal.id, "Főszezon", "07-01", "08-31", 30_000);
  if (!season.ok) throw new Error("szezon-ár nem ment: " + season.errors.join(","));
  const seasonRow = (await getUnitPrices(seasonal.id)).find((p) => p.label === "Főszezon" && !p.parentId);
  if (!seasonRow) throw new Error("a szezon-sor nem található");
  let yr = Number(today.slice(0, 4));
  if (`${yr}-08-31` < today) yr++;
  const yp = await setSeasonYearPrice(site.id, seasonRow.id, { year: yr, amount: String(YEAR_AMT) }, today);
  if (!yp.ok) throw new Error("éves ár nem ment: " + yp.errors.join(","));
  // ④ the TIMELESS base price and the recurring season: never touched.
  await setBasePrice(legacy.id, BASE_AMT);

  const datedIds = async (): Promise<Record<string, string | undefined>> => {
    const rows = await db.selectFrom("unit_price").select(["id", "unit_id", "parent_id", "valid_to"]).where("unit_id", "in", [legacy.id, stamped.id, seasonal.id]).where("valid_to", "is not", null).execute();
    return {
      legacy: rows.find((r) => r.unit_id === legacy.id)?.id,
      stamped: rows.find((r) => r.unit_id === stamped.id)?.id,
      year: rows.find((r) => r.unit_id === seasonal.id && r.parent_id)?.id,
    };
  };
  const place = async (d: number): Promise<void> => {
    const live = Object.values(await datedIds()).filter((x): x is string => !!x);
    if (live.length) await db.updateTable("unit_price").set({ valid_from: vFrom(d), valid_to: addDays(today, d) }).where("id", "in", live).execute();
  };
  await place(START);
  const d0 = await datedIds();
  check("fixtúra: mindhárom dátumos sor él (bélyeg nélküli · bélyeggel született · éves)", !!d0.legacy && !!d0.stamped && !!d0.year, d0);
  if (!(await rerenderTenantSnapshot(tenant.id, { as: "live" }))) throw new Error("render bukott");
  const page = async (): Promise<string> => readFile(path.join(siteDir, "index.html"), "utf8").catch(() => "");
  const shows = (html: string, n: number): boolean => new RegExp(String(n).replace(/(\d{2})(\d{3})$/, "$1[\\s\\u00a0\\u202f.,]?$2")).test(html);
  const html0 = await page();
  check("POZITÍV KONTROLL: a honlap a bélyeg nélküli dátumos árat MUTATJA a söprés előtt", shows(html0, LEGACY_AMT), { len: html0.length });

  const reminderDays: { d: number; to: string; subject: string; body: string }[] = [];
  const presentAt: Record<number, Record<string, boolean>> = {};
  const legacyValidToAt: Record<number, string> = {};
  for (let d = START; d >= -2; d--) {
    await place(d);
    legacyValidToAt[d] = addDays(today, d);
    // Two ticks per simulated day: the hourly timer runs 24 of them, and a rerun must stay silent.
    await tick(today);
    await tick(today);
    for (const m of (await newMailsTo(OWNER)).filter((m) => /^Hamarosan lejár egy ár/.test(m.subject))) {
      reminderDays.push({ d, to: m.to, subject: m.subject, body: m.body });
    }
    const now = await datedIds();
    presentAt[d] = { legacy: !!now.legacy, stamped: !!now.stamped, year: !!now.year };
  }

  const legacyMails = reminderDays.filter((m) => m.subject === "Hamarosan lejár egy ár: Emeleti szoba");
  check(`a bélyeg nélküli sor PONTOSAN EGY emlékeztetőt kap ${START}+ napon át, napi két söpréssel`, legacyMails.length === 1, reminderDays.map((m) => `${m.d}: ${m.subject}`));
  check(`…a ${REMIND_DAYS}. napon (a ${REMIND_DAYS + 1}. még csendes)`, legacyMails[0]?.d === REMIND_DAYS, legacyMails.map((m) => m.d));
  const lm = legacyMails[0];
  check("…a tenant értesítési címére", lm?.to === OWNER, lm?.to);
  check("…a levél az ÖSSZEGET mondja", !!lm && shows(lm.body, LEGACY_AMT), (lm?.body ?? "").slice(0, 500));
  check("…és a lejárat napját (az akkor tárolt valid_to)", !!lm && lm.body.includes(niceIso(legacyValidToAt[REMIND_DAYS]!)), { want: niceIso(legacyValidToAt[REMIND_DAYS] ?? ""), body: (lm?.body ?? "").slice(0, 500) });
  check("…és a Modulok → Árak linket", !!lm && /\/admin\?tab=modulok&m=pricing/.test(lm.body));
  const remLog = await db.selectFrom("tenant_message").select("subject").where("tenant_id", "=", tenant.id).where("subject", "=", "Hamarosan lejár egy ár: Emeleti szoba").execute();
  check("…a tenant üzenetei közé EGYSZER naplózva", remLog.length === 1, remLog.length);
  check("NEGATÍV: a „kért napokra” (bélyeggel született) sor nem kap levelet", !reminderDays.some((m) => /Padlásszoba/.test(m.subject)), reminderDays.map((m) => m.subject));
  check("NEGATÍV: a szezon ÉVES ára nem kap levelet", !reminderDays.some((m) => /Földszinti szoba/.test(m.subject)), reminderDays.map((m) => m.subject));
  check("NEGATÍV: más levél nem ment a tulajnak", reminderDays.length === 1, reminderDays.map((m) => m.subject));

  const all = (d: number) => presentAt[d]!.legacy && presentAt[d]!.stamped && presentAt[d]!.year;
  const none = (d: number) => !presentAt[d]!.legacy && !presentAt[d]!.stamped && !presentAt[d]!.year;
  check("a lejárat NAPJÁN (valid_to = ma) mindhárom sor még él — az utolsó nap is érvényes", all(0), presentAt[0]);
  check("másnap (valid_to = tegnap) mindhárom lekerül — a bélyeggel született és az éves is", none(-1), presentAt[-1]);
  check("NEGATÍV: előtte egyik sem tűnt el idő előtt", Array.from({ length: START + 1 }, (_, i) => i).every((d) => all(d)), presentAt);
  const legacyLeft = await getUnitPrices(legacy.id);
  const seasonLeft = await getUnitPrices(seasonal.id);
  check("NEGATÍV: az időtlen alapár megmarad", legacyLeft.some((p) => p.isBase && !p.validTo && p.amount === BASE_AMT), legacyLeft);
  check("NEGATÍV: az ismétlődő szezon megmarad (csak az éves sora ment el)", seasonLeft.some((p) => p.id === seasonRow.id), seasonLeft.map((p) => p.label));
  const html1 = await page();
  check("a honlap újrarenderelve: a lejárt dátumos ár már NEM látszik", html1.length > 0 && !shows(html1, LEGACY_AMT), { len: html1.length });
  check("…de az időtlen alapár igen (a render nem üres lap)", shows(html1, BASE_AMT));
} catch (err) {
  fail++;
  console.error("⛔", err instanceof Error ? err.message : err);
} finally {
  if (siteDir) await rm(siteDir, { recursive: true, force: true }).catch(() => {});
  if (ids.tuId) await db.deleteFrom("tenant_user").where("id", "=", ids.tuId).execute().catch(() => {});
  if (ids.siteId) {
    await db.deleteFrom("booking_request").where("site_id", "=", ids.siteId).execute().catch(() => {});
    await db.deleteFrom("site").where("id", "=", ids.siteId).execute();
  }
  if (ids.tenantId) {
    await db.deleteFrom("tenant_message").where("tenant_id", "=", ids.tenantId).execute().catch(() => {});
    await db.deleteFrom("tenant").where("id", "=", ids.tenantId).execute();
  }
  if (ids.leadId) await db.deleteFrom("lead").where("id", "=", ids.leadId).execute();
  if (ids.runId) await db.deleteFrom("scrape_run").where("id", "=", ids.runId).execute();
  if (ids.defId) await db.deleteFrom("scraper_definition").where("id", "=", ids.defId).execute();
  await pool.end();
}
console.log(
  fail
    ? `\n⛔ BOOKING-MAINTENANCE-TIMETRAVEL: ${fail} bukás`
    : "\n🟢 BOOKING-MAINTENANCE-TIMETRAVEL: az ajánlat-lejárat és a dátumos ár az időben a szabályt követi — határon, idempotensen",
);
process.exit(fail ? 1 : 0);
