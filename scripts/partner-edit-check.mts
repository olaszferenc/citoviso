// PARTNER EDIT — end-to-end check of the partner sheet's „Adatok és kapcsolattartók” editor
// (approved plan assets/design-refs/console/partner-adatlap/, A — Fülek; owner 2026-11-03:
// „partnert nem is tudom szerkeszteni, pl. kapcsolat”).
//
// Boots THIS tree's console in-process on an ephemeral port (the ui-shot pattern), creates a
// throw-away partner in the dev DB, and drives the real form in a browser at 390 and 1280 px:
//   · a bad tax number / phone is refused on the client AND (JS off) by the server, with the
//     reason on the field, and nothing is written;
//   · a valid edit is saved: normalised tax number + E.164 phone in the DB, „Mentve hh:mm”;
//   · contacts: add, edit, delete, one primary per role, the company e-mail change moves the
//     primary billing recipient along (the „számla-címzett is” checkbox);
//   · the Figyelendő „Átveszem a partnerre” prefill reaches the form, nothing written before Mentés.
// The throw-away partner is deleted at the end, whatever happened.
//
//   npx tsx scripts/partner-edit-check.mts

process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";

import { once } from "node:events";
import type { Server } from "node:http";
import { chromium, type Page } from "playwright-core";

const { server } = (await import("../src/console/server.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const port = (server.address() as { port: number }).port;
const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
const { db } = await import("../src/db/client.js");
// Any operator works: the audit column is asserted against THIS operator's own id below.
// gate-subject-allow: any operator only mints the session; the audit check compares to its own id
const op = await db.selectFrom("operator_user").select("id").orderBy("created_at").limit(1).executeTakeFirst();
if (!op) throw new Error("nincs operator_user a dev DB-ben");

let fails = 0;
const ok = (c: boolean, m: string, extra = "") => {
  console.log(`  ${c ? "ok  " : "🔴  "} ${m}${extra ? ` (${extra})` : ""}`);
  if (!c) fails++;
};

const TAG = `[TESZT partner-edit-check ${Date.now()}]`;
const partner = await db
  .insertInto("partner")
  .values({ name: TAG, is_customer: true, country: "HU", zip: "1188", city: "Budapest", address: "Teszt utca 1", email: "elso@example.hu" })
  .returning("id")
  .executeTakeFirstOrThrow();
await db.insertInto("partner_contact").values({ partner_id: partner.id, kind: "billing", email: "elso@example.hu", is_primary: true }).execute();

const base = `http://localhost:${port}/partner/${partner.id}`;
const browser = await chromium.launch();
try {
  for (const [w, label] of [
    [1280, "asztali"],
    [390, "mobil-390"],
  ] as const) {
    console.log(`\n① ${label}`);
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addCookies([{ name: "cit_op_session", value: mintOperatorCookieValue(op.id), url: `http://localhost:${port}` }]);
    const page: Page = await ctx.newPage();
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    page.on("dialog", (d) => d.accept());

    await page.goto(`${base}?tab=data`);
    ok(await page.locator("dl.pa-kv").first().isVisible(), "nézet: a számlázási adatok látszanak");
    await page.locator("[data-edit-inline]").click();
    const form = page.locator("form[data-editor]");
    ok(await form.isVisible(), "Szerkesztés → az űrlap megnyílik");

    // Client refusal.
    await form.locator("[name=tax_number]").fill("12345678-2-41");
    await form.locator("[name=phone]").fill("06 30 12");
    await form.locator("[data-save]").click();
    ok((await form.locator("[data-err=tax]").textContent())!.includes("8 jegye"), "hibás adószám → ellenőrzőszám-hiba a mezőnél");
    ok((await form.locator("[data-err=phone]").textContent())!.length > 0, "hibás telefon → hiba a mezőnél");
    ok(page.url().includes("tab=data") && !page.url().includes("saved="), "kliens-hiba: nincs elküldés");

    // Valid edit + contacts.
    await form.locator("[name=tax_number]").fill("13421739243");
    await form.locator("[name=tax_number]").blur();
    ok((await form.locator("[name=tax_number]").inputValue()) === "13421739-2-43", "adószám formázva (8-1-2)");
    await form.locator("[name=phone]").fill("06305783126");
    await form.locator("[name=phone]").blur();
    ok((await form.locator("[name=phone]").inputValue()) === "+36 30 578 3126", "telefon normalizálva");
    await form.locator("[name=email]").fill("szamla@example.hu");
    ok(await form.locator("[data-sync]").isVisible(), "céges e-mail csere → rákérdez a számla-címzettre");
    await form.locator("[data-add-contact]").click();
    const last = form.locator("[data-crow]").last();
    await last.locator("select").selectOption("technical");
    await last.locator("input[name$=_name]").fill("Kovács Béla");
    await last.locator("input[name$=_email]").fill("rossz");
    await form.locator("[data-save]").click();
    ok((await last.locator("[data-cerr]").textContent()) === "Hibás e-mail.", "új kapcsolattartó e-mailje validálva");
    await last.locator("input[name$=_email]").fill("bela@example.hu");
    await last.locator("input[type=checkbox]").check();
    await Promise.all([page.waitForURL(/saved=/), form.locator("[data-save]").click()]);
    ok((await page.locator(".pa-state.is-ok").textContent())!.includes("Mentve"), "mentés → „Mentve hh:mm”");
    const row = await db.selectFrom("partner").select(["tax_number", "phone", "email", "updated_by"]).where("id", "=", partner.id).executeTakeFirstOrThrow();
    ok(row.tax_number === "13421739-2-43" && row.phone === "+36305783126" && row.email === "szamla@example.hu", "DB: adószám, E.164 telefon, e-mail", JSON.stringify(row));
    ok(row.updated_by === op.id, "DB: updated_by = az operátor");
    const cs = await db.selectFrom("partner_contact").select(["kind", "email", "is_primary", "name"]).where("partner_id", "=", partner.id).orderBy("kind").execute();
    ok(cs.some((c) => c.kind === "billing" && c.is_primary && c.email === "szamla@example.hu"), "DB: a számla-címzett az új e-mailre költözött");
    ok(cs.some((c) => c.kind === "technical" && c.is_primary && c.name === "Kovács Béla"), "DB: új műszaki kapcsolattartó, elsődleges");
    ok((await page.locator("body").innerText()).includes("bela@example.hu"), "nézet: az új kapcsolattartó látszik");

    // Delete the technical contact again.
    await page.locator("[data-edit-inline]").click();
    await page.locator("form[data-editor] [data-crow]").last().locator("[data-del]").click();
    await Promise.all([page.waitForURL(/saved=/), page.locator("form[data-editor] [data-save]").click()]);
    const after = await db.selectFrom("partner_contact").select("kind").where("partner_id", "=", partner.id).execute();
    ok(after.length === 1 && after[0]!.kind === "billing", "törlés → a kapcsolattartó eltűnt", String(after.length));

    // Server is the authority: JS off, bad tax → 422 with the reason, nothing written.
    const ctxNoJs = await browser.newContext({ viewport: { width: w, height: 900 }, javaScriptEnabled: false });
    await ctxNoJs.addCookies([{ name: "cit_op_session", value: mintOperatorCookieValue(op.id), url: `http://localhost:${port}` }]);
    const p2 = await ctxNoJs.newPage();
    await p2.goto(`${base}?tab=data&edit=1`);
    await p2.locator("[name=tax_number]").fill("12345678-2-41");
    // Enter = implicit submission (on 390 px the bottom bar can sit over the button).
    const [resp] = await Promise.all([p2.waitForNavigation(), p2.locator("[name=tax_number]").press("Enter")]);
    ok(resp?.status() === 422, "szerver: hibás adószám → 422", String(resp?.status()));
    ok((await p2.locator("[data-err=tax]").textContent())!.includes("8 jegye"), "szerver: az ok a mező alatt");
    const still = await db.selectFrom("partner").select("tax_number").where("id", "=", partner.id).executeTakeFirstOrThrow();
    ok(still.tax_number === "13421739-2-43", "szerver-hiba: semmi nem íródott");
    await ctxNoJs.close();

    // Figyelendő prefill: lands in the form, not in the DB.
    await page.goto(`${base}?tab=data&edit=1&phone=%2B36201234567`);
    ok((await page.locator("form[data-editor] [name=phone]").inputValue()) === "+36 20 123 4567", "átvétel: a szám az űrlapban, formázva");
    const notYet = await db.selectFrom("partner").select("phone").where("id", "=", partner.id).executeTakeFirstOrThrow();
    ok(notYet.phone === "+36305783126", "átvétel: mentés nélkül nem íródik");

    ok(errs.length === 0, "JS-hiba = 0", errs.join(" | "));
    // Reset for the next viewport.
    await db.updateTable("partner").set({ tax_number: null, phone: null, email: "elso@example.hu" }).where("id", "=", partner.id).execute();
    await db.updateTable("partner_contact").set({ email: "elso@example.hu" }).where("partner_id", "=", partner.id).execute();
    await ctx.close();
  }
} finally {
  await browser.close();
  await db.deleteFrom("partner").where("id", "=", partner.id).execute();
  server.close();
  await db.destroy();
}
console.log(fails ? `\npartner-edit-check: 🔴 ${fails} hiba` : "\n✅ partner-edit-check: a partner szerkeszthető, a hibát a kliens és a szerver is megfogja.");
process.exit(fails ? 1 : 0);
