// A JÓVÁHAGYOTT foglalás-képernyő ŐRE (kontraktus:
// assets/design-refs/tenant-admin/booking-screen/README.md, tulaj 2026-09-08).
//
// Miért kell: a kontraktus VISELKEDÉST köt, nem stílust — „a foglalt napra kattintva
// tudja megnézni a foglalás részleteit", „felugró ablak de középre igazítva",
// „a naptár legyen összecsukható". Ezt egyik screenshot sem bizonyítja: a képen a
// kártya akkor is jól néz ki, ha sosem nyílik meg, és a `hidden` elem is látszhat
// (mérve 2026-09-04). Ezért ez az őr VÉGIGKATTINTJA a valódi felületet — a saját
// worktree szerverén, efemer porton, bejelentkezett tenantként.
//
// Saját eldobható fixture-t vet (szállás + egész-egység + szoba + elfogadott
// foglalás), és a végén mindent visszatakarít. Levelet nem küld.
//
//   npx tsx scripts/booking-screen-check.mts
//   npx tsx scripts/booking-screen-check.mts --shots   (képeket is ment az assets/Temp-be)

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls
process.env.DATABASE_URL = "";
process.env.PUBLIC_PORT = "0";

import { randomBytes } from "node:crypto";
import { once } from "node:events";
import path from "node:path";
import type { Server } from "node:http";

import { chromium, type Page } from "playwright-core";
import { sql } from "kysely";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";

const SHOTS = process.argv.includes("--shots");
const OUT = path.resolve(import.meta.dirname, "../assets/Temp");

const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) console.log(`  ✅ ${name}`);
  else {
    console.log(`  ⛔ ${name}${detail ? ` — ${detail}` : ""}`);
    failures.push(name);
  }
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

let leadId = "";
let tenantId = "";
let siteId = "";

