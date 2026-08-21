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
import { adminDashboard } from "../src/server/adminViews.js";
import { moduleSettingsSection } from "../src/server/moduleConfigViews.js";
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

// tab id → the KB entry that embeds this capture.
const TAB_TO_ENTRY: readonly [tab: string, entryId: string][] = [
  ["attekintes", "admin-overview"],
  ["szovegek", "admin-texts"],
  ["fotok", "admin-photos"],
  ["modulok", "admin-modules"],
  ["fiok", "admin-account"],
];

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
  if (entryId === "admin-modules-rooms")
    return moduleSettingsSection("rooms", {
      ...common,
      values: effectiveModuleConfig("rooms", null, null),
      units: editorUnits.map((u) => ({ ...u })),
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
): Promise<void> {
  const html = adminDashboard(session, content, {
    tab,
    modules,
    siteUrl: "https://nyugalom-vendeghaz.citoviso.com",
    previewToken: "demo",
    units,
    ...(moduleSettingsHtml ? { moduleSettingsHtml } : {}),
    ...(tab === "sugo" ? { help: helpFixture(topic) } : {}),
  })
    // Design core + fixture photos straight off disk instead of through the server.
    .replaceAll('href="/assets/', `href="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`)
    .replaceAll('src="/assets/', `src="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`);
  const file = path.join(tmp, `${tab}-${topic ?? "x"}.html`);
  await writeFile(file, html, "utf8");
  await page.goto(pathToFileURL(file).href);
  await page.waitForTimeout(300);
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
// Verification-only shots (mobile nav with the Súgó tab + an open guide) — CWD.
await shoot("sugo", path.join(process.cwd(), "kb-shot-sugo-list.png"));
await shoot("sugo", path.join(process.cwd(), "kb-shot-sugo-open.png"), "admin-photos");

await browser.close();
console.log(`kb-shot: kész (${LANG})`);
