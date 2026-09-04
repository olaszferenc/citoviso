// KB screenshot generator (ADR-0045, §J.26): REPRODUCIBLE, language-parametric
// captures for the knowledge base — the guide images regenerate from the real views
// whenever the UI changes, instead of rotting as hand-made screenshots.
//
// Shoots every admin tab at phone width (the owner's real device) with representative
// fixture data and writes the capture straight into the owning entry's assets/<lang>/.
// Also drops verification shots of the Súgó tab itself into the CWD (not embedded).
// No server, no login: the views are pure functions (shot-module-config minta).
//
//   npx tsx scripts/kb-shot.mts

import { chromium } from "playwright-core";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import { adminDashboard, domainSettlementSection } from "../src/server/adminViews.js";
import { moduleSettingsSection } from "../src/server/moduleConfigViews.js";
import {
  dashboardPage,
  duplicatesPage,
  helpPage,
  leadPage,
  leadsPage,
  outreachDraftPage,
  pricingPage,
  reportPage,
  scrapePage,
  settingsPage,
} from "../src/console/views.js";
import { testLogPage } from "../src/console/testLogViews.js";
import { findScenario } from "../src/elek/fkParse.js";
import type { FunnelCounts, FunnelReport, LeadDetail, LeadListRow } from "../src/console/data.js";
import type { PricingSnapshot } from "../src/pricing.js";
import { effectiveModuleConfig } from "../src/moduleConfig.js";
import { loadKbEntries, renderKbBody } from "../src/kb/kb.js";
import { getTenantModules } from "../src/tenant/modules.js";
import type { MonthView } from "../src/tenant/availability.js";

const ROOT = path.resolve(import.meta.dirname, "..");
// Language of the shot UI. Today the admin renders Hungarian; when the admin surface
// gets language packs, this drives per-language captures of the same fixtures.
const LANG = process.env.KB_SHOT_LANG ?? "hu";

const session = {
  tenantId: "demo",
  tenantUserId: "demo-user",
  username: "kovacs.jozsef",
  displayName: "Nyugalom Vendégház",
  contactEmail: "kovacs.jozsef@gmail.com",
} as unknown as Parameters<typeof adminDashboard>[0];

// Photos come from the repo's own template thumbnails so the capture needs no
// network and no tenant data — representative, never personal.
const content = {
  name: "Nyugalom Vendégház",
  tagline: "Csend, kert, Balaton",
  intro:
    "Kétszáz méterre a strandtól, saját kerttel és árnyas terasszal várjuk. " +
    "Nálunk a reggeli kakukkfű-illatú, a esték tücsökszóval telnek.",
  highlights: ["Saját parkoló", "Kutyabarát", "Zárt kerékpártároló"],
  photos: [
    { url: "/assets/ui/tpl-organic.jpg", alt: "A kert nyáron", units: ["u1"] },
    { url: "/assets/ui/tpl-editorial.jpg", alt: "", units: [] },
    { url: "/assets/ui/tpl-watercolor.jpg", alt: "A terasz", units: ["u2"] },
  ],
  usingOwnPhotos: true,
  status: "live",
  previewPath: null,
} as unknown as Parameters<typeof adminDashboard>[1];

const units = [
  { id: "u1", name: "Kertre néző apartman" },
  { id: "u2", name: "Padlásszoba" },
];

const modules = await getTenantModules("00000000-0000-0000-0000-000000000000").catch(() => null);

// ADR-0088 §8: the subscription card with the annual-switch savings box — the
// admin-subscription guide's picture. Representative numbers (base 3 900 +
// three modules), monthly cadence so the NEW switch offer is visible.
const subscriptionFixture = {
  status: "active" as const,
  periodEnd: "2026-09-28",
  renewDay: 28,
  nextInvoiceTotal: 6070,
  nextInvoiceItems: [
    { label: "Fotógaléria", price: 490, isNew: false },
    { label: "Szobák és árak", price: 690, isNew: false },
    { label: "Online foglalás", price: 990, isNew: true },
  ],
  payUrl: null,
  cancelAtPeriodEnd: false,
  billingPeriod: "monthly" as const,
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: 60700,
  annualSavings: 12140,
  annualFreeMonths: 2,
  // ADR-0088 ⑨: the guide shows the mandate block ON and a live coupon — those
  // are the states the text walks the owner through.
  autoCharge: true,
  coupon: { percent: 25, expiresAt: "2026-11-30" },
};

