// ADR-0110 guard — the generated tenant site's LEGAL FOOTING.
//
// What it protects, in the order the failures actually happened:
//   1. The footer's "Adatkezelés" link was href="#" on every live page for months,
//      on a site that collects names, e-mails and phone numbers. A link and its
//      page have to be tied together, and this is the tie.
//   2. The MOCK must NOT carry those links: a cold lead has no legal data with us
//      and no such page on the preview host (ADR-0110 ⑦).
//   3. A registry fact we do not hold must be LOUD ("— nincs megadva —"), never
//      guessed and never silently dropped (⑥). Both directions are asserted.
//   4. The privacy page's "Röviden" box claims we set no cookies. That claim is
//      true today and MEASURED here: if a known tracker ever appears in the engine
//      output, this guard fails — the claim and the code cannot drift apart (④).
//   5. Consent for publishing a review is a SERVER gate, not a checkbox attribute.
//
// No DB, no network: inline fixtures, so it runs in the pre-commit hook.
//
//   npx tsx scripts/tenant-legal-check.mts
//   npx tsx scripts/tenant-legal-check.mts --self-test   (proves the assertions bite)

import { readFile } from "node:fs/promises";
import path from "node:path";

import { renderTenantLegalPage, TENANT_LEGAL_PATHS, withLegalStrip } from "../src/engine/legalPages.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TENANT_LEGAL_MISSING, type HostingProviderIdentity, type TenantLegalIdentity } from "../src/legal.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");
/** Browser pass: opt-in, because the pre-commit hook must stay fast and headless-free. */
const BROWSER = process.argv.includes("--browser");

const PX =
  "data:image/svg+xml;utf8," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560"><rect width="900" height="560" fill="#cfc7bd"/></svg>');

const demo: SiteData = {
  name: "Nyugalom Vendégház",
  tagline: "Csend, kert, Balaton",
  intro: "Szólád szélén, a szőlőhegy alatt.",
  highlights: ["Dézsafürdő", "Fedett terasz", "Saját parkoló"],
  photos: [{ url: PX, alt: "Kert" }],
  contact: { email: "info@nyugalom.example", phone: "+36 30 123 4567", address: "Szólád" },
};

const recipe: Recipe = {
  template: "editorial",
  skin: "editorial-warm",
  archetype: "classic",
  sections: [{ kind: "hero" }, { kind: "enquiry" }],
};

const FULL: TenantLegalIdentity = {
  legalName: "Nyugalom Vendégház Kft.",
  address: "8625 Szólád, Kossuth Lajos utca 12.",
  taxNumber: "12345678-2-41",
  regNumber: "Cg. 14-09-123456",
  ntakId: "SZ26001234",
  email: "info@nyugalom.example",
  phone: "+36 30 123 4567",
};

/** The same tenant with two statutory facts missing — the blind branch. */
const GAPPY: TenantLegalIdentity = { ...FULL, address: null, regNumber: null };

const HOST: HostingProviderIdentity = {
  name: "Citoviso — Olasz Ferenc e.v.",
  // Complete on purpose: with a null seat the page would (correctly) show the
  // missing marker, and the RED twin below could never distinguish "loud because
  // the tenant is incomplete" from "loud because WE are".
  address: "1111 Budapest, Példa utca 1.",
  email: "info@citoviso.com",
  site: "citoviso.com",
};

/** Known third-party trackers. Their presence would make the "no cookies" claim false. */
const TRACKERS = [
  "googletagmanager.com",
  "google-analytics.com",
  "gtag(",
  "fbq(",
  "connect.facebook.net",
  "matomo",
  "hotjar",
  "clarity.ms",
  "plausible.io",
];

let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

// ── 1. LIVE page: legal links present, standing strip present ────────────────
console.log("\nÉLES oldal");
const live = withLegalStrip(renderSite(recipe, demo, { phase: "live" }), FULL);
check(
  "a lábléc Adatkezelés-linkje él",
  live.includes(`href="${TENANT_LEGAL_PATHS.privacy}"`),
  'nincs href="/adatvedelem"',
);
check("az impresszum elérhető", live.includes(`href="${TENANT_LEGAL_PATHS.imprint}"`));
check("a jogi sáv kint van", live.includes("cit-legal-strip"));
check("a jogi sávon ott az adószám", live.includes("12345678-2-41"));
check(
  "nincs harmadik feles követő a kimeneten",
  !TRACKERS.some((t) => live.includes(t)),
  TRACKERS.filter((t) => live.includes(t)).join(", "),
);

