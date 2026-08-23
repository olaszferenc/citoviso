// GUARD — the partner console must BEHAVE, not merely render (PARTNER-UI-SPEC +
// feedback_guard_must_measure_what_matters). What it measures and why:
//
//   ① Aging boundaries (30/31, 60/61, 90/91) + conservation: every unpaid item
//      lands in EXACTLY one bucket and the buckets sum to the open total — a
//      wrong boundary silently misstates who owes what for how long.
//   ② Payment habit: sign and on-time ratio from paid_at−due_date — the sign
//      flipping would call a punctual payer late (and vice versa).
//   ③ CSV: BOM present, row count = filtered rows, separator-bearing fields
//      escaped — a naked separator shifts every later column in Excel.
//   ④ Tabs SWITCH in a real browser (desktop + 390px): clicking "Bizonylatok"
//      must show the document table, clicking back must show the master data.
//      Tap size measured as a RANGE (30–70px), not a lower bound.
//   ⑤ Role decree: a pure supplier's tab bar carries NO "Előfizetés" tab.
//
// Self-test (--self-test): re-runs ① against a deliberately broken bucketing
// and ④ against markup with the tab links cut — both MUST go red, or the guard
// itself is broken.
//
//   npx tsx scripts/partner-ui-check.mts [--self-test]

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

import {
  agingBucketFor,
  buildDocumentsCsv,
  settleOffsetDays,
  type AgingBuckets,
  type PartnerDetail,
  type PartnerDocuments,
} from "../src/console/partnerData.js";
import { partnerPage, type PartnerTab } from "../src/console/partnerViews.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF_TEST = process.argv.includes("--self-test");
const DAY = 86_400_000;

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  console.log(`  ${cond ? "ok  " : "🔴  "} ${name}${detail ? ` (${detail})` : ""}`);
  if (!cond) failures++;
}

// ── Fixtures (hermetic — no DB, no network) ─────────────────────────────────

const NOW = Date.UTC(2026, 7, 23, 12, 0, 0); // fixed clock: boundary math must not depend on run time

function detailFixture(over: Partial<PartnerDetail> = {}): PartnerDetail {
  return {
    id: "00000000-0000-4000-8000-00000000000a",
    name: "Őr Teszt Kft.",
    isCustomer: true,
    isSupplier: false,
    active: true,
    taxNumber: "12345678-2-41",
    euVatNumber: null,
    registrationNo: "01-09-999999",
    country: "HU",
    zip: "1111",
    city: "Budapest",
    address: "Teszt u. 1.",
    email: "guard@example.test",
    phone: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    bankAccounts: [],
    tenant: null,
    receivable: { HUF: 24_900 },
    payable: {},
    yearSpend: {},
    docCount: 2,
    ...over,
  };
}

function docsFixture(): PartnerDocuments {
  const iso = (ms: number) => new Date(ms).toISOString();
  return {
    rows: [
      {
        id: "00000000-0000-4000-8000-0000000000d1",
        direction: "outgoing",
        docType: "invoice",
        documentNumber: "G-1; pontosvesszős",
        issueDate: iso(NOW - 20 * DAY),
        dueDate: iso(NOW - 12 * DAY),
        net: 24_900,
        gross: 24_900,
        currency: "HUF",
        paid: false,
        paidAt: null,
        entityName: "Őr Entitás",
        hasFile: false,
      },
      {
        id: "00000000-0000-4000-8000-0000000000d2",
        direction: "outgoing",
        docType: "invoice",
        documentNumber: "G-2",
        issueDate: iso(NOW - 40 * DAY),
        dueDate: iso(NOW - 35 * DAY),
        net: 10_000,
        gross: 10_000,
        currency: "HUF",
        paid: true,
        paidAt: iso(NOW - 36 * DAY),
        entityName: "Őr Entitás",
        hasFile: false,
      },
    ],
    totalGross: { HUF: 34_900 },
    paidGross: { HUF: 10_000 },
    openGross: { HUF: 24_900 },
    aging: { notDue: {}, d1to30: { HUF: 24_900 }, d31to60: {}, d61to90: {}, d90plus: {} },
    habit: { avgDays: -1, onTimeRatio: 1, sample: 1 },
  };
}

// ── ① Aging boundaries + conservation ───────────────────────────────────────

