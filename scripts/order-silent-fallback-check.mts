// CSENDES VISSZAESÉS ŐR — a rendelés nem mehet tovább MÁS tartalommal vagy MÁS összeggel,
// mint amit a vevő lát (ADR-0366, Elek 10-11 B1; ADR-0032: a kiírt = a terhelt).
//
//   npx tsx scripts/order-silent-fallback-check.mts
//   npx tsx scripts/order-silent-fallback-check.mts --self-test   (a kliens-ág nélkül PIROS kell)
//
// ⛔⛔ MIÉRT (mérve 2026-10-11, Elek). A terv-lap „Fizetek — 6 430 Ft”-ot írt egy saját
// domainnévre, a böngésző `domain_name: null`-t küldött; a szerver a domaint elutasította,
// a rendelést CSENDBEN az ingyenes aldomainre írta, 5 430 Ft-ot terhelt, és ezt csak a
// konzol-naplóba írta. A vevő mást fizetett és mást kapott, mint amit látott.
//
// MIT MÉR:
//   A) SZERVER — a VALÓDI konzol rendelés-kezelőjén (in-process, efemer port, kitalált artifact,
//      így order_intent és pay-link sosem születik):
//      · saját domain név nélkül → 409 domain_refused (no_name), a válasz megadja az aldomain-árat
//      · nem kínált végződés → 409 domain_refused (tld_not_offered)
//      · kliens-ár ≠ szerver-ár → 409 price_changed, a szerver-árral és a mostani ajánlattal
//      · N1: egyező ár, aldomain → NEM ezek a hibák (a kapu nem tagadja meg a fizető vevőt)
//      A régi kód mindhárom esetben továbbengedte (mutációval mérve: PIROS).
//   B) KLIENS — valódi böngészőben, 390px és asztali, a rendelés-POST elfogva:
//      · price_changed (az ajánlat lejárt) → nincs átirányítás a fizetésre, a panel a tervhez
//        lép vissza, a sor kimondja, hogy fizetés nem indult, és az ÚJ összeget; a fizetés-gomb
//        is az új összeget mutatja (a kiírt = a terhelt)
//      · domain_refused → ugyanez, a végződés okával
process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "mock";
process.env.MMS_PROVIDER = "mock";
process.env.PAYMENT_GATEWAY = "mock";
process.env.REGISTRAR_PROVIDER = "mock";
process.env.DNS_PROVIDER = "mock";

import http from "node:http";
import { once } from "node:events";
import { chromium, type Browser } from "playwright-core";

const SELF_TEST = process.argv.includes("--self-test");
const ARTIFACT_ID = "00000000-0000-4000-8000-0000000000b1";
const ORIGIN = "http://order-fallback.test";

const failures: string[] = [];
const notes: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) notes.push(`  ok  ${label}`);
  else failures.push(label);
}

const { computeMonthly, loadPricing } = await import("../src/pricing.js");
await loadPricing();

const BUYER = {
  buyer_type: "individual",
  buyer_name: "Teszt Elek",
  buyer_country: "HU",
  buyer_zip: "8360",
  buyer_city: "Keszthely",
  buyer_address: "Fő utca 1.",
  buyer_email: "elek@citoviso.com",
  withdrawal_waiver: true,
  terms_accepted: true,
};

