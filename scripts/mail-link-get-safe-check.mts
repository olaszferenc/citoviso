// LEVÉL-LINK GET-ŐR — a levélben kiküldött link MEGNYITÁSA (GET) semmit nem változtat (ADR-XXXX).
//
//   npx tsx scripts/mail-link-get-safe-check.mts
//
// ⛔⛔ MIÉRT KELL (élesen mérve, 2026-10-01, Elek V-1). A tulaj foglalás-értesítőjének
// „Elfogadom / Nem szabad” linkje (`GET /foglalas/<token>/elfogadom|elutasitom`) MEGNYITÁSKOR
// döntött, a vélemény-értesítő „Kiteszem / Nem teszem ki” linkje ugyanígy. A levelezők
// link-ellenőrzője (Outlook Safe Links, Gmail-előtöltés, vírusirtó) kattintás nélkül, GET-tel
// járja végig a levél MINDEN linkjét — vagyis egy gép visszaigazolhatott vagy elutasíthatott
// egy vendég-foglalást, és kitehetett egy véleményt, amit a tulaj sosem látott. A vendég-oldali
// lemondó- és ajánlat-link már helyesen működött (GET = megerősítő lap, POST dönt); ez az őr
// ezt a szabályt mondja ki MINDEN levél-linkre.
//
// MIT MÉR (a VALÓDI public és konzol szerveren, in-process, efemer porton, saját fixtúrán):
//   ① LEFEDETTSÉG: a `MAIL_LINK_ROUTES` (src/server/mailLinkRoutes.ts — UGYANAZ a lista, amiből
//      az elosztó dolgozik) minden sorára van legalább egy próba-út. Új levél-link próba nélkül = piros.
//   ② GET NEM MUTÁL: minden próba-útra GET, és utána a fixtúra TELJES állapota (foglalási kérések
//      minden oszlopa, a naptár-napok, a vélemények, a prospect) bájtra azonos az előtte levővel.
//   ③ POZITÍV KONTROLL: ugyanaz a link POST-tal TÉNYLEG dönt (különben ② egy halott kezelőn is
//      zöld lenne — a mérés látja a mutációt, és a régi levelek linkje továbbra is működik).
//   ④ A konzol `/p/<t>/unsubscribe` GET-je (2026-09-26 óta megerősítő lap) nem iratkoztat le,
//      a POST igen.
//
// ⚠️ TUDATOS KIVÉTELEK (nem mutáció-mentesek GET-re, és ezt itt kimondjuk, nem elhallgatjuk):
//   · `GET /p/<t>` — a hideg levél mock-linkje mérést ír (mock_view) és a beállított n-edik
//     látogatásnál eszkalációs ajánlatot vereti (ADR-0088/0285). Ez a TERMÉK mérése, nem döntés;
//     a link-ellenőrző látogatása így látogatásnak számít (lásd a V-1 jelentést).
//   · `GET /pay/go/<id>` — lejárt fizetési ablaknál ÚJ fizetést indít ugyanarra a rendelésre
//     (terhelés nincs, a vevő a kapun fizet). Lásd a V-1 jelentést.
// Mutációval igazolva: a régi (GET-re döntő) kódon ② a két tulaj-linkre PIROS.
process.env.CIT_SHOT = "1";
process.env.PUBLIC_PORT = "0";
process.env.CONSOLE_PORT = "0";
process.env.DATABASE_URL = "";
// A POST-kontroll levelet küld (a vendégnek, a tulajnak): a mock postafiókba menjen, ne a
// hálózatra. ⚠️ CSAK azért hat, mert alább minden projekt-modul DINAMIKUSAN töltődik be.
process.env.EMAIL_PROVIDER = "mock";

import http from "node:http";
import { once } from "node:events";
import { randomBytes } from "node:crypto";

const { MAIL_LINK_ROUTES, RE_OWNER_DECIDE, RE_OWNER_REVIEW } = await import("../src/server/mailLinkRoutes.js");
const { server: pub } = (await import("../src/server/public.js")) as { server: http.Server };
const { server: con } = (await import("../src/console/server.js")) as { server: http.Server };
const { db, pool } = await import("../src/db/client.js");
const { sql } = await import("kysely");
for (const s of [pub, con]) if (!s.listening) await once(s, "listening");
const portOf = (s: http.Server): number => (s.address() as { port: number }).port;

interface Reply { status: number; location: string; body: string }
function call(server: http.Server, method: "GET" | "POST", path: string, body = ""): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port: portOf(server),
        path,
        method,
        headers: {
          Host: "citoviso.com",
          accept: "text/html",
          ...(method === "POST"
            ? { "content-type": "application/x-www-form-urlencoded", "content-length": String(Buffer.byteLength(body)) }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            location: String(res.headers.location ?? ""),
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end(method === "POST" ? body : undefined);
  });
}