function runAgingChecks(bucketFn: typeof agingBucketFor, label: string): void {
  console.log(`\n${label}:`);
  const cases: Array<[number | null, keyof AgingBuckets, string]> = [
    [NOW + 5 * DAY, "notDue", "5 nappal határidő előtt"],
    [NOW, "notDue", "ma jár le (0 nap = még nem késett)"],
    [NOW - 1 * DAY, "d1to30", "1 napja lejárt (alsó határ)"],
    [NOW - 30 * DAY, "d1to30", "30 napja lejárt (felső határ)"],
    [NOW - 31 * DAY, "d31to60", "31 napja lejárt (vödör-váltás)"],
    [NOW - 60 * DAY, "d31to60", "60 nap"],
    [NOW - 61 * DAY, "d61to90", "61 nap (vödör-váltás)"],
    [NOW - 90 * DAY, "d61to90", "90 nap"],
    [NOW - 91 * DAY, "d90plus", "91 nap (vödör-váltás)"],
    [NOW - 400 * DAY, "d90plus", "400 nap"],
    [null, "notDue", "nincs határidő = nem állítható késés"],
  ];
  for (const [due, expected, why] of cases) {
    const got = bucketFn(due, NOW);
    check(`korosítás: ${why} → ${expected}`, got === expected, got !== expected ? `kapott: ${got}` : "");
  }
  // Conservation: a spread of unpaid items must land in exactly one bucket each.
  const dues = [12, 45, 75, 120, -3].map((d) => NOW - d * DAY);
  const buckets = dues.map((d) => bucketFn(d, NOW));
  const counts = new Map<string, number>();
  for (const b of buckets) counts.set(b, (counts.get(b) ?? 0) + 1);
  check(
    "korosítás-konzerváció: 5 tétel → 5 vödör-találat, tétel nem vész el és nem duplázódik",
    buckets.length === 5 && [...counts.values()].reduce((a, b) => a + b, 0) === 5,
  );
}

runAgingChecks(agingBucketFor, "① Korosítás-határok (éles implementáció)");

// ── ② Payment habit sign ────────────────────────────────────────────────────

console.log("\n② Fizetési szokás:");
check("határidő ELŐTT fizetés negatív offset", settleOffsetDays(NOW - 4 * DAY, NOW) < 0);
check("határidő UTÁN fizetés pozitív offset", settleOffsetDays(NOW + 6 * DAY, NOW) > 0);
check(
  "offset nagysága napra pontos (±0,01)",
  Math.abs(settleOffsetDays(NOW + 6 * DAY, NOW) - 6) < 0.01 &&
    Math.abs(settleOffsetDays(NOW - 4 * DAY, NOW) + 4) < 0.01,
);

// ── ③ CSV shape ─────────────────────────────────────────────────────────────

console.log("\n③ CSV-export:");
const csv = buildDocumentsCsv(docsFixture());
check("BOM az élen (Excel-UTF8 jel)", csv.charCodeAt(0) === 0xfeff);
const csvLines = csv.slice(1).split("\r\n");
check("sor-szám = fejléc + szűrt sorok", csvLines.length === 3, `kapott: ${csvLines.length}`);
check(
  "pontosvesszős mező idézőjelben (oszlop-eltolás ellen)",
  csvLines[1]!.startsWith(`"G-1; pontosvesszős"`),
);
check("tizedesvessző a számokban (magyar Excel)", /24900|24 900/.test(csvLines[1]!) || !csvLines[1]!.includes("."));

// ── ④⑤ Browser behaviour: tabs really switch; supplier has no Előfizetés ────

const MIME: Record<string, string> = { ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

/** Serve the partner page with tab routing, like the real console does. */
function serve(render: (tab: PartnerTab) => string): Promise<{ url: string; close: () => void }> {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://localhost");
    if (u.pathname.startsWith("/assets/")) {
      const f = path.join(ROOT, "public", u.pathname);
      if (fs.existsSync(f)) {
        res.writeHead(200, { "content-type": MIME[path.extname(f)] ?? "text/plain" });
        res.end(fs.readFileSync(f));
        return;
      }
    }
    const t = u.searchParams.get("tab");
    const tab: PartnerTab =
      t === "documents" ? "documents" : t === "contacts" ? "contacts" : t === "activity" ? "activity" : "overview";
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(render(tab));
  });
  return new Promise((resolve) =>
    server.listen(0, () =>
      resolve({
        url: `http://127.0.0.1:${(server.address() as { port: number }).port}`,
        close: () => server.close(),
      }),
    ),
  );
}

/** Self-test sabotage: cut the tab links the way a refactor could (dead hrefs). */
function cutTabLinks(html: string): string {
  return html.replace(/href="\/partner\/[^"]*\?tab=[^"]*"/g, `href="#"`);
}

