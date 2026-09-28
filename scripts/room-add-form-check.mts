// Guard: adding a room can never fail SILENTLY (approved plan design-refs/tenant-admin/room-add-B,
// owner ruling 2026-09-28).
//
// Measured on the phone night-run (FK-013): with one room already there, the REQUIRED
// "Az egész szállást is kiadja egyben?" answer stood ABOVE the fields, off-screen at 390 px;
// „Hozzáadás" then did nothing visible (the browser's validation jumped to a field the owner
// could not see). And the page had two look-alike forms, so the first attempt typed the new
// room into the EXISTING one.
//
// Measured in a real touch browser, phone AND desktop, on the rooms screen of a one-room
// tenant (and on its booking screen, which renders the same form):
//  ① on open only ONE name field is visible — the add form is collapsed („Új szoba felvétele”),
//     and the existing row is labelled („Meglévő szobája”);
//  ② opened, the whole-place question sits BETWEEN the fields and the button (above the button);
//  ③ „Hozzáadás” without the answer: NO save request leaves, and a message under the button
//     says what is missing — on screen, not below the fold; the question is marked;
//  ④ picking an answer clears the message.
// ⛔ Never submits a valid form: the dev DB is shared, so the guard measures the refusal path
//    only and asserts that not a single POST /admin/units/save went out.
// Run: npx tsx scripts/room-add-form-check.mts [--self-test]
//   --self-test re-imposes the pre-fix screen (question above the fields, no message) → must go RED.

process.env.PUBLIC_PORT = "0";
process.env.CIT_SHOT = "1";

import { once } from "node:events";
import { chromium, type Browser } from "playwright-core";

const SELF_TEST = process.argv.includes("--self-test");
const { server } = await import("../src/server/public.js");
const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
const { db } = await import("../src/db/client.js");
const { PLATFORM_DOMAIN } = await import("../src/domains.js");