let failed = 0;
function check(label: string, ok: boolean, detail = ""): void {
  console.log(`  ${ok ? "✅" : "⛔"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

const tok = (): string => randomBytes(18).toString("base64url");
const { createFixtureParent } = await import("./lib/fixture-parent.mts");
const parent = await createFixtureParent(db as never, "getsafe");

let siteId = "";
let tenantId = "";
let leadId = "";

async function main(): Promise<void> {
  // ── fixtúra: saját lead → tenant → site (élő) → egységek, kérések, vélemény, prospect ──
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: parent.runId, name: "GET-őr teszt", raw: sql`'{}'::jsonb` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leadId = lead.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "GET-őr teszt" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  tenantId = tenant.id;
  const stamp = Date.now();
  const site = await db
    .insertInto("site")
    .values({
      tenant_id: tenant.id,
      preview_token: `getsafe${stamp}`,
      status: "live",
      path: `sites/${tenant.id}/index.html`,
      slug: `getsafe-${stamp}`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  siteId = site.id;
  const { ensureUnits, getUnits } = await import("../src/tenant/units.js");
  await ensureUnits(siteId);
  const unit = (await getUnits(siteId))[0]!;

  // Far-future, non-overlapping stays: nothing here can collide with a real calendar.
  const req = (status: string, from: string, to: string, extra: Record<string, unknown> = {}) =>
    db
      .insertInto("booking_request")
      .values({
        site_id: siteId,
        unit_id: unit.id,
        guest_name: "Próba Vendég",
        guest_email: "getsafe-vendeg@example.com",
        date_from: from,
        date_to: to,
        guests: 2,
        status,
        action_token: tok(),
        ...extra,
      } as never)
      .returning(["id", "action_token"])
      .executeTakeFirstOrThrow();
  const priced = { quoted_total: 40000, quoted_currency: "HUF" };
  const pendingPriced = await req("pending", "2099-03-02", "2099-03-04", priced);
  // Each verdict probe gets its OWN pending row: a probe that fires on a row the previous
  // one already decided would hit the idempotent "already" branch and pass blind.
  const pendingPriced2 = await req("pending", "2099-03-05", "2099-03-07", priced);
  const pendingUnpriced = await req("pending", "2099-03-10", "2099-03-12");
  const pendingUnpriced2 = await req("pending", "2099-03-13", "2099-03-15");
  const accepted = await req("accepted", "2099-03-20", "2099-03-22", priced);
  for (const day of ["2099-03-20", "2099-03-21"]) {
    await db
      .insertInto("availability_day")
      .values({ unit_id: unit.id, day, state: "booked", source: `booking:${accepted.id}` })
      .execute();
  }
  const offerToken = tok();
  const offered = await req("offered", "2099-04-02", "2099-04-04", {
    ...priced,
    offered_at: new Date(),
    offer_token: offerToken,
  });
  const mkReview = () => db
    .insertInto("site_review")
    .values({
      site_id: siteId,
      author_name: "Próba Szerző",
      author_email: null,
      rating: 5,
      body: "GET-őr próba-vélemény.",
      action_token: tok(),
    } as never)
    .returning(["id", "action_token"])
    .executeTakeFirstOrThrow();
  const review = await mkReview();
  const review2 = await mkReview();
  const prospectToken = tok();
  await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, token: prospectToken } as never)
    .execute();

  /** Everything a mail link could change, as one comparable string. */
  const snapshot = async (): Promise<string> => {
    const [reqs, days, revs, pros] = await Promise.all([
      db.selectFrom("booking_request").selectAll().where("site_id", "=", siteId).orderBy("id").execute(),
      db.selectFrom("availability_day").selectAll().where("unit_id", "=", unit.id).orderBy("day").execute(),
      db.selectFrom("site_review").selectAll().where("site_id", "=", siteId).orderBy("id").execute(),
      db.selectFrom("prospect").selectAll().where("lead_id", "=", leadId).execute(),
    ]);
    return JSON.stringify({ reqs, days, revs, pros });
  };

  // Every GET a mail-link scanner could make. `re` ties the probe to the route list.
  const probes: { label: string; path: string; server: http.Server }[] = [
    { label: "tulaj: elfogadom (árazott)", path: `/foglalas/${pendingPriced.action_token}/elfogadom`, server: pub },
    { label: "tulaj: elutasitom (árazott)", path: `/foglalas/${pendingPriced2.action_token}/elutasitom`, server: pub },
    { label: "tulaj: elfogadom (ár nélkül → ajánlat)", path: `/foglalas/${pendingUnpriced.action_token}/elfogadom`, server: pub },
    { label: "tulaj: elutasitom (ár nélkül)", path: `/foglalas/${pendingUnpriced2.action_token}/elutasitom`, server: pub },
    { label: "tulaj: ajánlat-lap", path: `/foglalas/${pendingUnpriced.action_token}/ajanlat`, server: pub },
    { label: "vendég: lemondom", path: `/foglalas/${accepted.action_token}/lemondom`, server: pub },
    { label: "vendég: ajánlat-lap", path: `/ajanlat/${offerToken}`, server: pub },
    { label: "vendég: ajánlat elfogadom", path: `/ajanlat/${offerToken}/elfogadom`, server: pub },
    { label: "vendég: ajánlat nem-kerem", path: `/ajanlat/${offerToken}/nem-kerem`, server: pub },
    { label: "tulaj: vélemény kiteszem", path: `/velemeny/${review.action_token}/kiteszem`, server: pub },
    { label: "tulaj: vélemény nem-teszem-ki", path: `/velemeny/${review2.action_token}/nem-teszem-ki`, server: pub },
    { label: "lead: leiratkozás", path: `/p/${prospectToken}/unsubscribe`, server: con },
  ];

  console.log("① lefedettség: minden levél-link útvonalnak van próbája");
  for (const r of MAIL_LINK_ROUTES) {
    const n = probes.filter((p) => r.re.test(p.path)).length;
    check(`${r.who}: ${r.re.source}`, n > 0, `${n} próba`);
  }

  console.log("② GET nem mutál");
  let before = await snapshot();
  for (const p of probes) {
    const r = await call(p.server, "GET", p.path);
    const after = await snapshot();
    check(`${p.label}: GET ${p.path.replace(/\/[A-Za-z0-9_-]{16,}/, "/<t>")}`, after === before, `${r.status}${r.location ? ` → ${r.location}` : ""}${after === before ? "" : " · ÁLLAPOT VÁLTOZOTT"}`);
    // The confirm page must carry the ONE way to decide: a POST form to the very same URL.
    if ((RE_OWNER_DECIDE.test(p.path) || RE_OWNER_REVIEW.test(p.path)) && r.status === 200) {
      check(`${p.label}: a lap POST-űrlapja ugyanerre az URL-re`, r.body.includes(`<form method="post" action="${p.path}"`));
    }
    // A mutating probe must not poison the next one's baseline: the next GET is measured
    // against the state THIS one left behind, so every offender is named, not just the first.
    before = after;
  }

  console.log("③ pozitív kontroll: POST dönt (a régi levél linkje is működik)");
  const status = async (id: string) =>
    (await db.selectFrom("booking_request").select("status").where("id", "=", id).executeTakeFirstOrThrow()).status;
  const ok = await call(pub, "POST", `/foglalas/${pendingPriced.action_token}/elfogadom`);
  const booked = await db.selectFrom("availability_day").select("day").where("source", "=", `booking:${pendingPriced.id}`).execute();
  check("POST elfogadom → accepted + 2 foglalt nap", (await status(pendingPriced.id)) === "accepted" && booked.length === 2, `${ok.status} · ${booked.length} nap`);
  const d = await call(pub, "POST", `/foglalas/${pendingPriced2.action_token}/elutasitom`);
  check("POST elutasitom → declined", (await status(pendingPriced2.id)) === "declined", `${d.status}`);
  const a = await call(pub, "POST", `/foglalas/${pendingUnpriced.action_token}/elfogadom`);
  check(
    "POST elfogadom ár nélkül → az ajánlat-lapra visz, nem dönt",
    a.status === 302 && a.location.endsWith(`/foglalas/${pendingUnpriced.action_token}/ajanlat`) &&
      (await status(pendingUnpriced.id)) === "pending",
    `${a.status} → ${a.location}`,
  );
  const rv = await call(pub, "POST", `/velemeny/${review.action_token}/nem-teszem-ki`);
  const revStatus = (await db.selectFrom("site_review").select("status").where("id", "=", review.id).executeTakeFirstOrThrow()).status;
  check("POST vélemény nem-teszem-ki → rejected", revStatus === "rejected", `${rv.status}`);
  const u = await call(con, "POST", `/p/${prospectToken}/unsubscribe`);
  const pr = await db.selectFrom("prospect").select("unsubscribed_at").where("token", "=", prospectToken).executeTakeFirstOrThrow();
  check("POST leiratkozás → unsubscribed_at", pr.unsubscribed_at !== null, `${u.status}`);
  check("az ajánlat (offered) érintetlen", (await status(offered.id)) === "offered");
}

try {
  await main();
} finally {
  if (siteId) {
    const ids = (await db.selectFrom("site_unit").select("id").where("site_id", "=", siteId).execute()).map((r) => r.id);
    if (ids.length) await db.deleteFrom("availability_day").where("unit_id", "in", ids).execute();
    await db.deleteFrom("site_review").where("site_id", "=", siteId).execute();
    await db.deleteFrom("booking_request").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site_unit").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site").where("id", "=", siteId).execute();
  }
  if (tenantId) await db.deleteFrom("tenant").where("id", "=", tenantId).execute();
  await parent.drop();
  pub.close();
  con.close();
  await pool.end();
}
if (failed) {
  console.error(`\n⛔ mail-link-get-safe-check: ${failed} bukás — egy levél-link megnyitása (GET) állapotot változtat, vagy a POST nem dönt.`);
  process.exit(1);
}
console.log("\n✅ mail-link-get-safe-check: a levél-linkek megnyitása semmit nem változtat; a döntés POST-ra történik.");
process.exit(0);