// tab id → the KB entry that embeds this capture.
const TAB_TO_ENTRY: readonly [tab: string, entryId: string][] = [
  ["attekintes", "admin-overview"],
  ["szovegek", "admin-texts"],
  ["fotok", "admin-photos"],
  ["modulok", "admin-modules"],
  ["modulok", "admin-subscription"],
  ["dokumentumok", "admin-documents"],
  ["uzenetek", "admin-messages"],
  ["fiok", "admin-account"],
];

// ADR-0084 fixtures. Representative, never personal: an invented guesthouse's own
// invoices and our own service notices. The FAILED row is here on purpose — the
// guide explains that state, so the picture has to contain it.
const dt = (s: string): Date => new Date(`${s}T10:00:00Z`);
const documentsFixture = {
  invoices: [
    { id: "f1", invoiceNumber: "OV-2026-5", issuedAt: dt("2026-08-28"), gross: 7240,
      currency: "HUF", status: "issued", vatTreatment: "aam", hasPdf: true,
      periodStart: dt("2026-08-28"), periodEnd: dt("2026-09-27"), year: "2026" },
    { id: "f2", invoiceNumber: null, issuedAt: dt("2026-08-28"), gross: 14900,
      currency: "HUF", status: "failed", vatTreatment: null, hasPdf: false,
      periodStart: null, periodEnd: null, year: "2026" },
    { id: "f3", invoiceNumber: "OV-2026-4", issuedAt: dt("2026-07-28"), gross: 7240,
      currency: "HUF", status: "issued", vatTreatment: "aam", hasPdf: true,
      periodStart: dt("2026-07-28"), periodEnd: dt("2026-08-27"), year: "2026" },
  ],
  agreements: [
    { key: "terms", acceptedAt: dt("2026-06-28"), year: "2026", text: null, facts: [] },
    { key: "photo_rights", acceptedAt: dt("2026-06-28"), year: "2026",
      text: "Kijelentem, hogy a honlapon megjelenő képek felhasználására jogosult vagyok.",
      facts: [] },
  ],
  sub: "szamlak",
  year: "mind",
  q: "",
  nextRenewal: dt("2026-09-28"),
};
const messagesFixture = {
  messages: [
    { id: "m1", channel: "email" as const,
      subject: "Utolsó figyelmeztetés — 3 nap múlva felfüggesztés",
      bodyText: "Tisztelt Ügyfelünk!\n\nA 2026.08.28-i esedékességű díj még nem érkezett meg.",
      recipient: "kovacs.jozsef@gmail.com", attachmentName: null,
      relatedKind: null, relatedId: null, sentAt: dt("2026-08-29"), readAt: null },
    { id: "m2", channel: "sms" as const, subject: null,
      bodyText: "Citoviso: a 2026.08.28-i díj még nem érkezett meg. Rendezés: citoviso.com/admin",
      recipient: "+36 30 123 4567", attachmentName: null,
      relatedKind: null, relatedId: null, sentAt: dt("2026-08-29"), readAt: null },
    { id: "m3", channel: "email" as const, subject: "Számla — OV-2026-5 (7 240 Ft)",
      bodyText: "Mellékelten küldjük a 2026.08.28.–2026.09.27. időszakra vonatkozó számlát.",
      recipient: "kovacs.jozsef@gmail.com", attachmentName: "szamla-OV-2026-5.pdf",
      relatedKind: "invoice", relatedId: "f1", sentAt: dt("2026-08-28"), readAt: dt("2026-08-28") },
    { id: "m4", channel: "email" as const, subject: "Elkészült a honlapja",
      bodyText: "Gratulálunk! Honlapja elérhető a nyugalom-vendeghaz.citoviso.com címen.",
      recipient: "kovacs.jozsef@gmail.com", attachmentName: null,
      relatedKind: null, relatedId: null, sentAt: dt("2026-06-28"), readAt: dt("2026-06-28") },
  ],
  unread: 2,
  filter: "mind",
  q: "",
  openId: null,
};