// A tenant with NO legal facts still gets the strip: on the template path it is the
// only place the imprint link exists, so dropping it hid the imprint from exactly the
// tenant who has not filled anything in (KB audit, 2026-09-08).
const bare = withLegalStrip(renderSite(recipe, demo, { phase: "live" }), {
  ...FULL,
  legalName: null,
  taxNumber: null,
});
check("jogi adat NÉLKÜL is van sáv", bare.includes("cit-legal-strip"));
check(
  "üres adatnál is elérhető az impresszum",
  bare.includes(`href="${TENANT_LEGAL_PATHS.imprint}"`),
);

// ── 2. MOCK: no legal links at all ───────────────────────────────────────────
console.log("\nMOCK (hideg lead)");
const mock = renderSite(recipe, demo, { phase: "mock" });
check(
  "a mockon NINCS adatvédelmi link",
  !mock.includes(TENANT_LEGAL_PATHS.privacy),
  "a mock jogi lapot ígérne, ami nem létezik",
);
check("a mockon NINCS impresszum-link", !mock.includes(TENANT_LEGAL_PATHS.imprint));
check("a mockon nem marad üres <li>", !/<li[^>]*>\s*<\/li>/i.test(mock));

// ── 3. The privacy page carries what the law requires ────────────────────────
console.log("\nAdatkezelési tájékoztató");
const privacy = renderTenantLegalPage({ recipe, data: demo, kind: "privacy", who: FULL, host: HOST });
for (const [label, needle] of [
  ["adatkezelő neve", FULL.legalName!],
  ["jogalap (szerződés előkészítése)", "6. cikk (1) b)"],
  ["jogalap (hozzájárulás)", "6. cikk (1) a)"],
  ["megőrzési idő", "8 év"],
  ["adatfeldolgozó nevesítve", "Citoviso"],
  ["GDPR 28. cikk", "28. cikk"],
  ["süti-szakasz", "nem használunk sütit"],
  ["látogatottság-mérés (ADR-0108)", "Látogatottság mérése"],
  ["Google Maps/Fonts adattovábbítás", "Google Ireland"],
  ["NAIH", "NAIH"],
  ["Röviden doboz", "Röviden"],
] as const) {
  check(label, privacy.includes(needle), `hiányzik: „${needle}”`);
}
check("tartalomjegyzék", privacy.includes("cit-lg-toc"));
check("a szakaszok nyithatók (mobil)", privacy.includes("<details"));

// ── 4. The imprint carries the Eker.tv. 4. § facts ───────────────────────────
console.log("\nImpresszum");
const imprint = renderTenantLegalPage({ recipe, data: demo, kind: "imprint", who: FULL, host: HOST });
for (const [label, needle] of [
  ["név", FULL.legalName!],
  ["székhely", FULL.address!],
  ["adószám", FULL.taxNumber!],
  ["nyilvántartási szám", FULL.regNumber!],
  ["tárhelyszolgáltató", HOST.name],
] as const) {
  check(label, imprint.includes(needle), `hiányzik: „${needle}”`);
}

// ── 5. The missing-data branch, asserted in BOTH directions ──────────────────
console.log("\nAdathiányos ág");
const gappy = renderTenantLegalPage({ recipe, data: demo, kind: "imprint", who: GAPPY, host: HOST });
check("hiányzó adat HANGOS", gappy.includes(TENANT_LEGAL_MISSING), "a sor némán eltűnt");
check(
  "két hiányzó mező = két jelölés",
  (gappy.match(new RegExp(TENANT_LEGAL_MISSING, "g")) ?? []).length >= 2,
);
// RED twin: with the data present the marker must NOT appear — otherwise the check
// above would pass on a page that always shouts.
check("teljes adatnál NINCS jelölés", !imprint.includes(TENANT_LEGAL_MISSING));

// ── 6. Consent is a SERVER gate, not a checkbox attribute ────────────────────
console.log("\nVélemény-hozzájárulás");
const sections = await readFile(path.join(ROOT, "src/engine/moduleSections.ts"), "utf8");
const server = await readFile(path.join(ROOT, "src/server/public.ts"), "utf8");
check(
  "az űrlapon van hozzájárulás-jelölő",
  /name="consent"/.test(sections),
  "a kliens-oldali jelölő hiányzik",
);
check(
  "a szerver ELUTASÍTJA hozzájárulás nélkül",
  /form\.get\("consent"\)\s*!==\s*"1"/.test(server),
  "a required attribútum önmagában nem kapu (kézzel gyártott POST megkerüli)",
);