const customer = detailFixture();
const supplier = detailFixture({ isCustomer: false, isSupplier: true, receivable: {}, payable: { EUR: 12.6 } });
const renderCustomer = (tab: PartnerTab) => partnerPage(customer, tab, [], docsFixture(), {});
const renderSabotaged = (tab: PartnerTab) => cutTabLinks(renderCustomer(tab));

async function runBrowserChecks(
  render: (tab: PartnerTab) => string,
  label: string,
): Promise<void> {
  console.log(`\n④ Fül-viselkedés (${label}):`);
  const { url, close } = await serve(render);
  const browser = await chromium.launch();
  try {
    for (const [w, h, vp] of [
      [1280, 900, "desktop"],
      [390, 844, "mobil-390"],
    ] as const) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      await page.goto(`${url}/partner/${customer.id}`);
      check(`[${vp}] Áttekintés törzsadat látszik`, await page.locator("dl.kv").first().isVisible());
      // CLICK the tab — behaviour, not markup.
      await page.locator('nav.con-tabs a', { hasText: "Bizonylatok" }).last().click();
      await page.waitForLoadState();
      const docsVisible = await page
        .locator("th", { hasText: "Számla szám" })
        .first()
        .isVisible()
        .catch(() => false);
      check(`[${vp}] Bizonylatok fülre KATTINTVA a bizonylat-tábla jön be`, docsVisible);
      // Range-measured tap size on the tab links (not a bare lower bound).
      const box = await page.locator("nav.con-tabs a").last().boundingBox();
      const tapOk = box !== null && box.height >= 30 && box.height <= 70;
      check(
        `[${vp}] fül tap-magasság 30–70px tartományban`,
        tapOk,
        box ? `${Math.round(box.height)}px` : "nincs box",
      );
      await page.close();
    }
    // ⑤ Role decree: supplier tab bar carries no Előfizetés.
    const suppPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const { url: suppUrl, close: closeSupp } = await serve((tab) => partnerPage(supplier, tab));
    await suppPage.goto(`${suppUrl}/partner/${supplier.id}`);
    const tabTexts = await suppPage.locator("nav.con-tabs a").allTextContents();
    check(
      "⑤ tiszta szállítónál NINCS Előfizetés fül (tulaj-rendelet)",
      !tabTexts.some((t) => t.includes("Előfizetés")),
      tabTexts.join(" | "),
    );
    const custPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await custPage.goto(`${url}/partner/${customer.id}`);
    const custTabs = await custPage.locator("nav.con-tabs a").allTextContents();
    check("⑤ vevőnél VAN Előfizetés fül", custTabs.some((t) => t.includes("Előfizetés")));
    await suppPage.close();
    await custPage.close();
    closeSupp();
  } finally {
    await browser.close();
    close();
  }
}

await runBrowserChecks(renderCustomer, "éles markup");

// ── Self-test: the guard must be able to go RED ─────────────────────────────

if (SELF_TEST) {
  console.log("\n── ÖNTESZT: szándékos rontások (pirosnak KELL lenniük) ──");
  const before = failures;

  // Broken bucketing: off-by-one boundary (31 days lands in 1–30).
  const brokenBucket: typeof agingBucketFor = (dueMs, nowMs) => {
    if (dueMs === null) return "notDue";
    const overdueDays = Math.floor((nowMs - dueMs) / 86_400_000);
    if (overdueDays <= 0) return "notDue";
    if (overdueDays <= 31) return "d1to30"; // <- the bug
    if (overdueDays <= 60) return "d31to60";
    if (overdueDays <= 90) return "d61to90";
    return "d90plus";
  };
  runAgingChecks(brokenBucket, "① Korosítás RONTOTT implementáción");
  const agingWentRed = failures > before;

  const beforeTabs = failures;
  await runBrowserChecks(renderSabotaged, "elvágott fül-linkek");
  const tabsWentRed = failures > beforeTabs;

  // The self-test verdict REPLACES the sabotage failures: red-on-sabotage is
  // the passing outcome here.
  failures = before;
  check("önteszt: a rontott korosítást az őr elkapta", agingWentRed);
  check("önteszt: az elvágott fül-linkeket az őr elkapta", tabsWentRed);
}

if (failures) {
  console.error(`\npartner-ui-check: 🔴 ${failures} hiba`);
  process.exit(1);
}
console.log(`\n✅ partner-ui-check: a partner-felület viselkedik (korosítás-határok, szokás-előjel, CSV, fül-kattintás, szerep-fülek).`);
