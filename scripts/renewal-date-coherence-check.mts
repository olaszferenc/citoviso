// gate-lane: own-fixture-only
//   ↑ ÍGÉRET (ADR-XXXX, audit 2026-09-25): ez a kapu CSAK a saját, futásonként bélyegzett fixture-ét írja és
//   olvassa vissza — a kapu-futtató ② fázisában a többi jelölt íróval PÁRHUZAMOSAN fut. Ha ide globális
//   olvasás/söprés/kölcsönzött sor kerül, vedd le a jelölést. Őr: scripts/gate-lane-check.mts.
// Regression gate: ONE PURCHASE, ONE NEXT-CHARGE DATE — and it is written for
// a human (ADR-0080 ①, ADR-0036 §B.18).
//
// WHAT WENT WRONG (measured 2026-09-13, Elek FK-005a H-1). On a single run the
// checkout promised "a mai fizetéstől számítva 2027. 09. 13." and the
// confirmation, three clicks later, said "2027. 09. 10.". Three days apart on an
// AUTOMATIC card charge: the buyer accepted one date and was told another. The
// cause was not a rounding slip — the two screens answered from different
// places. The browser computed today+12mo, assuming payment creates the anchor;
// the server read the tenant's EXISTING anniversary, because
// ensureSubscriptionForOrder inserts onConflict-doNothing and a tenant who
// already runs a cycle keeps their original one. The guess was right only for a
// first-ever purchase, which is the one case anybody ever tested.
//
// Alongside it (FK-001 H1 / FK-006a HIBA-2): "Honlap-előfizetése 2035-09-10
// napon újul meg" — the one date the owner had to act on, in storage format.
//
// WHAT THIS MEASURES — the two screens, in ONE run, from ONE database row:
//
//   A) COHERENCE — a tenant whose anniversary is NOT today+term (the exact shape
//      that produced H-1). The pre-payment sentence is read out of a real
//      browser after rendering the real configurator through the real manifest
//      builder; the post-payment date is read out of the real confirmation HTML
//      built by the real getActivationSummary. The two must name the same day.
//      ⛔ The two sides are NOT handed a shared constant — that would be a guard
//      grading its own fixture. They are two renderers over one subscription row.
//   B) FIRST PURCHASE — with no subscription yet, the checkout must still date
//      from today (the anchor really is about to be created), and must SAY so.
//      Without this the fix could "pass" by going blank whenever it is unsure.
//   C) NO ISO IN THE BUYER'S PROSE — the rendered confirmation, the tenant
//      admin subscription page and every billing/dunning mail body are scanned
//      for a bare YYYY-MM-DD. Rendered output, not source greps: the format is a
//      property of what the customer receives.
//   D) THE FORMATTER — including the trap that makes it a pure string transform
//      (a calendar day pushed through Date() prints the previous day west of
//      Greenwich; db/client.ts documents the same bug reaching guest mail).
//
// ISOLATION: own throwaway database, dropped at the end. The dev park is shared
// by ~10 sessions and its billing clock is time-travelled by FK-006; a guard
// that wrote there would both corrupt and be corrupted.
//
// Run:  npx tsx scripts/renewal-date-coherence-check.mts
//       npx tsx scripts/renewal-date-coherence-check.mts --self-test   (must go RED)

