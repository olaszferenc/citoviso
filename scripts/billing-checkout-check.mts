// Regression gate: an order can NEVER be placed without a usable invoice buyer
// (0029). Before this slice the invoice buyer was fabricated — lead.name (a
// Google Maps marketing name), a regex-split Maps address, and taxNumber: null
// hardcoded — so every company customer got an invoice they could not book as a
// cost. The mock invoice provider validated nothing, so the whole chain was green.
//
// This measures the two things that actually matter, not their proxies:
//
//   A) SERVER TRUTH — validateBuyer() is the gate. A company without a valid
//      adószám, a consumer without the withdrawal consent, and a VIES-unverified
//      EU VAT number must not yield an invoiceable buyer. Conversely, valid data
//      must pass, and it must carry the tax number through to the invoice input
//      (a gate that only ever says "no" is not a gate, it is a wall).
//
//   B) BUYER REALITY — in a real browser, at PHONE width, the billing step is
//      reachable, and the fields that appear MATCH the declared buyer type. A
//      hidden adószám field on the company branch means we ship the old bug
//      behind a new form.
//
// Run:  npx tsx scripts/billing-checkout-check.mts
//       npx tsx scripts/billing-checkout-check.mts --self-test   (must go RED)

import { chromium, type Page } from "playwright-core";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";
import { validateBuyer } from "../src/billing/buyer.js";
import { huTaxNumberProblem, vatTreatmentFor } from "../src/billing/taxId.js";

const SELF_TEST = process.argv.includes("--self-test");
const ARTIFACT_ID = "00000000-0000-4000-8000-000000000000";
const PREVIEW = "/tmp/cit-billing-checkout-check.html";
const PHONE = { width: 390, height: 844 };

const failures: string[] = [];
const notes: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) notes.push(`  ok  ${label}`);
  else failures.push(label);
}

/** Valid buyer payloads, minus whatever the case under test removes. */
const HU_BUSINESS = {
  buyer_type: "business",
  buyer_name: "Nyugalom Vendégház Kft.",
  buyer_tax_number: "13421739-2-13", // real, checksum-valid (KBOSS/Számlázz.hu)
  buyer_country: "HU",
  buyer_zip: "8360",
  buyer_city: "Keszthely",
  buyer_address: "Fő utca 1.",
  buyer_email: "szamla@pelda.hu",
};
const HU_INDIVIDUAL = {
  buyer_type: "individual",
  buyer_name: "Teszt Elek",
  buyer_country: "HU",
  buyer_zip: "8360",
  buyer_city: "Keszthely",
  buyer_address: "Fő utca 1.",
  buyer_email: "teszt@pelda.hu",
  withdrawal_waiver: true,
};