// ── Self-test: the assertions must be able to fail ───────────────────────────
if (SELF_TEST) {
  console.log("\nÖnteszt (a fentiek tudnak-e bukni)");
  const sabotaged = live.replace(new RegExp(TENANT_LEGAL_PATHS.privacy, "g"), "#");
  check(
    "RED: link nélküli oldalon bukik a link-ellenőrzés",
    !sabotaged.includes(`href="${TENANT_LEGAL_PATHS.privacy}"`),
  );
  const withTracker = live.replace("</body>", '<script src="https://www.googletagmanager.com/gtag/js"></script></body>');
  check("RED: tracker-detektor kiszúrja a beszúrt GA-t", TRACKERS.some((t) => withTracker.includes(t)));
  const fullPage = renderTenantLegalPage({ recipe, data: demo, kind: "imprint", who: FULL, host: HOST });
  check("RED: teljes adatnál tényleg nincs hiány-jelölés", !fullPage.includes(TENANT_LEGAL_MISSING));
}

// ── 7. BEHAVIOUR (opt-in): the screenshot does not prove the page WORKS ───────
if (BROWSER) {
  console.log("\nBöngésző (a kép nem bizonyít viselkedést)");
  const { chromium } = await import("playwright-core");
  const { createServer } = await import("node:http");
  const pages: Record<string, string> = {
    "/adatvedelem": privacy,
    "/impresszum": imprint,
  };
  const server = createServer((req, res) => {
    const url = (req.url ?? "/").split("?")[0]!;
    if (url === "/favicon.ico") return void res.writeHead(204).end(); // fixture noise, not a page defect
    const body = pages[url];
    if (!body) return void res.writeHead(404).end("nincs");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });

  for (const [w, tag] of [[390, "mobil"], [1280, "asztali"]] as const) {
    const page = await browser.newPage({ viewport: { width: w, height: 900 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/adatvedelem`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);

    const secs = page.locator(".cit-lg-sec");
    const openCount = await secs.evaluateAll((els) =>
      els.filter((e) => (e as HTMLDetailsElement).open).length,
    );
    if (w === 390) {
      // Mobile: only the first section starts open; the rest open on tap.
      check(`${tag}: csak az első szakasz nyitva`, openCount === 1, `${openCount} nyitva`);
      const second = secs.nth(1);
      await second.locator("summary").click();
      await page.waitForTimeout(250);
      check(
        `${tag}: koppintásra kinyílik`,
        await second.evaluate((e) => (e as HTMLDetailsElement).open),
      );
      // Every section's text must be REACHABLE, not merely present in the DOM.
      check(
        `${tag}: a kinyitott szakasz szövege látszik`,
        await second.locator(".cit-lg-body").first().isVisible(),
      );
      check(`${tag}: nincs oldalsó tartalomjegyzék`, !(await page.locator(".cit-lg-toc").isVisible()));
      // The mobile table must not overflow: measured 444px inside 390px before the fix.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      check(`${tag}: nincs vízszintes túlcsordulás`, !overflow);
    } else {
      check(`${tag}: minden szakasz nyitva`, openCount === (await secs.count()), `${openCount} nyitva`);
      check(`${tag}: látszik a tartalomjegyzék`, await page.locator(".cit-lg-toc").isVisible());
      // Scroll-spy: after jumping to a section that section is the highlighted one.
      await page.locator('.cit-lg-toc a[href="#sutik"]').click();
      await page.waitForTimeout(600);
      check(
        `${tag}: a tartalomjegyzék követi az olvasót`,
        await page.locator('.cit-lg-toc a[href="#sutik"]').evaluate((a) => a.classList.contains("is-active")),
      );
    }
    // The imprint is one click away from the privacy page (footer link).
    await page.locator(`a[href="${TENANT_LEGAL_PATHS.imprint}"]:visible`).first().click();
    await page.waitForTimeout(400);
    check(`${tag}: az impresszum egy kattintás`, page.url().endsWith(TENANT_LEGAL_PATHS.imprint));
    check(`${tag}: 0 JS-hiba`, errors.length === 0, errors.slice(0, 2).join(" | "));
    await page.close();
  }
  await browser.close();
  server.close();
}

console.log(
  fails === 0
    ? "\n✅ tenant-legal-check: a generált oldal jogi lábazata rendben."
    : `\n🔴 tenant-legal-check: ${fails} hiba.`,
);
process.exit(fails === 0 ? 0 : 1);