import pg from "pg";
import { chromium } from "playwright-core";
import { writeFile, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { sessionTmpDir } from "./lib/session-tmp.mts";
import { execFileSync } from "node:child_process";
import { registerScratchDrop, scratchDbName, sweepStaleScratchDbs } from "./lib/scratch-db.mts";

const SELF_TEST = process.argv.includes("--self-test");
// ⛔⛔ FUTÁSONKÉNT EGYEDI NÉV. Fix névvel két párhuzamos szál UGYANABBA a scratch-adatbázisba
// lép be, és a lenti `DROP DATABASE IF EXISTS` a MÁSIK, éppen FUTÓ szál adatbázisát dobja el
// — nem csak ütközés, hanem aktív rombolás egy idegen futásban. Mérve 2026-09-14: két
// egyidejű futás `23505 duplicate key` (prospect_token, majd pg_database_datname) hibával
// állt meg, és a bukás egy olyan szál commitját fogta meg, amelynek a diffje hozzá sem ért.
// Az előtag megmarad, hogy egy elszállt futás árvája felismerhető és kitakarítható legyen.
// Per-run name (base + worktree key + pid): the pid lets the next run sweep a crashed
// run's leftover without touching a live sibling's database.
const SCRATCH_BASE = "citoviso_renewal_date_check";
const SCRATCH = scratchDbName(SCRATCH_BASE);
// Session-private preview: /tmp is shared by every worktree, a FIXED path raced siblings.
const PREVIEW = path.join(sessionTmpDir("renewal-date-check"), "preview.html");
const PG = {
  host: process.env.PGHOST ?? "/tmp",
  port: Number(process.env.PGPORT ?? 5433),
  user: process.env.PGUSER ?? "postgres",
};

let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${cond ? "" : `\n     ↳ ${detail}`}`);
}

/** A bare storage-format day anywhere in prose the customer reads. */
const ISO_IN_PROSE = /\b\d{4}-\d{2}-\d{2}\b/;
/** The Hungarian form both screens must use: 2027. 09. 10. */
const HU_DAY = /\b(\d{4})\.\s?(\d{2})\.\s?(\d{2})\.?/;

/** "99 900 Ft" → 99900. The screens print thousands with NBSP or plain spaces. */
function hufIn(text: string): number | null {
  const m = /([\d\u00a0\u202f ]{3,})\s*Ft/.exec(text);
  if (!m) return null;
  const n = Number(m[1].replace(/[\u00a0\u202f\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function huDayIn(text: string): string | null {
  const m = HU_DAY.exec(text);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// ── scratch database ────────────────────────────────────────────────────────
async function admin(sqlText: string): Promise<void> {
  const c = new pg.Client({ ...PG, database: "postgres" });
  await c.connect();
  await c.query(sqlText);
  await c.end();
}
// Sweep crashed runs' leftovers (dead pid) and guarantee OUR drop on every exit path.
await sweepStaleScratchDbs(PG, SCRATCH_BASE);
registerScratchDrop(PG, SCRATCH);
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);
await admin(`CREATE DATABASE ${SCRATCH}`);
execFileSync("npx", ["tsx", "src/db/migrate.ts"], {
  env: { ...process.env, PGDATABASE: SCRATCH, DATABASE_URL: "" },
  stdio: "pipe",
});

// ⛔ Dynamic import AFTER the env is set: ESM hoists static imports, so a
// top-level `import { db }` would have opened a pool against the SHARED dev
// database before this line ever ran (reference_env_assignment_loses_to_esm_imports).
process.env.PGDATABASE = SCRATCH;
process.env.DATABASE_URL = "";
const { db, pool } = await import("../src/db/client.js");
const { sql } = await import("kysely");
const { nextChargeDate } = await import("../src/payment/subscription.js");
const { syncEntitlementsToPaid } = await import("../src/tenant/paidEntitlements.js");
const { getActivationSummary } = await import("../src/payment/service.js");
const { payResultPage } = await import("../src/console/views.js");
const { buildManifest, injectConfigurator } = await import("../src/generator/configurator.js");
const { renderSite } = await import("../src/engine/render.js");
const { TEMPLATES } = await import("../src/engine/templates.js");
const { injectRuntime } = await import("../src/generator/runtime.js");
const { loadPricing } = await import("../src/pricing.js");
const { formatDay, formatDayStem } = await import("../src/text/day.js");
const { buildRenewalPreNoticeEmail, buildRenewalChargeEmail, buildRenewalReminderEmail, buildRenewalFinalWarningEmail, buildFinalWarningSmsText } =
  await import("../src/email/billingEmail.js");
const { getSubscriptionAdmin } = await import("../src/tenant/subscriptionAdmin.js");
const { getTenantModules } = await import("../src/tenant/modules.js");
const { modulesSection } = await import("../src/server/adminViews.js");

await loadPricing(true);

/** `YYYY-MM-DD` for a Date, in LOCAL calendar terms (never via toISOString). */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let seq = 0;
// ⛔ A FIXTURE AZONOSÍTÓI FUTÁSONKÉNT EGYEDIEK. A dev-adatbázis KÖZÖS mind a ~16 párhuzamos
// szálnak, a `prospect.token` / `site.preview_token` / `site.slug` pedig egyedi kulcs —
// determinisztikus névvel (`renewDate0xxx…`) két egyidejű futás egymást lövi le
// `23505 duplicate key`-jel, és a bukás a MÁSIK szál commitját állítja meg, pedig annak a
// diffje hozzá sem ért. Mérve 2026-09-14: pontosan ez történt (a sorok utólag nem maradtak
// bent, tehát nem szemét volt, hanem ÜTKÖZÉS). A futás-előtag ezt a versenyt szünteti meg.
const RUN = Math.random().toString(36).slice(2, 8);
/**
 * A tenant mid-purchase: lead → prospect → tenant → site, a PAID payment with a
 * gateway ref (so the confirmation resolves), and optionally a subscription whose
 * anniversary is deliberately NOT today+term.
 */
async function makeBuyer(opts: {
  anchorDaysAgo: number | null;
  /** Modules the tenant ALREADY pays for — granted through the product's own
   *  paid-order → entitlement path, never by hand-writing entitlement rows. */
  owned?: readonly string[];
}): Promise<{
  leadId: string;
  tenantId: string;
  prospectId: string;
  orderId: string;
  gatewayRef: string;
  expectedAnniversary: string | null;
}> {
  const n = seq++;
  const def = await db.insertInto("scraper_definition")
    .values({ label: "g", country: "HU", region: "g", industry: "sz" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const run = await db.insertInto("scrape_run")
    .values({ scraper_definition_id: def.id } as never).returning("id").executeTakeFirstOrThrow();
  const lead = await db.insertInto("lead")
    .values({ scrape_run_id: run.id, name: `Nyugalom Vendégház ${n}`, raw: sql`'{}'::jsonb` } as never)
    .returning("id").executeTakeFirstOrThrow();
  const tenant = await db.insertInto("tenant")
    .values({ lead_id: lead.id, display_name: `Nyugalom Vendégház ${n}` } as never)
    .returning("id").executeTakeFirstOrThrow();
  const prospect = await db.insertInto("prospect")
    .values({ lead_id: lead.id, token: `renewDate${RUN}${n}${"x".repeat(10)}` } as never)
    .returning("id").executeTakeFirstOrThrow();
  await db.insertInto("site")
    .values({ tenant_id: tenant.id, preview_token: `renewDateSite${RUN}${n}`, status: "live", slug: `nyugalom-${RUN}-${n}` } as never)
    .execute();

  let expectedAnniversary: string | null = null;
  if (opts.anchorDaysAgo !== null) {
    const anchor = new Date();
    anchor.setDate(anchor.getDate() - opts.anchorDaysAgo);
    const end = new Date(anchor);
    end.setMonth(end.getMonth() + 12);
    expectedAnniversary = isoDay(end);
    await db.insertInto("subscription")
      .values({
        tenant_id: tenant.id,
        billing_period: "annual",
        anchor_date: isoDay(anchor),
        current_period_start: isoDay(anchor),
        current_period_end: expectedAnniversary,
        status: "active",
      } as never)
      .execute();
  }

  // What the tenant ALREADY pays for: an earlier PAID order carrying those
  // modules, then the product's own sync. ⛔ Not hand-written entitlement rows —
  // a fixture that writes the destination directly never proves the path
  // (feedback_fixture_must_prove_its_own_path).
  if (opts.owned?.length) {
    const prev = await db.insertInto("order_intent")
      .values({
        prospect_id: prospect.id,
        price: 50000,
        billing_period: "annual",
        status: "submitted",
        modules: JSON.stringify(opts.owned) as never,
      } as never)
      .returning("id").executeTakeFirstOrThrow();
    await db.insertInto("payment")
      .values({
        order_intent_id: prev.id,
        amount: 50000,
        status: "paid",
        gateway_ref: `gw-renewdate-prev-${n}`,
        paid_at: new Date(),
        period: "annual",
      } as never)
      .execute();
    await syncEntitlementsToPaid(tenant.id);
  }

  const gatewayRef = `gw-renewdate-${n}`;
  // kind='initial' → tenant_id MUST be null (order_intent_upsell_tenant_chk):
  // the purchase from the cold link predates the tenant, exactly as FK-005a runs
  // it. The confirmation resolves the tenant through prospect → lead → tenant.
  const oi = await db.insertInto("order_intent")
    .values({
      prospect_id: prospect.id,
      price: 99900,
      billing_period: "annual",
      status: "submitted",
    } as never)
    .returning("id").executeTakeFirstOrThrow();
  await db.insertInto("payment")
    .values({
      order_intent_id: oi.id,
      amount: 74925,
      status: "paid",
      gateway_ref: gatewayRef,
      paid_at: new Date(),
      period: "annual",
    } as never)
    .execute();

  return {
    leadId: lead.id,
    tenantId: tenant.id,
    prospectId: prospect.id,
    orderId: oi.id,
    gatewayRef,
    expectedAnniversary,
  };
}

/** Walk the payment through to entitlements, the way the webhook does: the
 *  order records WHAT WAS BOUGHT, then the product derives the grants. */
async function settlePurchase(orderId: string, tenantId: string, chosen: readonly string[]): Promise<void> {
  await db.updateTable("order_intent")
    .set({ modules: JSON.stringify(chosen) as never })
    .where("id", "=", orderId)
    .execute();
  await syncEntitlementsToPaid(tenantId);
}

const demo = {
  name: "Nyugalom Vendégház",
  tagline: "Csend és kilátás",
  intro: "Kilenc szobás vendégház a régi városfal tövében.",
  highlights: ["Tetőterasz", "Borpince"],
  photos: [{ url: "https://picsum.photos/seed/cit-hero/1600/1000", alt: "A ház", provenance: "owner" }],
  contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
} as never;

/**
 * The PRE-payment promise, read where the buyer reads it: a real browser, after
 * the real manifest builder ran with whatever the real route resolver returned.
 */
async function preChargeSentence(
  leadId: string,
  /** Module rows to CLICK — used to untick something the buyer already owns. */
  toggle: readonly string[] = [],
): Promise<{ text: string; chosen: string[] }> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe = {
    template: id,
    skin: tpl.skins[0] ?? "editorial-warm",
    archetype: "stacked",
    sections: [],
  } as never;
  let html = await injectConfigurator(
    await injectRuntime(renderSite(recipe, demo)),
    "00000000-0000-4000-8000-000000000000",
    "Nyugalom Vendégház",
    {
      renewalLeadId: leadId,
      billingPrefill: { zip: "8360", city: "Keszthely", email: "elo@pelda.hu", country: "HU" },
    },
  );
  if (SELF_TEST) {
    // Put the bug back exactly as it was: the browser dates from today and
    // ignores the anniversary the server just handed it. Case A must go RED,
    // and case B (no subscription) must stay green — today IS the basis there,
    // which is what makes this a real discriminator and not a blanket break.
    html = html
      .replace("var anchor = RN.date || null;", "var anchor = null;")
      .replace("var mod = renewalModulesMonthly();", "var mod = monthlyTotal();");
  }
  await writeFile(PREVIEW, html, "utf8");

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(pathToFileURL(PREVIEW).href);
    await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 15000 });
    await page.locator(".cit-cfg-launch").click();
    await page.waitForTimeout(300);
    // Flip the named rows. Used to UNTICK a module the tenant already owns: the
    // renewal still bills it (unticking here is not a cancellation), so this is
    // the case where the checkout must count what the buyer did NOT choose.
    for (const id of toggle) {
      await page.locator(`.cit-cfg-row[data-id="${id}"]`).click();
      await page.waitForTimeout(100);
    }
    // The fixture's order and subscription are ANNUAL; the buyer must pick the
    // same cycle on screen. Monthly is the default since ADR-0211, so this is an
    // explicit choice now, not an inherited default.
    await page.locator('.cit-cfg-permat [data-period="annual"]').click();
    await page.waitForTimeout(150);
    await page.locator(".cit-cfg-next").click();
    await page.waitForTimeout(200);
    await page.locator(".cit-cfg-rights").check();
    await page.waitForTimeout(120);
    await page.locator(".cit-cfg-submit").click();
    await page.waitForTimeout(300);
    const text = (await page.locator(".cit-cfg-nextcharge").first().textContent()) ?? "";
    // What the buyer actually has ticked, read off the page — the order the
    // payment writes must carry THIS, not a list the guard made up.
    const chosen = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.cit-cfg-row[aria-pressed="true"][data-id]')).map(
        (e) => (e as HTMLElement).dataset.id!,
      ),
    );
    ok(errors.length === 0, "a fizetőoldal JS-hiba nélkül fut", errors.join(" · "));
    // SHOTS=<dir> → keep the two screens as images. The date lives in prose, and
    // prose is judged by eye as well as by regex (§2b: see what you ship).
    if (process.env.SHOTS) {
      // The panel, not the whole 13 000px mock: the sentence under test is what
      // has to be legible, and a full-page shot renders it at thumbnail scale.
      // ⛔ Shoot the sentence's OWN element, not an ancestor: element.screenshot()
      // re-scrolls to whatever it is given, so framing the panel would scroll the
      // line back off (feedback_autoscroll_hides_offscreen_control).
      await page.locator(".cit-cfg-nextcharge").first().screenshot({
        path: `${process.env.SHOTS}/pre-${leadId.slice(0, 8)}.png`,
      });
    }
    return { text: text.trim(), chosen };
  } finally {
    await browser.close();
  }
}

// ── A) COHERENCE: the anniversary is NOT today+12mo (the H-1 shape) ─────────
console.log("\n── A · fizetés ELŐTT és UTÁN ugyanaz a nap ÉS ugyanaz az összeg ──");
// The shape that produced H-1: the anniversary is NOT today+term, AND the tenant
// already pays for modules this purchase adds to.
// ⛔ `email` is deliberately the one billable module the default package does NOT
// tick. With an owned module the preset ticks anyway, the union equals the
// selection and this guard would pass just as happily WITHOUT the fix — measured,
// that is exactly what the first two versions of this fixture did. (The first one
// also fooled ME: I clicked `reviews` to "add" it, actually toggling OFF a module
// that was on by default, and read the result as "not selected by default".)
// Two owned modules, covering BOTH ways the checkout can be blind:
//   · `email`  — the tenant owns it and this configurator does not even list it,
//                so only the server can price it (otherModulesMonthly);
//   · `reviews` — listed here and ON by default, so the buyer is UNTICKED out of
//                it below; the renewal still bills it (ownedModuleIds).
const buyer = await makeBuyer({ anchorDaysAgo: 3, owned: ["email", "reviews"] });
const pre = await preChargeSentence(buyer.leadId, ["reviews"]);
const preText = pre.text;
const preDay = huDayIn(preText);
const preAmount = hufIn(preText);

// The payment clears: the order records what was bought, the product derives the
// entitlements. Only now can the confirmation price the renewal.
await settlePurchase(buyer.orderId, buyer.tenantId, pre.chosen);

const summary = await getActivationSummary(buyer.gatewayRef);
ok(summary !== null, "a visszaigazolás adata felépül a gateway-hivatkozásból");
const postHtml = payResultPage(true, true, summary ?? undefined);
const postRow = /Következő terhelés[\s\S]{0,400}?<\/div>/.exec(postHtml)?.[0] ?? "";
const postDay = huDayIn(postRow.replace(/<[^>]+>/g, " "));

console.log(`   fizetés ELŐTT: ${preText}`);
console.log(`   fizetés UTÁN : ${postRow.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
// ⚠️ NOT COVERED, and deliberately so: the two AMOUNTS on those lines differ
// here (99 900 vs base-only), because this fixture never provisions the bought
// modules as entitlements — the confirmation prices the tenant's renewable
// modules, and this tenant has none. That gap is the fixture's, not the
// product's, so asserting equality would be a false red. Saying it out loud
// rather than leaving a silent hole: the amount coherence is UNMEASURED here.

if (process.env.SHOTS) {
  const b = await chromium.launch();
  const pg2 = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg2.setContent(postHtml);
  await pg2.screenshot({ path: `${process.env.SHOTS}/post-mobile.png`, fullPage: true });
  await pg2.setViewportSize({ width: 1280, height: 900 });
  await pg2.screenshot({ path: `${process.env.SHOTS}/post-desktop.png`, fullPage: true });
  await b.close();
}

ok(preDay !== null, "a fizetőoldal kiír egy következő-terhelés dátumot", preText || "(üres)");
ok(postDay !== null, "a visszaigazolás kiír egy következő-terhelés dátumot", postRow || "(üres)");
ok(
  preDay !== null && postDay !== null && preDay === postDay,
  "⭐ A FIZETÉS ELŐTTI ÉS UTÁNI DÁTUM AZONOS",
  `előtte ${preDay} · utána ${postDay} — a vevő egy dátumot fogad el és mást kap írásban`,
);
// And it is the tenant's real anniversary, not merely two screens agreeing on a
// wrong day: an agreement guard alone would pass if BOTH regressed to today+12mo.
ok(
  postDay === buyer.expectedAnniversary,
  "a közös dátum a tenant VALÓDI fordulónapja (ADR-0080 ①)",
  `képernyő ${postDay} · subscription.current_period_end ${buyer.expectedAnniversary}`,
);
ok(
  await nextChargeDate(buyer.tenantId) === buyer.expectedAnniversary,
  "a fordulónapnak EGY definíciója van (nextChargeDate)",
);

// ── the AMOUNT, the other half of the same promise ────────────────────────
const postAmount = hufIn(postRow.replace(/<[^>]+>/g, " "));
ok(
  pre.chosen.length > 0,
  "a fizetőoldal alapból tartalmaz kiválasztott modulokat",
  `ticked: ${pre.chosen.join(", ")}`,
);
ok(
  !pre.chosen.includes("email") && !pre.chosen.includes("reviews"),
  "⭐ a fixture KIÉLEZI az esetet: MINDKÉT meglévő modul kipipálatlan a fizetőoldalon",
  `ha be lenne, a halmazok egybeesnének és ez a mérés a javítás NÉLKÜL is zöld lenne — ticked: ${pre.chosen.join(", ")}`,
);
ok(preAmount !== null && postAmount !== null, "mindkét képernyő megnevez egy összeget", `${preAmount} / ${postAmount}`);
ok(
  preAmount !== null && preAmount === postAmount,
  "⭐ A FIZETÉS ELŐTTI ÉS UTÁNI ÖSSZEG AZONOS",
  `előtte ${preAmount} Ft · utána ${postAmount} Ft — a fizetőoldal csak a most pipáltakat árazta, ` +
    `a visszaigazolás a tenant ÖSSZES megújuló modulját`,
);
ok(
  summary?.renewal?.amount === preAmount,
  "és a képernyőn álló szám a szerver megújulás-számítása (nem a kliens sajátja)",
  `renewalPreview ${summary?.renewal?.amount} · fizetőoldal ${preAmount}`,
);
ok(
  /fordulónapján/.test(preText),
  "⭐ a fizetőoldal MEGNEVEZI az alapot: a meglévő előfizetés fordulónapja",
  `a mondat: ${preText}`,
);

// ── B) FIRST PURCHASE: no cycle yet → today is the honest basis ─────────────
console.log("\n── B · első vásárlás (még nincs előfizetés) ──");
const fresh = await makeBuyer({ anchorDaysAgo: null });
const freshText = (await preChargeSentence(fresh.leadId)).text;
const today = new Date();
today.setMonth(today.getMonth() + 12);
console.log(`   fizetés ELŐTT: ${freshText}`);
ok(
  huDayIn(freshText) === isoDay(today),
  "első vásárlásnál a fizetőoldal MA+12 hónapot ígér (a fizetés hozza létre a horgonyt)",
  `mondat ${huDayIn(freshText)} · várt ${isoDay(today)}`,
);
ok(
  /mai fizetéstől számítva/.test(freshText),
  "és kimondja, hogy a mai fizetés az alap",
  freshText,
);
ok(
  freshText.trim().length > 0,
  "⛔ a bizonytalanság nem üres mondat — a vevő nem maradhat dátum nélkül",
);

// ── C) NO ISO IN THE BUYER'S PROSE ─────────────────────────────────────────
console.log("\n── C · gépi dátum sehol a vevőnek szóló szövegben ──");
// Positive control for the detector itself. Every assertion below is an
// ABSENCE, and an absence-only section passes just as happily when the probe is
// broken as when the product is clean (feedback_guard_greenly_defended_the_bug).
ok(
  ISO_IN_PROSE.test("Honlap-előfizetése 2035-09-10 napon újul meg."),
  "a szonda FELISMERI a bejelentett ISO-mondatot (különben az alábbi hiányok semmit sem érnek)",
);
ok(
  !ISO_IN_PROSE.test("Honlap-előfizetése 2035. 09. 10. napon újul meg."),
  "és a magyar alakra NEM riad",
);
ok(!ISO_IN_PROSE.test(preText), "fizetőoldal: nincs ISO-alak", preText);
ok(
  !ISO_IN_PROSE.test(postRow.replace(/<[^>]+>/g, " ")),
  "visszaigazolás „AZ ELŐFIZETÉSE” doboza: nincs ISO-alak",
  postRow,
);

// The tenant admin subscription card — the screen the owner lives on. Built
// through the product's OWN data builders, so the fixture cannot quietly render
// a shape the app never produces (feedback_fixture_must_prove_its_own_path).
const admModules = await getTenantModules(buyer.tenantId);
const admData = await getSubscriptionAdmin(buyer.tenantId, admModules);
ok(admData !== null, "a bérlői előfizetés-adat felépül");
if (admData) {
  const admHtml = modulesSection(
    admModules,
    admData,
    null,
    "elo@pelda.hu",
    null,
    "hu",
  );
  const prose = admHtml.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
  const hit = ISO_IN_PROSE.exec(prose);
  ok(
    hit === null,
    "bérlői Előfizetés lap: nincs ISO-alak a szövegben",
    hit ? `„…${prose.slice(Math.max(0, hit.index - 70), hit.index + 40).replace(/\s+/g, " ")}…”` : "",
  );
  ok(
    prose.includes(formatDay(admData.periodEnd)) || prose.includes(formatDayStem(admData.periodEnd)),
    "és a fordulónap magyar alakban OTT VAN",
    `várt: ${formatDay(admData.periodEnd)}`,
  );
  // The failure mode formatDayStem exists to prevent: "2027. 09. 10.-ig". The
  // ISO check above cannot see it — the date is already Hungarian, just wrongly
  // punctuated where the sentence appends its own suffix.
  const doubled = /\d\.-(ig|án|én|i|tól|től|ra|re)\b/.exec(prose);
  ok(
    doubled === null,
    "⭐ rag előtt NINCS pont a dátum végén („2027. 09. 10.-ig” alak)",
    doubled ? `„…${prose.slice(Math.max(0, doubled.index - 50), doubled.index + 20).replace(/\s+/g, " ")}…”` : "",
  );
}

// Every dunning mail body — the FK-001/FK-006a finding was in one that shipped.
const mailBase = {
  to: "tulaj@pelda.hu",
  siteName: "Nyugalom Vendégház",
  amount: 99900,
  currency: "Ft",
  dueDate: "2027-09-10",
  lang: "hu",
};
const chargeBase = { ...mailBase, payUrl: "https://pelda.hu/fizetes", periodStart: "2027-09-10", periodEnd: "2028-09-10" };
const mails: Array<[string, { subject: string; text: string; html: string }]> = [
  ["T−3 előértesítő", buildRenewalPreNoticeEmail({ ...mailBase, autoCharge: true })],
  ["T terhelés", buildRenewalChargeEmail(chargeBase)],
  ["T+3 emlékeztető", buildRenewalReminderEmail({ ...chargeBase, freezeDate: "2027-09-20" })],
  ["T+7 utolsó figyelmeztetés", buildRenewalFinalWarningEmail({ ...chargeBase, freezeDate: "2027-09-20" })],
];
for (const [label, msg] of mails) {
  const body = `${msg.subject}\n${msg.text}`;
  const hit = ISO_IN_PROSE.exec(body);
  ok(hit === null, `${label} levél: nincs ISO-alak`, hit ? `„…${body.slice(Math.max(0, hit.index - 60), hit.index + 30)}…”` : "");
}
const sms = buildFinalWarningSmsText({ siteName: "Nyugalom Vendégház", freezeDate: "2027-09-20", payUrl: "https://pelda.hu/f", lang: "hu" });
ok(!ISO_IN_PROSE.test(sms), "T+7 SMS: nincs ISO-alak", sms);
ok(
  buildRenewalPreNoticeEmail({ ...mailBase, autoCharge: true }).text.includes("2027. 09. 10."),
  "⭐ a bejelentett mondat magyarul szól: „…2027. 09. 10. napon újul meg”",
  buildRenewalPreNoticeEmail({ ...mailBase, autoCharge: true }).text,
);

// ── D) THE FORMATTER, including the trap it exists to avoid ────────────────
console.log("\n── D · a formázó ──");
ok(formatDay("2027-09-10") === "2027. 09. 10.", "formatDay: 2027-09-10 → 2027. 09. 10.");
ok(formatDayStem("2027-09-10") === "2027. 09. 10", "formatDayStem: rag elé nem tesz pontot");
ok(formatDay("") === "" && formatDay(null) === "", "üres/null → üres, nem „Invalid Date”");
ok(formatDay("már formázott") === "már formázott", "nem-ISO bemenet változatlanul megy át");
// ⛔ THE TRAP: a calendar day is a label, not an instant. Routing it through
// Date() parses UTC midnight, and any negative-offset zone prints the day BEFORE.
// db/client.ts records the same bug shifting a Sept 18 arrival to Sept 17 in
// guest-facing mail. Proven by formatting the SAME day west of Greenwich.
{
  const tz = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  const shifted = formatDay("2027-09-10");
  process.env.TZ = tz;
  ok(
    shifted === "2027. 09. 10.",
    "⛔ a naptári nap NEM csúszik el negatív időzónában (nem megy át Date-en)",
    `Los Angeles-i futáson: ${shifted}`,
  );
}

// ── teardown ────────────────────────────────────────────────────────────────
await pool.end();
await db.destroy().catch(() => {});
await rm(PREVIEW, { force: true });
await admin(`DROP DATABASE IF EXISTS ${SCRATCH}`);

console.log(
  `\n${failed === 0 ? "✅ renewal-date-coherence: egy vásárlás, egy dátum — és magyarul." : `❌ ${failed} sértés`}`,
);
process.exit(failed === 0 ? 0 : 1);