// Representative month for the booking calendar (shot-module-config minta):
// hand-blocked and portal days both present, so the legend is exercised.
function monthFixture(): MonthView {
  const month = "2026-09";
  const manual = new Set([11, 12, 13, 26, 27]);
  const portal = new Set([4, 5, 6, 19, 20]);
  const cells = Array.from({ length: 30 }, (_, i) => {
    const dom = i + 1;
    const isPortal = portal.has(dom);
    const blocked = manual.has(dom) || isPortal;
    return {
      day: `${month}-${String(dom).padStart(2, "0")}`,
      dom,
      blocked,
      source: isPortal ? ("ical" as const) : blocked ? ("manual" as const) : null,
      editable: !isPortal,
      past: false,
    };
  });
  return {
    month,
    label: "2026. szeptember",
    prevMonth: "2026-08",
    nextMonth: "2026-10",
    leadingBlanks: 1,
    cells,
    blockedCount: manual.size + portal.size,
    importedCount: portal.size,
  };
}

const editorUnits = [
  {
    id: "u1",
    name: "Kertre néző apartman",
    capacity: 4,
    description: "Tágas, világos apartman a kertre néző terasszal.",
    slug: "kertre-nezo-apartman",
    amenities: ["Saját fürdőszoba", "Erkély", "Klíma"],
    photoCount: 2,
  },
  {
    id: "u2",
    name: "Padlásszoba",
    capacity: 2,
    description: null,
    slug: "padlasszoba",
    amenities: [],
    photoCount: 0,
  },
];

// Module settings screens → the KB entry that embeds each capture.
function moduleShotHtml(entryId: string): string {
  const common = { canRestore: true, priceMonthly: 990 };
  if (entryId === "admin-modules-booking")
    return moduleSettingsSection("booking", {
      ...common,
      values: effectiveModuleConfig("booking", null, null),
      booking: {
        month: monthFixture(),
        units: editorUnits.map((u) => ({ ...u })),
        unitId: "u1",
        links: [],
        exportUrl: null,
        requests: [
          {
            id: "r1",
            unitName: "Padlásszoba",
            guestName: "Kovács Anna",
            guestEmail: "anna@example.com",
            guestPhone: "+36 30 123 4567",
            dateFrom: "2026-09-10",
            dateTo: "2026-09-12",
            guests: 2,
            message: "Kutyával érkeznénk, ha lehetséges.",
            status: "pending",
            token: "tok1",
          },
        ],
      },
    });
  if (entryId === "admin-modules-amenities")
    return moduleSettingsSection("amenities", {
      ...common,
      // A believable mid-edit state: a few picks + one free line, so the shot
      // shows checked tiles, the chip row and the Egyéb box in one screen.
      values: { items: ["Ingyenes Wi‑Fi", "Medence", "Kert", "Ingyenes parkolás", "házi szörp a teraszon"] },
    });
  if (entryId === "admin-modules-rooms")
    return moduleSettingsSection("rooms", {
      ...common,
      values: effectiveModuleConfig("rooms", null, null),
      units: editorUnits.map((u) => ({ ...u })),
      // Plan F: the screenshot must show what the entry describes — the icon
      // picker with a couple of site-wide picks inherited (greyed) on the card.
      unitAmenities: { active: true, siteSelected: ["Medence", "Ingyenes Wi‑Fi"] },
    });
  if (entryId === "admin-modules-pricing")
    return moduleSettingsSection("pricing", {
      ...common,
      values: effectiveModuleConfig("pricing", null, null),
      pricing: {
        units: editorUnits.map((u) => ({ ...u })),
        currency: "HUF",
        prices: {
          u1: [
            { id: "p1", label: "Alapár", from: null, to: null, amount: 24000, isBase: true },
            { id: "p2", label: "Főszezon", from: "06-15", to: "08-31", amount: 32000, isBase: false },
          ],
          u2: [{ id: "p3", label: "Alapár", from: null, to: null, amount: 16000, isBase: true }],
        },
      },
    });
  // Generic fields form — the hours module is the representative screen.
  return moduleSettingsSection("hours", {
    ...common,
    values: effectiveModuleConfig("hours", null, null),
  });
}

const MODULE_SHOT_ENTRIES = [
  "admin-modules-amenities",
  "admin-modules-booking",
  "admin-modules-rooms",
  "admin-modules-pricing",
  "admin-modules-settings",
] as const;

function helpFixture(topic?: string) {
  const entries = loadKbEntries().filter((e) => e.audience === "tenant");
  const open = topic ? (entries.find((e) => e.id === topic) ?? null) : null;
  // Images resolve to the repo files directly so the verification shot shows them.
  const assetBase = open
    ? `${pathToFileURL(path.join(ROOT, "kb/entries", open.id)).href}/`
    : "";
  return {
    topics: entries.map((e) => ({ id: e.id, title: e.title, snippet: e.snippet })),
    open: open
      ? { title: open.title, html: renderKbBody(open.body, assetBase), updated: open.updated }
      : null,
    query: "",
  };
}