let failed = 0;
const ok = (c: boolean, m: string, d = ""): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${m}${d && !c ? `\n     ↳ ${d}` : ""}`);
  if (!c) failed++;
};
if (!server.listening) await once(server, "listening");
const PORT = (server.address() as { port: number }).port;

// Named subject (ADR-0252): a tenant with a login, a site with EXACTLY one room, and the rooms
// module on — the only state in which the whole-place question is asked.
const rows = await db
  .selectFrom("tenant_user as tu")
  .innerJoin("site as s", "s.tenant_id", "tu.tenant_id")
  .innerJoin("site_unit as u", "u.site_id", "s.id")
  .innerJoin("module_entitlement as e", "e.tenant_id", "tu.tenant_id")
  .select(["tu.id as userId", "tu.tenant_id as tenantId", "s.slug as slug", (eb) => eb.fn.count<string>("u.id").distinct().as("n")])
  .where("e.module", "=", "rooms")
  .where("e.active", "=", true)
  .groupBy(["tu.id", "tu.tenant_id", "s.slug"])
  .orderBy("s.slug")
  .execute();
const subject = rows.find((r) => Number(r.n) === 1);
if (!subject) {
  console.error("⛔ ELŐFELTÉTEL: nincs egy-szobás, Szobák modullal bíró bérlő a dev DB-ben — a mérés ÜRES volna.");
  server.close();
  await db.destroy();
  process.exit(1);
}
const booking = await db
  .selectFrom("module_entitlement")
  .select("module")
  .where("tenant_id", "=", subject.tenantId)
  .where("module", "=", "booking")
  .where("active", "=", true)
  .executeTakeFirst();
const screens = ["/admin?tab=modulok&m=rooms", ...(booking ? ["/admin?tab=modulok&m=booking"] : [])];
console.log(`alany: ${subject.slug} (1 szoba) · ${screens.join(" · ")}`);

const browser: Browser = await chromium.launch({ args: [`--host-resolver-rules=MAP ${PLATFORM_DOMAIN} 127.0.0.1`] });
try {
  for (const vp of [
    { label: "telefon 390", width: 390, height: 844, mobile: true },
    { label: "asztali 1280", width: 1280, height: 900, mobile: false },
  ]) {
    for (const path of screens) {
      console.log(`\n── ${vp.label} · ${path}`);
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile });
      await ctx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(subject.userId), domain: PLATFORM_DOMAIN, path: "/" }]);
      const page = await ctx.newPage();
      await page.addInitScript("window.__name = (f) => f;");
      const errs: string[] = [];
      page.on("pageerror", (e) => errs.push(String(e)));
      let saves = 0;
      page.on("request", (r) => {
        if (r.method() === "POST" && r.url().includes("/admin/units/save")) saves++;
      });
      await page.goto(`http://${PLATFORM_DOMAIN}:${PORT}${path}`, { waitUntil: "load" });
      await page.evaluate("document.documentElement.style.scrollBehavior='auto'");

      const visibleNames = await page.locator("input[name=name]:visible").count();
      ok(visibleNames === 1, `① nyitáskor EGY név-mező látszik (az új szoba űrlapja csukva)`, `látható: ${visibleNames}`);
      ok((await page.locator(".unit-sec").count()) === 1, `① a meglévő szoba sora felirattal áll („Meglévő szobája”)`);
      const summary = page.locator("details.unit-more > summary");
      ok((await summary.count()) === 1 && /Új szoba felvétele/.test((await summary.textContent()) ?? ""), `① a csukott sáv felirata „Új szoba felvétele”`);

      await summary.click();
      if (SELF_TEST) {
        // The pre-fix screen, re-imposed: the question ABOVE the fields, and no message.
        await page.evaluate(`(() => { const f = document.querySelector("form[data-cit-new-unit]");
          f.insertBefore(f.querySelector("[data-cit-whole-q]"), f.firstChild);
          f.querySelector("[data-cit-whole-err]")?.remove(); })()`);
      }
      const form = page.locator("form[data-cit-new-unit]");
      const q = form.locator("[data-cit-whole-q]");
      const btn = form.locator("button[type=submit]");
      const geo = await page.evaluate(`(() => { const f = document.querySelector("form[data-cit-new-unit]");
        const q = f.querySelector("[data-cit-whole-q]").getBoundingClientRect();
        const b = f.querySelector("button[type=submit]").getBoundingClientRect();
        const n = f.querySelector("input[name=name]").getBoundingClientRect();
        return { qTop: q.top, qBottom: q.bottom, bTop: b.top, nBottom: n.bottom }; })()`) as { qTop: number; qBottom: number; bTop: number; nBottom: number };
      ok(geo.qTop >= geo.nBottom && geo.qBottom <= geo.bTop + 1, `② a kérdés a mezők UTÁN, a gomb FÖLÖTT áll`, JSON.stringify(geo));

      await form.locator("input[name=name]").fill("Próba szoba (őr — nem ment)");
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(400);
      const err = form.locator("[data-cit-whole-err]");
      const st = await page.evaluate(`(() => { const e = document.querySelector("form[data-cit-new-unit] [data-cit-whole-err]");
        const r = e ? e.getBoundingClientRect() : null;
        // "On screen" = inside the viewport AND not under a fixed layer (consent bar, bottom bar).
        const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null;
        return { shown: !!e && !e.hidden && r.height > 0,
          inView: !!r && r.top >= 0 && r.bottom <= innerHeight && !!hit && e.contains(hit),
          marked: document.querySelector("form[data-cit-new-unit] [data-cit-whole-q]").classList.contains("is-missing") }; })()`) as { shown: boolean; inView: boolean; marked: boolean };
      ok(saves === 0, `③ döntés nélkül NEM megy ki mentés`, `POST: ${saves}`);
      ok(st.shown, `③ a gomb alatt megjelenik, mi hiányzik`, st.shown ? "" : "nincs üzenet");
      ok(st.inView, `③ az üzenet a képernyőn van, és semmi nem takarja (süti-sáv, fül-sáv)`);
      ok(st.marked, `③ a kérdés meg van jelölve`);

      await q.locator("input[value=nem]").check();
      ok((await err.count()) > 0 && !(await err.isVisible()), `④ választás után az üzenet eltűnik`);
      ok(saves === 0, `a mérés egyetlen mentést sem küldött`);
      ok(errs.length === 0, `JS-hiba 0`, errs.join(" | "));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  server.close();
  await db.destroy();
}

if (failed) {
  console.error(`\n⛔ room-add-form-check: ${failed} bukás`);
  process.exit(1);
}
console.log("\n✅ room-add-form-check: a szoba-felvétel nem bukhat némán (telefon + asztal).");