try {
  // ── fixture ────────────────────────────────────────────────────────────────
  const def = await db
    .insertInto("scraper_definition")
    .values({ label: "bookingscreen", country: "HU", region: "bs", industry: "szallas" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const run = await db
    .insertInto("scrape_run")
    .values({ scraper_definition_id: def.id } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const lead = await db
    .insertInto("lead")
    .values({ scrape_run_id: run.id, name: "Foglalás-képernyő teszt", raw: sql`'{}'::jsonb` } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  leadId = lead.id;
  const tenant = await db
    .insertInto("tenant")
    .values({ lead_id: lead.id, display_name: "Foglalás-képernyő teszt" } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  tenantId = tenant.id;
  const user = await db
    .insertInto("tenant_user")
    .values({
      tenant_id: tenant.id,
      contact_email: "bs-teszt@example.com",
      username: `bs-teszt-${Date.now()}`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  // A tenant-admin a MOCK-ARTIFACT receptjéből és adatából dolgozik (loadSiteForEdit):
  // e nélkül minden fül azt mondja, hogy „nincs szerkeszthető oldal".
  const artifact = await db
    .insertInto("mock_artifact")
    .values({
      lead_id: lead.id,
      status: "approved",
      inputs: sql`${JSON.stringify({
        recipe: {
          template: "editorial",
          skin: "editorial-warm",
          archetype: "classic",
          sections: [{ kind: "hero" }, { kind: "enquiry" }],
        },
        siteData: {
          name: "Foglalás-képernyő teszt",
          tagline: "Teszt",
          intro: "Teszt szállás az őrhöz.",
          highlights: ["Kert"],
          photos: [],
          contact: { email: "bs-teszt@example.com" },
        },
      })}::jsonb`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();

  const site = await db
    .insertInto("site")
    // Az admin csak PROVISIONED/LIVE oldalt szerkeszt ("Ehhez a fiókhoz még nincs
    // szerkeszthető oldal") — a fixture-nek ugyanabban az állapotban kell lennie,
    // amiben egy valódi tenant a foglalás-képernyőt megnyitja.
    .values({
      tenant_id: tenant.id,
      preview_token: `bschk${Date.now()}`,
      source_artifact_id: artifact.id,
      status: "provisioned",
      path: `sites/${tenant.id}/index.html`,
      slug: `bs-teszt-${Date.now()}`,
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  siteId = site.id;
  await db
    .insertInto("module_entitlement")
    .values({ tenant_id: tenant.id, module: "booking", active: true } as never)
    .execute();

  const { ensureUnits, createUnit, getUnits } = await import("../src/tenant/units.js");
  await ensureUnits(siteId);
  await createUnit(siteId, "Apartman1", 4, null);
  const units = await getUnits(siteId);
  const whole = units.find((u) => u.isWholeProperty)!;
  const room = units.find((u) => !u.isWholeProperty)!;

  // Elfogadott foglalás az EGÉSZ szállásra — két éjszakára, mától +4 naptól.
  const from = plus(4);
  const second = plus(5);
  const to = plus(6);
  const req = await db
    .insertInto("booking_request")
    .values({
      site_id: siteId,
      unit_id: whole.id,
      guest_name: "Kovács Anna",
      guest_email: "kovacs.anna@example.com",
      guest_phone: "+36 30 555 1234",
      date_from: from,
      date_to: to,
      guests: 4,
      message: "Késői, 21 óra körüli érkezés.",
      status: "accepted",
      action_token: randomBytes(18).toString("base64url"),
      quoted_total: 48000,
      quoted_currency: "HUF",
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  for (const day of [from, second]) {
    await db
      .insertInto("availability_day")
      .values({ unit_id: whole.id, day, state: "booked", source: `booking:${req.id}` })
      .execute();
  }
  // Kézi blokk ugyanabban a hónapban: e nélkül a „kézi ≠ vendég-foglalás" mérés
  // vakon menne át (nincs mit összehasonlítani).
  await db
    .insertInto("availability_day")
    .values({ unit_id: whole.id, day: plus(9), state: "blocked", source: "manual" })
    .execute();

  // ── szerver + bejelentkezett tenant ────────────────────────────────────────
  const { server } = (await import("../src/server/public.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("nincs szerver-cím");
  const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
  const cookie = mintTenantCookieValue(user.id);
  const base = `http://localhost:${addr.port}`;

  const browser = await chromium.launch({ executablePath: config.chromiumPath });

  async function withPage(width: number, fn: (p: Page) => Promise<void>): Promise<void> {
    const ctx = await browser.newContext({ viewport: { width, height: 950 } });
    await ctx.addCookies([{ name: "cit_session", value: cookie, url: base }]);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await fn(page);
    check(`JS-hiba nincs (${width}px)`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  for (const width of [390, 1280]) {
    console.log(`\n${width}px`);
    const tag = width === 390 ? "mobile" : "desktop";
    await withPage(width, async (page) => {
      await page.goto(`${base}/admin?tab=modulok&m=booking&e=${whole.id}&ho=${from.slice(0, 7)}`, {
        waitUntil: "networkidle",
      });

      // ① a fejléc EGY blokk, benne a modul, az ára, a vissza-út és a súgó
      const head = page.locator(".mhead");
      check("egy fejléc-blokk (nem öt szétszórt sor)", (await head.count()) === 1);
      const headTxt = (await head.textContent()) ?? "";
      check(
        "benne a modul neve, az ára, a vissza-út és a súgó",
        /Online foglalás/.test(headTxt) &&
          /Ft\/hó/.test(headTxt) &&
          /Vissza a modulokhoz/.test(headTxt) &&
          /Útmutató/.test(headTxt),
        headTxt.replace(/\s+/g, " ").slice(0, 110),
      );
      check("a súgó-link a KB-horgonyt viszi", (await page.locator("[data-kb-anchor='admin.modules.booking']").count()) === 1);

      // ② egység-FÜLEK, a fölérendelt egység megjelölve (ADR-0114)
      const tabs = page.locator(".unit-tabs a");
      check("egység-fülek (2 egység)", (await tabs.count()) === 2, `kapott: ${await tabs.count()}`);
      check(
        "az egész szállás füle kimondja, hogy ő az egész ház",
        /az egész ház/.test((await tabs.first().textContent()) ?? ""),
      );

      // ③ a naptár ÖSSZECSUKHATÓ, és csukva is megmondja, mennyire tele van
      const details = page.locator("details#cit-naptar");
      check("a naptár összecsukható (details)", (await details.count()) === 1);
      const badge = (await page.locator(".cal-sum__badge").textContent()) ?? "";
      // 2 vendég-éjszaka + 1 kézi blokk
      check("a jelvény a foglalt napok számát mondja", /3 nap tele/.test(badge), badge);
      await page.locator(".cal-sum").click();
      await page.waitForTimeout(150);
      check("koppintásra becsukódik", !(await page.locator(".cal-grid").isVisible()));
      check("de a jelvény akkor is látszik", await page.locator(".cal-sum__badge").isVisible());
      await page.locator(".cal-sum").click();
      await page.waitForTimeout(150);
      check("és újra kinyílik", await page.locator(".cal-grid").isVisible());

      // ④ a FOGLALT nap kattintható, és a részlet KÖZÉPEN nyílik
      const booked = page.locator(".cal-cell--booked a");
      check("két foglalt nap van a rácsban", (await booked.count()) === 2, `kapott: ${await booked.count()}`);
      await booked.first().click();
      await page.waitForTimeout(200);
      // :target = a MEGNYITOTT kártya (a többi ott van a DOM-ban, de rejtve).
      const box = page.locator(".daycard:target .daycard__box");
      check("a részlet megnyílik", await box.isVisible());
      const cardTxt = (await box.textContent()) ?? "";
      check("a vendég neve", /Kovács Anna/.test(cardTxt));
      // Az ár hu-HU formázással jön (nem törhető szóközzel) — a mérés a SZÁMOT nézi.
      check(
        "a létszám, az ár és az elérhetőség",
        /4 fő/.test(cardTxt) && /48\s?000\s?Ft/.test(cardTxt) && /kovacs\.anna@/.test(cardTxt),
        cardTxt.replace(/\s+/g, " ").slice(0, 120),
      );
      check("a vendég üzenete", /Késői/.test(cardTxt));
      check("a telefonszám hívható link", (await box.locator("a[href^='tel:']").count()) === 1);
      check("gomb a Foglalások fülre", (await box.locator("a[href*='tab=foglalasok']").count()) === 1);

      const bb = (await box.boundingBox())!;
      const vp = page.viewportSize()!;
      const dx = Math.abs(bb.x + bb.width / 2 - vp.width / 2);
      const dy = Math.abs(bb.y + bb.height / 2 - vp.height / 2);
      check(`a kártya vízszintesen KÖZÉPEN (${Math.round(dx)}px)`, dx <= 12);
      check(`a kártya függőlegesen KÖZÉPEN (${Math.round(dy)}px)`, dy <= 12);
      check("sötétített háttér van mögötte", await page.locator(".daycard:target .daycard__bg").isVisible());
      if (SHOTS) await page.screenshot({ path: path.join(OUT, `ui-bs-reszlet-${tag}.png`) });

      // ④/b A KÉZI blokk és a VENDÉG foglalása nem néz ki egyformán — az egyik
      //     koppintásra felold, a másik kártyát nyit (KB-őr lelete, 2026-09-08).
      const manualCell = page.locator(".cal-cell input:checked + label").first();
      check("van kézi blokk a hónapban (a méréshez)", (await manualCell.count()) === 1);
      const manualBg = await manualCell.evaluate((el) => getComputedStyle(el).backgroundColor);
      const bookedBg = await page
        .locator(".cal-cell--booked a")
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      check("a kézi blokk és a vendég-foglalás KÜLÖNBÖZŐ színű", manualBg !== bookedBg, `${manualBg} vs ${bookedBg}`);
      const legend = (await page.locator(".cal-legend").textContent()) ?? "";
      check(
        "a jelmagyarázat mindkettőt külön nevezi meg",
        /Ön jelölte tele/.test(legend) && /Vendég foglalása/.test(legend),
        legend.replace(/\s+/g, " "),
      );

      // ⑤ bezárás után eltűnik
      await page.locator(".daycard:target .daycard__close").click();
      await page.waitForTimeout(200);
      check("bezárható", (await page.locator(".daycard:target").count()) === 0);

      // ⑥ ADR-0114: a SZOBA naptárában ugyanaz a két éjszaka CSÍKOS, és a részlet
      //    megmondja, ki tartja, meg átvisz a másik egység naptárára
      await page.goto(`${base}/admin?tab=modulok&m=booking&e=${room.id}&ho=${from.slice(0, 7)}`, {
        waitUntil: "networkidle",
      });
      // ADR-0114: a szobánál a fölérendelt egység MINDEN zárt napja csíkos —
      // a két vendég-éjszaka ÉS a kézi blokk is (a szoba sem adható ki, ha az
      // egész ház azon a napon nem elérhető).
      const linked = page.locator(".cal-cell--linked a");
      check("a szobánál csíkos mind a három zárt nap", (await linked.count()) === 3, `kapott: ${await linked.count()}`);
      check(
        "a jelmagyarázat megnevezi ezt az állapotot",
        /Másik egység foglalása/.test((await page.locator(".cal-legend").textContent()) ?? ""),
      );
      await linked.first().click();
      await page.waitForTimeout(200);
      const linkTxt = (await page.locator(".daycard:target .daycard__box").textContent()) ?? "";
      check("a csíkos nap megmondja, KI tartja", /Kovács Anna/.test(linkTxt));
      check("és melyik egység", /A szállás egésze/.test(linkTxt));
      // A kártyák a rács MINDEN foglalt napjához legenerálódnak, ezért a mérés a
      // MEGNYITOTT kártyán belül keres — page-szinten a testvér-kártyák is illeszkednének.
      const openCard = page.locator(".daycard:target .daycard__box");
      check(
        "gomb a másik egység naptárára",
        (await openCard.locator(`a[href*='e=${whole.id}']`).count()) === 1,
        (await openCard.locator("a").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")).join(" | "))).slice(0, 300),
      );
      if (SHOTS) await page.screenshot({ path: path.join(OUT, `ui-bs-linked-${tag}.png`) });
    });
  }

  await browser.close();
} finally {
  if (siteId) {
    const ids = (await db.selectFrom("site_unit").select("id").where("site_id", "=", siteId).execute()).map(
      (r) => r.id,
    );
    if (ids.length) await db.deleteFrom("availability_day").where("unit_id", "in", ids).execute();
    await db.deleteFrom("booking_request").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site_unit").where("site_id", "=", siteId).execute();
    await db.deleteFrom("site").where("id", "=", siteId).execute();
  }
  if (tenantId) {
    await db.deleteFrom("module_entitlement").where("tenant_id", "=", tenantId).execute();
    await db.deleteFrom("tenant_user").where("tenant_id", "=", tenantId).execute();
    await db.deleteFrom("tenant").where("id", "=", tenantId).execute();
  }
  if (leadId) await db.deleteFrom("lead").where("id", "=", leadId).execute();
  await db.destroy();
}

if (failures.length) {
  console.error(`\n⛔ a foglalás-képernyő ${failures.length} ponton eltér a jóváhagyott tervtől`);
  for (const f of failures) console.error(`   · ${f}`);
  process.exit(1);
}
console.log("\n✅ foglalás-képernyő: a szállított felület a jóváhagyott tervet követi");
process.exit(0);