const tmp = await mkdtemp(path.join(tmpdir(), "kbshot-"));
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  deviceScaleFactor: 2,
});

async function shoot(
  tab: string,
  outPath: string,
  topic?: string,
  moduleSettingsHtml?: string,
  scrollTo?: string,
): Promise<void> {
  const html = adminDashboard(session, content, {
    tab,
    modules,
    siteUrl: "https://nyugalom-vendeghaz.citoviso.com",
    previewToken: "demo",
    units,
    ...(moduleSettingsHtml ? { moduleSettingsHtml } : {}),
    ...(tab === "sugo" ? { help: helpFixture(topic) } : {}),
    // ADR-0084: the two document/message tabs need their own fixtures, and the
    // unread badge must show on EVERY capture — it lives in the nav, not the tab.
    ...(tab === "modulok" ? { subscription: subscriptionFixture } : {}),
    ...(tab === "dokumentumok" ? { documents: documentsFixture } : {}),
    ...(tab === "uzenetek" ? { messages: messagesFixture } : {}),
    unreadMessages: messagesFixture.unread,
  })
    // Design core + fixture photos straight off disk instead of through the server.
    .replaceAll('href="/assets/', `href="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`)
    .replaceAll('src="/assets/', `src="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`);
  const file = path.join(tmp, `${tab}-${topic ?? "x"}-${path.basename(outPath, ".png")}.html`);
  await writeFile(file, html, "utf8");
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(300);
  // A guide image must show what its entry describes — when the subject sits
  // below the fold (the room card's amenity picker), capture THAT element:
  // deterministic, no scroll-timing races.
  if (scrollTo) {
    await mkdir(path.dirname(outPath), { recursive: true });
    await page.locator(scrollTo).first().screenshot({ path: outPath });
    console.log(`  ✓ ${path.relative(ROOT, outPath)} (elem: ${scrollTo})`);
    return;
  }
  await mkdir(path.dirname(outPath), { recursive: true });
  // Viewport shot, NOT fullPage: a full-page capture paints the fixed bottom nav
  // mid-image, and the guide should show what the owner first sees on the tab.
  await page.screenshot({ path: outPath });
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

for (const [tab, entryId] of TAB_TO_ENTRY) {
  await shoot(tab, path.join(ROOT, "kb/entries", entryId, "assets", LANG, "screen.png"));
}
for (const entryId of MODULE_SHOT_ENTRIES) {
  await shoot(
    "modulok",
    path.join(ROOT, "kb/entries", entryId, "assets", LANG, "screen.png"),
    undefined,
    moduleShotHtml(entryId),
  );
}
// ADR-0094 ②: the settlement page (approved plan B) — the SAME representative
// numbers the frozen plan mock uses (12/5/7 months, 8 000 floor, 20 000 buyout),
// so the guide image and the contract tell one story.
await shoot(
  "modulok",
  path.join(ROOT, "kb/entries", "admin-settlement", "assets", LANG, "screen.png"),
  undefined,
  domainSettlementSection(
    {
      domainName: "nyugalomvendeghaz.hu",
      monthsTotal: 12,
      monthsElapsed: 5,
      monthsRemaining: 7,
      penaltyBase: 8000,
      penaltyTotal: 56000,
      buyoutPrice: 20000,
      accessEndDate: "2026-09-28",
      done: null,
      error: null,
    },
    LANG,
  ),
);
// The rooms entry's second image: the amenity picker itself, which lives below
// the fold on the room card (kb guard finding, 2026-08-26).
await shoot(
  "modulok",
  path.join(ROOT, "kb/entries", "admin-modules-rooms", "assets", LANG, "picker.png"),
  undefined,
  moduleShotHtml("admin-modules-rooms"),
  ".ampick",
);
// Verification-only shots (mobile nav with the Súgó tab + an open guide) — CWD.
await shoot("sugo", path.join(process.cwd(), "kb-shot-sugo-list.png"));
await shoot("sugo", path.join(process.cwd(), "kb-shot-sugo-open.png"), "admin-photos");

// ── Operator console screens (ADR-0045/e) ───────────────────────────────────
// The console views are pure functions too — representative fixtures, no DB, no
// login. Hungarian only: operator guides do not translate (the console renders
// Hungarian; widen when the console gets language packs).

const fc = (
  prospects: number,
  sent: number,
  opened: number,
  returned: number,
  moduleTouched: number,
  orderIntent: number,
  converted: number,
): FunnelCounts => ({
  prospects,
  sent,
  opened,
  returned,
  moduleTouched,
  orderIntent,
  converted,
  unsubscribed: 0,
  openedOfSent: opened,
  orderIntentOfSent: orderIntent,
});
const funnel: FunnelReport = {
  total: fc(24, 20, 11, 5, 4, 2, 1),
  segments: [
    { segment: "nincs_honlap", ...fc(14, 12, 8, 4, 3, 2, 1) },
    { segment: "elavult_honlap", ...fc(10, 8, 3, 1, 1, 0, 0) },
  ] as unknown as FunnelReport["segments"],
  leadTotals: { players: 419, leads: 111, mocks: 30, approved: 9 },
};

const leadRow = (
  id: string,
  name: string,
  qualification: string,
  city: string,
  photos: number,
  contact: string,
  artifact: { id: string; status: string } | null,
): LeadListRow => ({
  id,
  name,
  qualification,
  matchConfidence: 0.92,
  region: "keszthely",
  country: "HU",
  city,
  photos,
  streetView: true,
  material: photos + 1,
  contact,
  lifecycle: "qualified",
  latestArtifact: artifact,
  outreachSentAt: artifact?.status === "approved" ? "2026-08-20T09:00:00Z" : null,
});
const leadRows: LeadListRow[] = [
  leadRow("l1", "Nyugalom Vendégház", "no_site", "Keszthely", 11, "email", {
    id: "a1",
    status: "approved",
  }),
  leadRow("l2", "Fenyves Apartman", "no_site", "Hévíz", 6, "email", {
    id: "a2",
    status: "generated",
  }),
  leadRow("l3", "Borostyán Panzió", "outdated", "Gyenesdiás", 4, "sms", null),
];

const leadDetail: LeadDetail = {
  id: "l1",
  name: "Nyugalom Vendégház",
  qualification: "no_site",
  lifecycle: "qualified",
  matchConfidence: 0.92,
  address: "Keszthely, Fő út 12.",
  region: "keszthely",
  raw: {
    country: "HU",
    city: "Keszthely",
    phone: "+36 30 123 4567",
    email: "info@example.com",
  },
  provenance: [
    { field: "name", value: "Nyugalom Vendégház", source: "google_places", confidence: 0.95 },
    { field: "phone", value: "+36 30 123 4567", source: "web_search", confidence: 0.8 },
  ],
  artifacts: [
    {
      id: "a1",
      status: "approved",
      path: "sites/mock/a1/index.html",
      inputs: { template: "fullbleed-glass", lang: "hu" },
      generatedAt: "2026-08-20T08:30:00Z",
      decisions: [
        {
          decision: "approve",
          notes: "Rendben, mehet.",
          decidedBy: "olaszferenc",
          decidedAt: "2026-08-20T09:00:00Z",
        },
      ],
    },
  ],
};

const huPricing: PricingSnapshot = {
  region: "hu",
  currency: "HUF",
  baseMonthly: 4990,
  annualFreeMonths: 2,
  customDomainYearly: 9900,
  domainMaxPriceEur: 15,
  domainMinCommitmentMonths: 12,
  domainFreeMinMonthly: 8000,
  domainBuyoutPrice: 20000,
  pricingConfirmed: true,
  modulePrices: new Map([["booking", 990]]),
};
const globalPricing: PricingSnapshot = { ...huPricing, region: "global", currency: "EUR", baseMonthly: 10, customDomainYearly: 25 };

const scrapeIdle = {
  running: false,
  regionId: null,
  cap: null,
  startedAt: null,
  finishedAt: new Date("2026-08-20T10:00:00Z"),
  exitCode: 0,
  log: ["[scrape] keszthely — 111 szereplő, 42 új lead", "[scrape] kész (exit 0)"],
};
const scrapeRuns = [
  {
    id: "r1",
    regionLabel: "Keszthely és környéke",
    status: "completed",
    startedAt: new Date("2026-08-20T09:00:00Z"),
    finishedAt: new Date("2026-08-20T10:00:00Z"),
    stats: { players: 111, leads: 42 },
    error: null,
  },
];

const dupClusters = [
  {
    id: "c1",
    signals: ["phone", "proximity"],
    maxDistanceM: 120,
    pairs: [{ a: "l1", b: "l4" }],
    leads: [
      {
        id: "l1",
        name: "Nyugalom Vendégház",
        city: "Keszthely",
        qualification: "no_site",
        email: "info@example.com",
        phone: "+36 30 123 4567",
        website: null,
      },
      {
        id: "l4",
        name: "Nyugalom Apartman",
        city: "Keszthely",
        qualification: "no_site",
        email: null,
        phone: "+36 30 123 4567",
        website: null,
      },
    ],
  },
];

/** Console page HTML → 390px viewport capture (same pipeline as the admin shots). */
async function shootConsole(html: string, outPath: string): Promise<void> {
  const patched = html
    .replaceAll('href="/assets/', `href="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`)
    .replaceAll('src="/assets/', `src="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`);
  const file = path.join(tmp, `con-${path.basename(outPath, ".png")}.html`);
  await writeFile(file, patched, "utf8");
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(300);
  await mkdir(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath });
  console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
}

