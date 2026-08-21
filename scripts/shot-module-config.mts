// Visual check for the per-module settings screens (ADR-0044).
//
// The owner uses the admin FROM A PHONE, so the ~390px view is the one that has to
// be right — this renders the real views with representative data and shoots both
// widths. No server, no login: the views are pure functions of their input, and the
// design core is loaded straight off disk.
//
//   npx tsx scripts/shot-module-config.mts

import { chromium } from "playwright-core";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import { adminDashboard } from "../src/server/adminViews.js";
import { moduleSettingsSection } from "../src/server/moduleConfigViews.js";
import { effectiveModuleConfig } from "../src/moduleConfig.js";
import type { MonthView } from "../src/tenant/availability.js";
import { getTenantModules } from "../src/tenant/modules.js";

const ROOT = path.resolve(import.meta.dirname, "..");

// A representative September: some hand-blocked days, some portal-imported ones,
// so the legend and the "not yours to change" styling are both exercised.
function septemberFixture(): MonthView {
  const month = "2026-09";
  const manual = new Set([11, 12, 13, 26, 27]);
  const portal = new Set([4, 5, 6, 19, 20]);
  const cells = Array.from({ length: 30 }, (_, i) => {
    const dom = i + 1;
    const day = `${month}-${String(dom).padStart(2, "0")}`;
    const isPortal = portal.has(dom);
    const blocked = manual.has(dom) || isPortal;
    return {
      day,
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
    leadingBlanks: 1, // 2026-09-01 is a Tuesday
    cells,
    blockedCount: manual.size + portal.size,
    importedCount: portal.size,
  };
}

const session = {
  tenantId: "demo",
  tenantUserId: "demo-user",
  username: "kovacs.jozsef",
  displayName: "Nyugalom Vendégház",
  contactEmail: "kovacs.jozsef@gmail.com",
} as unknown as Parameters<typeof adminDashboard>[0];

const content = {
  name: "Nyugalom Vendégház",
  tagline: "Csend, kert, Balaton",
  intro: "Kétszáz méterre a strandtól, saját kerttel.",
  highlights: ["Saját parkoló", "Kutyabarát"],
  photos: [],
  usingOwnPhotos: true,
  status: "live",
  previewPath: null,
} as unknown as Parameters<typeof adminDashboard>[1];

const modules = await getTenantModules("00000000-0000-0000-0000-000000000000").catch(() => null);

async function shoot(name: string, moduleId: string, withBooking: boolean): Promise<string[]> {
  const html = adminDashboard(session, content, {
    tab: "modulok",
    modules,
    siteUrl: "https://nyugalom-vendeghaz.citoviso.com",
    previewToken: "demo",
    moduleSettingsHtml: moduleSettingsSection(moduleId, {
      values: effectiveModuleConfig(moduleId, null, null),
      canRestore: true,
      priceMonthly: moduleId === "booking" ? 990 : 290,
      ...(withBooking
        ? {
            booking: {
              month: septemberFixture(),
              // Three units: the multi-unit case is the one that needs looking at,
              // since the single-unit owner must never see any of this chrome.
              units: [
                { id: "u1", name: "A szállás egésze", capacity: 8, description: null },
                { id: "u2", name: "Kertre néző apartman", capacity: 4, description: null },
                { id: "u3", name: "Padlásszoba", capacity: 2, description: null },
              ],
              unitId: "u2",
              links: [
                {
                  id: "l1",
                  provider: "Booking.com",
                  direction: "import",
                  lastSyncAt: new Date("2026-08-21T09:12:00"),
                  lastError: null,
                  lastDayCount: 14,
                },
              ],
              exportUrl: "https://nyugalom-vendeghaz.citoviso.com/naptar/8Kq2xRf9.ics",
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
          }
        : {}),
    }),
  })
    // Load the design core straight off disk instead of through the server.
    .replaceAll('href="/assets/', `href="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`);

  const dir = await mkdtemp(path.join(tmpdir(), "mcfg-"));
  const file = path.join(dir, `${name}.html`);
  await writeFile(file, html, "utf8");

  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const out: string[] = [];
  for (const [suffix, viewport, mobile] of [
    ["mobile", { width: 390, height: 900 }, true],
    ["desktop", { width: 1180, height: 900 }, false],
  ] as const) {
    const page = await browser.newPage({ viewport, isMobile: mobile });
    await page.goto(pathToFileURL(file).href);
    await page.waitForTimeout(250);
    const p = `shot-${name}-${suffix}.png`;
    await page.screenshot({ path: p, fullPage: true });
    out.push(p);
    if (mobile) {
      // The fixed bottom nav must not cover the primary action. A full-page shot
      // cannot show this (it paints fixed elements once), so check the real
      // viewport scrolled to the end — that is what the owner's thumb sees.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(200);
      const b = `shot-${name}-mobile-bottom.png`;
      await page.screenshot({ path: b });
      out.push(b);
    }
    await page.close();
  }
  await browser.close();
  return out;
}

const files = [
  ...(await shoot("booking", "booking", true)),
  ...(await shoot("hours", "hours", false)),
];
console.log(`wrote ${files.join(", ")}`);
