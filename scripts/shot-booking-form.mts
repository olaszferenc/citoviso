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

// ⚠️ cit-money.js travels WITH the widget (generator/runtime.ts splices it in
// ahead of cit-runtime.js). This script builds its own page instead of going
// through injectRuntime, so it has to do the same — without it the quote line
// dies on an undefined CitMoney, and the check would report a layout defect for
// a missing dependency. money-format-check enforces the pairing.
const [moneyJs, runtimeJs, modulesCss] = await Promise.all([
  readFile(path.join(ROOT, "assets/runtime/cit-money.js"), "utf8"),
  readFile(path.join(ROOT, "assets/runtime/cit-runtime.js"), "utf8"),
  readFile(path.join(ROOT, "assets/runtime/cit-modules.css"), "utf8"),
]);

/**
 * RED SELF-TEST (`--sabotage=<id>`). A guard never seen red proves nothing — and
 * this one measured NOTHING for an unknown stretch: it was on no gate's list, and
 * when it did run it died mid-suite on a strict-mode locator clash. Each sabotage
 * reverts a behaviour the widget actually owns, and the named assertion must catch it.
 *
 * ⛔ EVERY SABOTAGE PROVES ITS OWN PATH. My first three did not: two replaced strings
 * that do not exist on this page (`cit-book__day--taken` — the real class is `--busy`;
 * `#cit-phone` — the id is written BY the runtime, so the page never contains the
 * selector form), so they were no-ops and the guard "passed" a break that never
 * happened. A sabotage that changes nothing is a green self-test for a dead guard.
 * `applySabotage` therefore asserts the page actually changed, and dies if it did not.
 *
 * ⛔ NOT A SABOTAGE: removing cit-money.js. Measured — this fixture carries NO prices,
 * so the widget's money path never runs here and the removal is undetectable. The
 * pairing in this file is defensive (money-format-check ④ owns that rule); claiming it
 * as a red self-test here would be a guard certifying something it cannot see.
 */
const SABOTAGE = (process.argv.find((a) => a.startsWith("--sabotage=")) ?? "").split("=")[1] ?? "";

/** id → [what to break, what to break it into, which assertion must go red]. */
const SABOTAGES: Record<string, { from: string; to: string; expect: string }> = {
  // cit-runtime.js:501 — the taken night stops LOOKING taken.
  "foglalt-nap-nem-latszik": {
    from: '" cit-book__day--busy"',
    to: '" cit-book__day--unmarked"',
    expect: "foglalt",
  },
  // cit-runtime.js:458 — the submit stays live over a collision.
  "utkozeskor-is-kuldheto": {
    from: "submit.disabled = !!p;",
    to: "submit.disabled = false;",
    expect: "ütközéskor",
  },
  // cit-runtime.js:582 — the phone requirement drops, so the owner cannot call back.
  "telefon-nem-kotelezo": {
    from: 'form.phone.value.replace(/\\D/g, "").length < 6',
    to: "false",
    expect: "telefon",
  },
};

function applySabotage(page: string): string {
  if (!SABOTAGE) return page;
  const sab = SABOTAGES[SABOTAGE];
  if (!sab) {
    console.error(`⛔ ismeretlen szabotázs: ${SABOTAGE} — ismertek: ${Object.keys(SABOTAGES).join(", ")}`);
    process.exit(2);
  }
  const out = page.split(sab.from).join(sab.to);
  // ⛔ The fixture proves its own path: no change means the sabotage never happened.
  if (out === page) {
    console.error(
      `⛔ A(z) „${SABOTAGE}" szabotázs NEM VÁLTOZTATOTT a lapon (a minta nincs benne: ${sab.from}).\n` +
        `   Egy no-op rontás zöld öntesztet adna egy halott őrre — ez a sor pont ezt tiltja.`,
    );
    process.exit(2);
  }
  console.log(`[szabotázs: ${SABOTAGE}] a lap ${page.length - out.length >= 0 ? "" : "+"}${Math.abs(page.length - out.length)} bájttal változott`);
  return out;
}

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
  `<script>${moneyJs}\n${runtimeJs}</script></body></html>`;

const dir = await mkdtemp(path.join(tmpdir(), "bookform-"));
const file = path.join(dir, "form.html");
await writeFile(file, applySabotage(html), "utf8");

