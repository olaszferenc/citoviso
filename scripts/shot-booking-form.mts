// Guest-facing booking form: visual + BEHAVIOURAL check (ADR-0044).
//
// The rendered markup is already asserted deterministically in module-config-check.
// What that cannot see is whether the hydrated form actually behaves: does it read
// the free days, does it refuse nights that are taken, does it stop an under-minimum
// stay, and does it fit a 390px phone. So this drives the real runtime in a browser
// with the availability endpoint stubbed.
//
//   npx tsx scripts/shot-booking-form.mts

import { chromium } from "playwright-core";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "../src/config.js";
import { bookingSlot } from "../src/engine/templateKit.js";
import { moduleSections } from "../src/engine/moduleSections.js";
import type { SiteData } from "../src/engine/recipe.js";

const ROOT = path.resolve(import.meta.dirname, "..");

function iso(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// Nights 10-12 from now are taken on the selected unit — the case the guest must
// not be able to book.
const BLOCKED = [iso(10), iso(11), iso(12)];

const data = {
  name: "Nyugalom Vendégház",
  tagline: "",
  intro: "",
  highlights: [],
  photos: [],
  contact: { email: "info@example.com", phone: "+36 30 123 4567" },
  booking: {
    units: [
      { id: "11111111-1111-1111-1111-111111111111", name: "Kertre néző apartman", capacity: 4 },
      { id: "22222222-2222-2222-2222-222222222222", name: "Padlásszoba", capacity: 2 },
    ],
    minNights: 2,
    maxNights: 14,
    horizonMonths: 12,
    leadTimeDays: 0,
    responseNote: "24 órán belül válaszolunk.",
  },
} as unknown as SiteData;

const [runtimeJs, modulesCss] = await Promise.all([
  readFile(path.join(ROOT, "assets/runtime/cit-runtime.js"), "utf8"),
  readFile(path.join(ROOT, "assets/runtime/cit-modules.css"), "utf8"),
]);

const html =
  `<!doctype html><html lang="hu"><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<style>:root{--cit-bg:#fff;--cit-ink:#16283f;--cit-muted:#6b7a8d;--cit-line:#dbe3ec;` +
  `--cit-accent:#0ea5b7;--cit-radius:14px}body{font-family:system-ui,sans-serif;margin:0;` +
  `padding:20px;background:#f4f7fa;color:var(--cit-ink)}` +
  `.cit-book__submit{font:inherit;font-weight:600;padding:13px 20px;border:0;border-radius:10px;` +
  `background:var(--cit-accent);color:#fff;cursor:pointer}</style>` +
  `<style>${modulesCss}</style></head><body>` +
  // ADR-0062 shape: the template slot is the slim jump-band; the FULL widget lives
  // in the closing "Foglalás" section (moduleSections renders it from d.booking).
  bookingSlot(data) +
  moduleSections(data) +
  `<script>${runtimeJs}</script></body></html>`;

const dir = await mkdtemp(path.join(tmpdir(), "bookform-"));
const file = path.join(dir, "form.html");
await writeFile(file, html, "utf8");

const browser = await chromium.launch({ executablePath: config.chromiumPath });
let failures = 0;
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

const page = await browser.newPage({ viewport: { width: 390, height: 900 }, isMobile: true });
// Stub the availability endpoint the runtime fetches on mount.
await page.route("**/api/foglaltsag/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ blocked: BLOCKED }) }),
);
await page.goto(pathToFileURL(file).href);
await page.waitForTimeout(400);

console.log("Vendég-oldali foglalási űrlap:");
check("az űrlap hidratálódott", await page.locator("form.cit-book--request").isVisible());
check("több egységnél van egység-választó", await page.locator("select[name=unit]").isVisible());
check("a név és e-mail mező kint van", await page.locator("#cit-name").isVisible());

// ── ADR-0062: dramaturgia — a sáv karcsú, a teljes űrlap a szekcióban ────────
check(
  "⭐ a sablon-sáv KARCSÚ ugró-CTA (nincs benne űrlap)",
  (await page.locator('#cit-enquiry form').count()) === 0 &&
    (await page.locator('#cit-enquiry a[href="#cit-booking"]').count()) === 1,
);
check("a teljes űrlap a #cit-booking szekcióban él", await page.locator("#cit-booking form.cit-book--request").isVisible());

// ── the VISIBLE availability calendar (owner decree 2026-08-23) ──────────────
// The guest must SEE the taken nights, not learn them from an error sentence.
check("⭐⭐ a naptár látszik", await page.locator(".cit-book__cal").isVisible());
const busyBtn = page.locator(`.cit-book__day--busy[data-day="${BLOCKED[0]}"]`);
check("⭐⭐ a foglalt éjszaka LÁTHATÓAN foglalt a naptárban", (await busyBtn.count()) === 1);
check("a foglalt nap nem kattintható", await busyBtn.isDisabled());
// Tapping two free days fills the date inputs (the calendar IS the picker).
await page.locator(`.cit-book__day[data-day="${iso(20)}"]`).click();
await page.locator(`.cit-book__day[data-day="${iso(23)}"]`).click();
check(
  "⭐ két szabad nap koppintása kitölti az érkezés/távozás mezőt",
  (await page.inputValue("#cit-from")) === iso(20) && (await page.inputValue("#cit-to")) === iso(23),
);
check(
  "a kijelölt sáv látszik a naptárban",
  (await page.locator(".cit-book__day--sel").count()) >= 2,
);
// Reset for the scripted scenarios below.
await page.fill("#cit-from", "");
await page.fill("#cit-to", "");

// A stay that collides with the taken nights must be refused, with a plain sentence.
await page.fill("#cit-from", iso(9));
await page.fill("#cit-to", iso(12));
await page.waitForTimeout(250);
const clash = (await page.locator(".cit-book__note").textContent()) ?? "";
check("⭐ a foglalt éjszakákat elutasítja", /foglalt/i.test(clash), clash.slice(0, 70));
check("⭐ ütközéskor a küldés le van tiltva", await page.locator(".cit-book__submit").isDisabled());

// Under the owner's minimum stay.
await page.fill("#cit-from", iso(20));
await page.fill("#cit-to", iso(21));
await page.waitForTimeout(250);
const short = (await page.locator(".cit-book__note").textContent()) ?? "";
check("a minimum éjszakát kikényszeríti", /Legalább 2/.test(short), short.slice(0, 70));

// A clean range re-enables sending.
await page.fill("#cit-from", iso(20));
await page.fill("#cit-to", iso(23));
await page.waitForTimeout(250);
check("szabad időszaknál újra küldhető", !(await page.locator(".cit-book__submit").isDisabled()));

await page.screenshot({ path: "shot-guest-booking-mobile.png", fullPage: true });

// Submitting: the form must be REPLACED by a confirmation, not left standing.
await page.route("**/api/foglalas", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, errors: [] }) }),
);
await page.fill("#cit-name", "Kovács Anna");
await page.fill("#cit-email", "anna@example.com");
await page.click(".cit-book__submit");
await page.waitForTimeout(400);
check("⭐ beküldés után visszaigazolás lép a helyére", await page.locator(".cit-book--done").isVisible());
check("a beküldött űrlap eltűnt (nincs dupla küldés)", (await page.locator("form.cit-book--request").count()) === 0);
await page.screenshot({ path: "shot-guest-booking-done.png" });
await page.close();

const desk = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await desk.route("**/api/foglaltsag/**", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ blocked: BLOCKED }) }),
);
await desk.goto(pathToFileURL(file).href);
await desk.waitForTimeout(400);
await desk.screenshot({ path: "shot-guest-booking-desktop.png", fullPage: true });
await desk.close();

await browser.close();
if (failures) {
  console.error(`\n⛔ shot-booking-form: ${failures} bukott ellenőrzés.`);
  process.exit(1);
}
console.log("\n✅ shot-booking-form: a vendég-oldali űrlap működik (mobil 390px).");