const conOut = (entryId: string): string =>
  path.join(ROOT, "kb/entries", entryId, "assets", "hu", "screen.png");
// Finance chips/hub counters (the dashboard is a hub since the 2026-08-23 redesign).
const finCounts = { docs: 12, open: 3, overdue: 1, partners: 7 };
await shootConsole(dashboardPage(funnel, false, "Ferenc", finCounts), conOut("console-dashboard"));
await shootConsole(leadsPage(leadRows), conOut("console-leads"));
await shootConsole(leadPage(leadDetail), conOut("console-lead"));
await shootConsole(
  scrapePage(scrapeIdle, scrapeRuns, [{ id: "keszthely", label: "Keszthely és környéke" }]),
  conOut("console-scrape"),
);
await shootConsole(duplicatesPage(dupClusters), conOut("console-duplicates"));
await shootConsole(reportPage(funnel), conOut("console-report"));
await shootConsole(pricingPage(huPricing, [huPricing, globalPricing]), conOut("console-pricing"));
await shootConsole(
  settingsPage({ username: "olaszferenc", displayName: "Olasz Ferenc", role: "admin" }),
  conOut("console-settings"),
);
// Test-log journal — rendered from the real FK-000 smoke scenario so the guide
// image regenerates together with the scenario it documents.
{
  const fk000 = findScenario("FK-000");
  if (!fk000) throw new Error("kb-shot: FK-000 hiányzik (elek/scenarios)");
  await shootConsole(
    testLogPage(fk000, {
      currentUser: "olaszferenc",
      viewUser: null,
      save: {
        user: "olaszferenc",
        fkId: fk000.id,
        ts: "2026-09-04T10:12:00.000Z",
        checks: [true, true, false, false, false],
        comments: ["", "A leadek lista rendben; a súgót még nem néztem."],
        summary: "",
      },
      saves: [{ user: "olaszferenc", ts: "2026-09-04T10:12:00.000Z", done: 2, total: 5 }],
    }),
    conOut("console-test-log"),
  );
}
// Outreach draft screen (§C gate + channel picker) — the workflow's legal gate.
await shootConsole(
  outreachDraftPage(
    "p1",
    { leadName: "Nyugalom Vendégház", segment: "nincs_honlap" },
    {
      subject: "Elkészítettük a vendégháza honlap-tervét",
      body:
        "Kedves Vendéglátó!\n\nElkészítettük a Nyugalom Vendégház honlap-tervét — " +
        "egy kattintással megnézheti: https://citoviso.com/p/demo\n\nÜdvözlettel,\nCitoviso",
      link: "https://citoviso.com/p/demo",
    },
    { verdict: "PASS", reasons: [] },
    "info@example.com",
    null,
    {
      sms: { text: "Elkészítettük a honlap-tervét: https://citoviso.com/p/demo — Citoviso" },
      phone: "+36 30 123 4567",
    },
    "l1",
  ),
  conOut("console-outreach-draft"),
);
// Verification-only: the console Súgó page itself (list state) — CWD.
await shootConsole(
  helpPage({
    operatorTopics: [
      { id: "console-lead", title: "Lead-lap — a munkafolyamat", snippet: "Mock-generálás, kuráció, megkeresés, konverzió" },
    ],
    tenantTopics: [
      { id: "admin-photos", title: "Fotók kezelése — feltöltés, sorrend, nyitókép", snippet: "Saját fotók, sorrend, képaláírás" },
    ],
    open: null,
    query: "",
  }),
  path.join(process.cwd(), "kb-shot-console-help.png"),
);

await browser.close();
console.log(`kb-shot: kész (${LANG})`);