const browser = await chromium.launch({ executablePath: config.chromiumPath });
let failures = 0;
let CHECKS_TOTAL = 0;
/** The NAMES that went red — the self-test asserts on these, not on a bare count. */
const red: string[] = [];
function check(name: string, cond: boolean, detail?: unknown): void {
  CHECKS_TOTAL++;
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    red.push(name);
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
// ⛔ A MÉRÉS NEM HALHAT MEG EGY KIVÉTELTŐL. Pontosan ez ölte meg ezt az őrt:
// egy strict-mode locator-ütközés a suite közepén dobott, és a maradék 12 állítás
// SOSEM futott le — a futás nem „piros" lett, hanem NEM LÉTEZŐ. Ugyanez jött elő
// az önteszt írásakor: a foglalt-nap rontása után egy későbbi locator elszállt.
// A kivétel mostantól EGY piros állítás, és a verdikt kiíródik.
try {
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
// Tapping two free days fills the date inputs (the calendar IS the picker). Pick
// from the VISIBLE free days: on a phone only the current month is on screen (the
// chevrons page through), so a fixed date could sit in the hidden second month.
const freeDays = page.locator(".cit-book__day:not(:disabled):visible");
await freeDays.nth(1).click();
await freeDays.nth(3).click();
const picked = {
  from: await page.inputValue("#cit-from"),
  to: await page.inputValue("#cit-to"),
};
check(
  "⭐ két szabad nap koppintása kitölti az érkezés/távozás mezőt",
  Boolean(picked.from) && Boolean(picked.to) && picked.to > picked.from,
  picked,
);
check(
  "telefonon EGY hónap látszik (a lapozó viszi a többit)",
  (await page.locator(".cit-book__month:visible").count()) === 1,
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
// ⛔ The legal sentence (ADR-0110 ⑤) is ALSO a `.cit-book__note`, so this locator
// started resolving to two elements and the whole run died mid-way — a measuring
// tool that throws measures nothing. `say()` writes into the FIRST note, so that is
// the one to read.
const clash = (await page.locator(".cit-book__note").first().textContent()) ?? "";
check("⭐ a foglalt éjszakákat elutasítja", /foglalt/i.test(clash), clash.slice(0, 70));
check("⭐ ütközéskor a küldés le van tiltva", await page.locator(".cit-book__submit").isDisabled());

// Under the owner's minimum stay.
await page.fill("#cit-from", iso(20));
await page.fill("#cit-to", iso(21));
await page.waitForTimeout(250);
const short = (await page.locator(".cit-book__note").first().textContent()) ?? "";
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
// Phone is REQUIRED (owner decree 2026-08-23) — sending without it must be refused,
// with a plain sentence, before anything leaves the page.
await page.click(".cit-book__submit");
await page.waitForTimeout(200);
check(
  "⭐⭐ telefon nélkül NEM küldhető (a szállásadónak vissza kell tudnia kérdezni)",
  /telefonszám/i.test((await page.locator(".cit-book__note").first().textContent()) ?? "") &&
    (await page.locator("form.cit-book--request").count()) === 1,
);
await page.fill("#cit-phone", "+36 30 111 2233");
await page.click(".cit-book__submit");
await page.waitForTimeout(400);
check("⭐ beküldés után visszaigazolás lép a helyére", await page.locator(".cit-book--done").isVisible());
check("a beküldött űrlap eltűnt (nincs dupla küldés)", (await page.locator("form.cit-book--request").count()) === 0);
await page.screenshot({ path: "shot-guest-booking-done.png" });
} catch (err) {
  check("a mérés végigfutott (nem dobott kivételt)", false, String(err).slice(0, 160));
}
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

if (SABOTAGE) {
  // Inverted verdict: the rontás MUST be caught. The driver (--self-test) also
  // checks WHICH names went red, so a sabotage that merely breaks the page wholesale
  // cannot pass for a targeted one.
  const want = SABOTAGES[SABOTAGE]!.expect;
  const hit = red.filter((r) => r.toLowerCase().includes(want.toLowerCase()));
  console.log(`\n[szabotázs: ${SABOTAGE}] pirosra ment ${red.length} állítás:`);
  for (const r of red) console.log(`   · ${r}`);
  if (!hit.length) {
    console.error(
      `⛔ ÖNTESZT: a(z) „${SABOTAGE}" rontást a „${want}"-állítás ÁTENGEDTE — az őr erre vak.`,
    );
    process.exit(1);
  }
  // ⛔ A sabotage that reddens EVERYTHING proves nothing about what is measured.
  if (red.length === CHECKS_TOTAL) {
    console.error(`⛔ ÖNTESZT: a rontás MINDEN állítást megölt — nem célzott, nem bizonyít.`);
    process.exit(1);
  }
  console.log(`✅ ÖNTESZT: elkapva a „${hit[0]}" állításon (${red.length}/${CHECKS_TOTAL} piros — célzott).`);
  process.exit(0);
}

if (failures) {
  // ⛔ MONDD KI, HA CSONKA. A try/catch fölött a kivétel nem öli meg a futást, de a
  // rá következő lépések KIMARADNAK — egy bukás így elrejthet továbbiakat (ADR-0146:
  // „egy bukott lépés kilencet blokkolt"). A szám ezért a jelentés része.
  const crashed = red.includes("a mérés végigfutott (nem dobott kivételt)");
  console.error(
    `\n⛔ shot-booking-form: ${failures} bukott ellenőrzés ${CHECKS_TOTAL} lefutottból.` +
      (crashed ? ` ⚠️ A futás KIVÉTELLEL szakadt meg, a hátralévő lépések NEM futottak le.` : ""),
  );
  process.exit(1);
}
console.log("\n✅ shot-booking-form: a vendég-oldali űrlap működik (mobil 390px).");