async function auditServerGate(): Promise<void> {
  // ── must REJECT ───────────────────────────────────────────────────────────
  const noBilling = await validateBuyer({});
  check(!noBilling.ok, "üres számlázási adat → elutasítva");

  const badTax = await validateBuyer({ ...HU_BUSINESS, buyer_tax_number: "13421738-2-13" });
  check(!badTax.ok, "cég ROSSZ checksumú adószámmal → elutasítva");

  const noTax = await validateBuyer({ ...HU_BUSINESS, buyer_tax_number: "" });
  check(!noTax.ok, "cég adószám NÉLKÜL → elutasítva");

  const noWaiver = await validateBuyer({ ...HU_INDIVIDUAL, withdrawal_waiver: false });
  check(
    !noWaiver.ok && !!noWaiver.errors?.withdrawal_waiver,
    "magánszemély elállási hozzájárulás nélkül → elutasítva",
  );

  const shortZip = await validateBuyer({ ...HU_INDIVIDUAL, buyer_zip: "836" });
  check(!shortZip.ok, "3 jegyű magyar irányítószám → elutasítva");

  const noEmail = await validateBuyer({ ...HU_INDIVIDUAL, buyer_email: "nem-email" });
  check(!noEmail.ok, "hibás e-mail → elutasítva");

  // ── must ACCEPT, and carry the tax identity through ────────────────────────
  const okBiz = await validateBuyer(HU_BUSINESS);
  check(okBiz.ok, "érvényes HU cég → elfogadva");
  check(
    okBiz.ok && okBiz.value.buyerTaxNumber === "13421739-2-13",
    "az adószám ELJUT a számlázható vevő-adatig (nem vész el)",
  );
  check(
    okBiz.ok && okBiz.value.buyerName === HU_BUSINESS.buyer_name,
    "a JOGI név kerül a vevőbe (nem a lead marketing-neve)",
  );
  check(okBiz.ok && okBiz.value.vatTreatment === "aam", "belföldi cég → AAM");

  const okInd = await validateBuyer(HU_INDIVIDUAL);
  check(okInd.ok, "érvényes magánszemély → elfogadva");
  check(
    okInd.ok && okInd.value.withdrawalWaived === true,
    "az elállási hozzájárulás ténye rögzül",
  );

  // ── tax treatment: reverse charge needs VIES proof ─────────────────────────
  check(
    vatTreatmentFor("business", "DE", "valid") === "reverse_charge",
    "EU cég VIES-igazolva → fordított adózás",
  );
  check(
    vatTreatmentFor("business", "DE", "unavailable") === "aam",
    "EU cég VIES elérhetetlen → NEM fordított adózás (nem tolunk adóterhet igazolatlanul)",
  );
  check(
    vatTreatmentFor("business", "DE", "invalid") === "aam",
    "EU cég VIES-invalid → NEM fordított adózás",
  );

  // ── the checksum itself, on real published numbers ─────────────────────────
  for (const [n, who] of [
    ["13421739-2-13", "KBOSS/Számlázz.hu"],
    ["10625790-4-44", "MOL"],
    ["10537914-4-44", "OTP"],
    ["10773381-4-44", "Magyar Telekom"],
  ] as const) {
    check(huTaxNumberProblem(n) === null, `valódi adószám érvényes: ${who}`);
  }
}

const demo: SiteData = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás",
  intro: "Kilenc szobás butikhotel a régi városfal tövében.",
  highlights: ["Tetőterasz", "Borpince"],
  photos: [
    { url: "https://picsum.photos/seed/cit-hero/1600/1000", alt: "A hotel", provenance: "owner" },
  ],
  contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
} as SiteData;

async function buildPreview(): Promise<void> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe: Recipe = {
    template: id,
    skin: tpl.skins[0] ?? "editorial-warm",
    archetype: "stacked",
    sections: [],
  } as unknown as Recipe;
  let html = await injectConfigurator(
    await injectRuntime(renderSite(recipe, demo)),
    ARTIFACT_ID,
    demo.name,
    { billingPrefill: { zip: "8360", city: "Keszthely", email: "elo@pelda.hu", country: "HU" } },
  );
  if (SELF_TEST) {
    // Deliberate regression: the company branch stops revealing the adószám field
    // — i.e. exactly the old defect wearing the new form. This MUST go red.
    html = html.replace(
      'showField("buyer_tax_number", isBusiness && country === "HU");',
      'showField("buyer_tax_number", false);',
    );
  }
  await writeFile(PREVIEW, html, "utf8");
}

/** Walk the buyer's actual path on a phone: panel → step 2 → step 3. */
async function openBillingStep(page: Page): Promise<void> {
  await page.goto(pathToFileURL(PREVIEW).href);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(300);
  await page.locator(".cit-cfg-next").click();
  await page.waitForTimeout(200);
  await page.locator(".cit-cfg-rights").check();
  await page.waitForTimeout(120);
  await page.locator(".cit-cfg-submit").click();
  await page.waitForTimeout(250);
}