// ── A) SZERVER ───────────────────────────────────────────────────────────────
if (!SELF_TEST) {
  const { server: con } = (await import("../src/console/server.js")) as { server: http.Server };
  if (!con.listening) await once(con, "listening");
  const port = (con.address() as { port: number }).port;
  if (port === 4600) throw new Error("⛔ a mért szerver a megosztott 4600-on fut — a CONSOLE_PORT=0 nem érvényesült");
  const post = async (extra: Record<string, unknown>): Promise<{ status: number; j: Record<string, unknown> }> => {
    const r = await fetch(`http://127.0.0.1:${port}/configure/${ARTIFACT_ID}/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...BUYER,
        modules: [],
        billing_period: "monthly",
        domain_type: "citoviso_sub",
        photo_rights_declared: true,
        recurring_consent: true,
        ...extra,
      }),
    });
    return { status: r.status, j: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  };
  const list = computeMonthly([]);
  try {
    const noName = await post({ domain_type: "citoviso_registered", domain_name: null, price: list + 1000 });
    check(
      noName.status === 409 && noName.j.error === "domain_refused" && noName.j.reason === "no_name",
      `A saját domain NÉV NÉLKÜL → 409 domain_refused/no_name (mért: ${noName.status} ${String(noName.j.error)}/${String(noName.j.reason)})`,
    );
    check(noName.j.price === list, `A …és a válasz az aldomain-árat adja (${String(noName.j.price)} = ${list})`);
    const badTld = await post({ domain_type: "citoviso_registered", domain_name: "elek-teszt.zz", price: list + 1000 });
    check(
      badTld.status === 409 && badTld.j.error === "domain_refused" && badTld.j.reason === "tld_not_offered",
      `A nem kínált végződés → 409 domain_refused/tld_not_offered (mért: ${badTld.status} ${String(badTld.j.error)}/${String(badTld.j.reason)})`,
    );
    const gap = await post({ price: list + 1000 });
    check(
      gap.status === 409 && gap.j.error === "price_changed" && gap.j.price === list && gap.j.offer === null,
      `A kliens-ár ≠ szerver-ár → 409 price_changed a szerver-árral (mért: ${gap.status} ${String(gap.j.error)} ${String(gap.j.price)})`,
    );
    const ok = await post({ price: list });
    check(
      ok.j.error !== "price_changed" && ok.j.error !== "domain_refused",
      `A N1 egyező ár + aldomain → a kapun túljut (mért: ${ok.status} ${String(ok.j.error ?? "—")})`,
    );
  } finally {
    con.close();
  }
}

// ── B) KLIENS ────────────────────────────────────────────────────────────────
const { renderSite } = await import("../src/engine/render.js");
const { TEMPLATES } = await import("../src/engine/templates.js");
const { injectRuntime } = await import("../src/generator/runtime.js");
const { injectConfigurator } = await import("../src/generator/configurator.js");
type Recipe = import("../src/engine/recipe.js").Recipe;
type SiteData = import("../src/engine/recipe.js").SiteData;

const demo = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás",
  intro: "Kilenc szobás butikhotel a régi városfal tövében.",
  highlights: ["Tetőterasz", "Borpince"],
  photos: [{ url: `${ORIGIN}/hero.jpg`, alt: "A hotel", provenance: "owner" }],
  contact: { email: "a@b.hu", phone: "+36 30 000 0000", address: "3300 Példaváros, Vár utca 2." },
} as SiteData;

async function buildPreview(): Promise<string> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe = { template: id, skin: tpl.skins[0] ?? "editorial-warm", archetype: "stacked", sections: [] } as unknown as Recipe;
  let html = await injectConfigurator(await injectRuntime(renderSite(recipe, demo)), ARTIFACT_ID, demo.name, {
    billingPrefill: { name: "Teszt Elek", zip: "8360", city: "Keszthely", address: "Fő utca 1.", email: "elo@pelda.hu", country: "HU" },
    // The page was opened while the intro offer was live; it lapses before the click.
    offer: { kind: "outreach", percent: 25, expiresAt: null, label: "Bemutatkozó kedvezmény" },
  });
  if (SELF_TEST) {
    // Deliberate regression: the refusal branch is gone — the answer falls through.
    html = html.replace('if (data && (data.error === "domain_refused" || data.error === "price_changed")) {', "if (false) {");
  }
  return html;
}

const digits = (s: string): string => s.replace(/\D/g, "");
const VIEWPORTS = [
  { tag: "390px", size: { width: 390, height: 844 } },
  { tag: "asztali", size: { width: 1440, height: 900 } },
];
type Case = "price_changed" | "domain_refused";

async function runCase(browser: Browser, html: string, vp: (typeof VIEWPORTS)[number], c: Case): Promise<void> {
  const page = await browser.newPage({ viewport: vp.size });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  let posts = 0;
  let serverPrice = -1;
  let navigatedToPay = false;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html", body: html });
    if (u.pathname.startsWith("/pay")) {
      navigatedToPay = true;
      return route.fulfill({ status: 200, contentType: "text/html", body: "pay" });
    }
    if (route.request().method() === "POST" && u.pathname.endsWith("/request")) {
      posts++;
      const b = JSON.parse(route.request().postData() ?? "{}") as { modules: string[]; billing_period: string; price: number };
      // What the server charges once the offer has lapsed: the LIST price of the same basket.
      const list = b.billing_period === "annual" ? (await import("../src/pricing.js")).computeAnnual(b.modules) : computeMonthly(b.modules);
      serverPrice = c === "price_changed" ? list : b.price;
      const body =
        c === "price_changed"
          ? { ok: false, error: "price_changed", price: serverPrice, offer: null }
          : { ok: false, error: "domain_refused", reason: "tld_not_offered", price: serverPrice };
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify(body) });
    }
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto(`${ORIGIN}/`);
  await page.locator(".cit-cfg-launch.cit-cfg-in").waitFor({ state: "visible", timeout: 10000 });
  await page.locator(".cit-cfg-launch").click();
  await page.waitForTimeout(300);
  await page.locator(".cit-cfg-next").click();
  await page.waitForTimeout(200);
  await page.locator(".cit-cfg-rights").check();
  await page.locator(".cit-cfg-submit").click();
  await page.waitForTimeout(250);
  await page.locator('.cit-cfg-bt[data-btype="individual"]').click();
  await page.evaluate(`(function () {
    var rows = document.querySelectorAll(".cit-cfg-co-act .cit-cfg-consent");
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].hasAttribute("hidden")) continue;
      var b = rows[i].querySelector('input[type="checkbox"]');
      if (b && !b.checked) { b.checked = true; b.dispatchEvent(new Event("change", { bubbles: true })); }
    }
  })()`);
  await page.waitForTimeout(200);
  const before = (await page.locator(".cit-cfg-pay").innerText()).trim();
  await page.locator(".cit-cfg-pay").click();
  await page.waitForTimeout(700);

  const label = `${vp.tag} · ${c}`;
  check(posts === 1, `B ${label}: a rendelés-POST egyszer ment ki (mért: ${posts})`);
  check(!navigatedToPay, `B ${label}: NINCS átirányítás a fizetésre`);
  const notice = page.locator(".cit-cfg-depwarn:not(.cit-cfg-sendfail)");
  const text = (await notice.count()) ? (await notice.first().innerText()).replace(/\s+/g, " ") : "";
  check(text.includes("Fizetést most nem indítottunk"), `B ${label}: a sor kimondja, hogy fizetés nem indult („${text.slice(0, 90)}”)`);
  check(
    c === "price_changed" ? text.includes("Az ár időközben megváltozott") : text.includes("domain-végződést"),
    `B ${label}: a sor megnevezi az okot`,
  );
  check(digits(text).includes(digits(new Intl.NumberFormat("hu-HU").format(serverPrice))), `B ${label}: a sor az ÚJ összeget mondja (${serverPrice})`);
  check(
    (await page.locator(".cit-cfg-step3").count()) === 0 || !(await page.locator(".cit-cfg-step3").isVisible()),
    `B ${label}: a panel visszalépett a tervhez (a számlázó lépés rejtve)`,
  );
  // The pay button (back on step 3 it is re-rendered from currentCharge()) must read the server figure.
  const strap = (await page.locator(".cit-cfg-strap-amt").count()) ? await page.locator(".cit-cfg-strap-amt").first().innerText() : "";
  const payNow = (await page.locator(".cit-cfg-pay").innerText()).trim();
  check(
    digits(payNow) === digits(String(serverPrice)) || digits(strap) === digits(String(serverPrice)),
    `B ${label}: a kiírt összeg = a szerver-ár (gomb: „${payNow}”, sáv: „${strap}”, előtte: „${before}”, szerver: ${serverPrice})`,
  );
  check(errors.length === 0, `B ${label}: nincs JS-hiba (${errors.slice(0, 2).join(" | ")})`);
  await page.close();
}

const html = await buildPreview();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
try {
  for (const vp of VIEWPORTS) for (const c of ["price_changed", "domain_refused"] as const) await runCase(browser, html, vp, c);
} finally {
  await browser.close();
}

console.log(notes.join("\n"));
if (failures.length) {
  console.error(`\n⛔ order-silent-fallback-check: ${failures.length} bukás\n` + failures.map((f) => `  ✗ ${f}`).join("\n"));
  if (SELF_TEST) {
    console.log("\n✅ self-test: a szándékos regresszió PIROS lett, ahogy kell.");
    process.exit(0);
  }
  process.exit(1);
}
if (SELF_TEST) {
  console.error("\n⛔ self-test: a szándékos regresszió ZÖLD maradt — az őr vak.");
  process.exit(1);
}
console.log(`\n✅ order-silent-fallback-check: ${notes.length} állítás zöld`);
process.exit(0);