async function auditBuyerReality(page: Page): Promise<void> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.setViewportSize(PHONE);
  await openBillingStep(page);

  const step3 = page.locator(".cit-cfg-step3");
  check(await step3.isVisible(), "390px: a számlázási lépés elérhető a megrendelés útján");

  // Default = individual: no tax field, but the consumer consent must be there.
  check(
    !(await page.locator('[data-fw="buyer_tax_number"]').isVisible()),
    "magánszemély ágon NINCS adószám-mező",
  );
  check(
    await page.locator('[data-c="withdrawal"]').isVisible(),
    "magánszemély ágon LÁTSZIK az elállási hozzájárulás",
  );

  // Switch to the company branch — the adószám field must appear.
  await page.locator('.cit-cfg-bt[data-btype="business"]').click();
  await page.waitForTimeout(200);
  check(
    await page.locator('[data-fw="buyer_tax_number"]').isVisible(),
    "cég ágon MEGJELENIK az adószám-mező",
  );
  check(
    !(await page.locator('[data-fw="buyer_eu_vat_number"]').isVisible()),
    "cég + HU ágon nincs közösségi adószám mező",
  );
  check(
    !(await page.locator('[data-c="withdrawal"]').isVisible()),
    "cég ágon ELTŰNIK a fogyasztói elállás (cég nem fogyasztó)",
  );

  // Foreign company → EU VAT replaces the domestic adószám.
  await page.selectOption('.cit-cfg-i[data-f="buyer_country"]', "DE");
  await page.waitForTimeout(200);
  check(
    await page.locator('[data-fw="buyer_eu_vat_number"]').isVisible(),
    "cég + DE ágon MEGJELENIK a közösségi adószám mező",
  );
  check(
    !(await page.locator('[data-fw="buyer_tax_number"]').isVisible()),
    "cég + DE ágon eltűnik a magyar adószám mező",
  );

  // Phone ergonomics: the type choice drives everything below it, so it must be
  // comfortably tappable, and nothing may overflow the 390px viewport.
  // Measure the RANGE, not just a floor: an unconstrained inline SVG inside a
  // flex button silently inflated the pay button to 250px, and a ">= 40px" check
  // waved it through. A control that is too big is as broken as one too small.
  for (const sel of ['.cit-cfg-bt[data-btype="business"]', ".cit-cfg-pay"]) {
    const box = await page.locator(sel).first().boundingBox();
    const h = Math.round(box?.height ?? 0);
    check(h >= 40 && h <= 72, `${sel}: gomb-magasság 40–72px között (mért: ${h}px)`);
  }
  // REACHABILITY, not just size. The pay button once rendered at y≈1075 in an
  // 844px viewport, inside a deliberately unscrollable foot — a perfectly sized
  // button that no thumb could ever press. A trial click runs Playwright's full
  // actionability check (visible, stable, hit-testable) without submitting.
  let reachable = true;
  try {
    await page.locator(".cit-cfg-pay").click({ trial: true, timeout: 6000 });
  } catch {
    reachable = false;
  }
  check(reachable, "390px: a FIZETÉS gomb ténylegesen elérhető és megnyomható");

  const overflow = await page.evaluate(() => {
    const p = document.querySelector(".cit-cfg-step3") as HTMLElement | null;
    if (!p) return 0;
    return Math.max(0, p.scrollWidth - p.clientWidth);
  });
  check(overflow <= 1, `390px: a számlázási lépés nem lóg ki vízszintesen (${overflow}px)`);

  // Prefill must actually land — that is what keeps this step from costing sales.
  check(
    (await page.locator('.cit-cfg-i[data-f="buyer_zip"]').inputValue()) === "8360",
    "az irányítószám ELŐRE KITÖLTVE érkezik (megerősítés, nem gépelés)",
  );

  check(errors.length === 0, `nincs JS-hiba a lépcsőn (${errors.slice(0, 2).join(" | ")})`);
}

async function main(): Promise<void> {
  await auditServerGate();
  await buildPreview();
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await auditBuyerReality(page);
  } finally {
    await browser.close();
  }

  for (const n of notes) console.log(n);
  if (SELF_TEST) {
    if (failures.length) {
      console.log(`\n✅ self-test: az őr PIROSRA ment a szándékos rontáson (${failures.length} bukás):`);
      for (const f of failures) console.log(`   - ${f}`);
      process.exit(0);
    }
    console.error("\n⛔ self-test: az őr ZÖLD maradt egy elrontott felületen — az őr NEM ŐR.");
    process.exit(1);
  }
  if (failures.length) {
    console.error(`\n⛔ billing-checkout-check: ${failures.length} bukás`);
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }
  console.log(`\n✅ billing-checkout-check: ${notes.length} ellenőrzés zöld.`);
}

await main();
