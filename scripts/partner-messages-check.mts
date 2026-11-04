// PARTNER MESSAGES — end-to-end check of the partner sheet's „Üzenetváltások” tab (approved
// plan assets/design-refs/console/partner-adatlap/JOVAHAGYOTT-M1-uzenetvaltasok.html, ADR-0421).
//
// Boots THIS tree's console in-process on an ephemeral port with the MOCK e-mail sender and the
// SMS QUEUE (the dev queue is never drained — the relay pulls from production), builds a
// throw-away lead → tenant → partner with a real-shaped history (cold MMS + SMS, the lead's
// reply, a system mail), and drives the real tab in a browser at 390 and 1280 px:
//   · the thread shows every source in time order, ours right, theirs left;
//   · the composer: channel switch (subject only for e-mail), SMS counter GSM-7 / UCS-2,
//     „Ékezet nélkül”, the 5-part limit, empty / missing-subject refusals;
//   · an e-mail send appears at once as „elküldve” and lands in partner_message + tenant_message;
//   · an SMS send appears as „sorban”, and follows the sms_outbox row to „elküldve”;
//   · JS off: the plain POST works and redirects back with the outcome;
//   · inbound: a mail from a contact's address (not an outreach reply) joins the thread;
//   · the rejecter mark (Válaszok panel route) blocks the composer, AND the server refuses;
//   · JS errors = 0.
// Everything it created is deleted at the end, whatever happened.
//
//   npx tsx scripts/partner-messages-check.mts

process.env.CIT_SHOT = "1";
process.env.CONSOLE_PORT = "0";
// ⛔ Nothing may leave this machine: the mock e-mail sender writes outbox/, the SMS queue's
// dev rows are never pulled (asserted below before anything is sent).
process.env.EMAIL_PROVIDER = "mock";
process.env.SMS_PROVIDER = "queue";

import { once } from "node:events";
import type { Server } from "node:http";
import { chromium, type Page } from "playwright-core";

const { config } = await import("../src/config.js");
if (config.smsProvider !== "queue" || process.env.EMAIL_PROVIDER !== "mock") throw new Error("a küldők nem teszt-módban vannak — leállok");
const { server } = (await import("../src/console/server.js")) as { server: Server };
if (!server.listening) await once(server, "listening");
const port = (server.address() as { port: number }).port;
const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
const { db } = await import("../src/db/client.js");
const { ingestReplies } = await import("../src/replies/store.js");
const { settlePartnerMessages } = await import("../src/console/partnerMessages.js");
// gate-subject-allow: any operator only mints the session; the sends are asserted by row, not by who
const op = await db.selectFrom("operator_user").select("id").orderBy("created_at").limit(1).executeTakeFirst();
if (!op) throw new Error("nincs operator_user a dev DB-ben");

let fails = 0;
const ok = (c: boolean, m: string, extra = "") => {
  console.log(`  ${c ? "ok  " : "🔴  "} ${m}${extra ? ` (${extra})` : ""}`);
  if (!c) fails++;
};

// ── fixture ──────────────────────────────────────────────────────────────────
const TAG = `[TESZT partner-messages-check ${Date.now()}]`;
const PHONE = "+36301112233";
const MAIL = "uzenet-teszt@example.hu";
const DAY = 86_400_000;
const t0 = new Date(Date.now() - 3 * DAY);
const def = await db
  .insertInto("scraper_definition")
  .values({ label: TAG, country: "HU", region: "Teszt", industry: "lodging" })
  .returning("id")
  .executeTakeFirstOrThrow();
const run = await db.insertInto("scrape_run").values({ scraper_definition_id: def.id, status: "completed" }).returning("id").executeTakeFirstOrThrow();
const lead = await db
  .insertInto("lead")
  .values({ scrape_run_id: run.id, name: TAG, raw: JSON.stringify({ phone: "06 30 111 2233" }) as never })
  .returning("id")
  .executeTakeFirstOrThrow();
const prospect = await db
  .insertInto("prospect")
  .values({ lead_id: lead.id, token: `pmc${Date.now()}`, status: "sent", sent_at: t0, mms_sent_at: t0, sms_sent_at: t0 } as never)
  .returning("id")
  .executeTakeFirstOrThrow();
await db
  .insertInto("mms_outbox")
  .values({ prospect_id: prospect.id, to_phone: PHONE, subject: "Citoviso latvanyterv - Teszt", image: Buffer.alloc(45_000), status: "sent", sent_at: t0 } as never)
  .execute();
const coldSms = await db
  .insertInto("sms_outbox")
  .values({ to_phone: PHONE, body: "Teszt - az iment kuldott terv melle... A Citoviso csapata", status: "sent", created_at: t0, sent_at: new Date(t0.getTime() + 60_000) } as never)
  .returning("id")
  .executeTakeFirstOrThrow();
await db
  .insertInto("outreach_reply")
  .values({
    source_key: `sms:pmc-${Date.now()}`,
    channel: "sms",
    lead_id: lead.id,
    prospect_id: prospect.id,
    sender: PHONE,
    received_at: new Date(t0.getTime() + 20 * 60_000),
    body: "jo reggelt! megneztem koszonom, visszahiv ha lesz ideje?",
  } as never)
  .execute();
const tenant = await db
  .insertInto("tenant")
  .values({ lead_id: lead.id, display_name: TAG, created_at: new Date(t0.getTime() + DAY) } as never)
  .returning("id")
  .executeTakeFirstOrThrow();
await db
  .insertInto("tenant_message")
  .values({ tenant_id: tenant.id, channel: "email", kind: "invoice", subject: "Számla TESZT-1 – Honlap-előfizetés (havi)", body_text: "Kedves Teszt!\n\nA számlát mellékeljük.", recipient: MAIL, attachment_name: "TESZT-1.pdf", sent_at: new Date(t0.getTime() + DAY + 60_000) } as never)
  .execute();
const partner = await db
  .insertInto("partner")
  .values({ name: TAG, is_customer: true, country: "HU", email: MAIL, tenant_id: tenant.id })
  .returning("id")
  .executeTakeFirstOrThrow();
await db.insertInto("partner_contact").values({ partner_id: partner.id, kind: "billing", name: "Teszt Rebeka", email: MAIL, is_primary: true }).execute();
await db.insertInto("partner_contact").values({ partner_id: partner.id, kind: "technical", name: "Teszt Béla", email: "bela-teszt@example.hu", phone: "+36301112244", is_primary: true }).execute();

const base = `http://localhost:${port}/partner/${partner.id}`;
const browser = await chromium.launch();
const pmRows = () => db.selectFrom("partner_message").selectAll().where("partner_id", "=", partner.id).orderBy("created_at").execute();
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

    await page.goto(`${base}?tab=messages`);
    // PMC_SHOTS=<dir>: the tab as built, for comparison with the approved M1 images.
    const shots = process.env.PMC_SHOTS;
    if (shots) await page.screenshot({ path: `${shots}/M1-kod-${label}.png`, fullPage: true });
    const tab = page.locator("nav.pa-tabs a[aria-current=page]");
    ok((await tab.textContent())!.includes("Üzenetváltások"), "a fül létezik és aktív");
    const keys = await page.locator("[data-mx-key]").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.mxKey!.slice(0, 2)));
    ok(keys.slice(0, 4).join(",") === "mm,so,or,tm", "a szál időrendben: MMS, SMS, válasz, rendszerlevél", keys.join(","));
    ok(await page.locator(".mx-msg--in").first().isVisible(), "a partner üzenete balra (in)");
    ok(await page.locator(".mx-msg--sys details").isVisible(), "rendszerlevél: lenyitható kártya");
    ok((await page.locator(`[data-mx-key="so:${coldSms.id}"]`).count()) === 1, "a hideg SMS a szálban (sms_outbox, a tenant előtt)");

    const form = page.locator("form[data-mx-comp]");
    // e-mail: subject required
    await form.locator("textarea[name=body]").fill("Kedves Rebeka! Teszt üzenet.");
    await form.locator("[data-mx-send]").click();
    ok((await form.locator("[data-mx-err=subject]").textContent()) === "A levélnek tárgy kell.", "e-mail tárgy nélkül → a kliens nem küldi");
    await form.locator("input[name=subject]").fill("Teszt tárgy");
    await form.locator("[data-mx-send]").click();
    await page.locator(".mx-state.is-ok").waitFor({ timeout: 10_000 });
    let rows = await pmRows();
    const em = rows.find((r) => r.channel === "email");
    ok(em?.status === "sent" && em.address === MAIL && em.subject === "Teszt tárgy", "DB: a levél elküldve (partner_message)", em?.status);
    ok(Boolean(em?.tenant_message_id), "DB: a tenant saját üzenetei közé is bekerült");
    ok(await page.locator(`[data-mx-key="pm:${em?.id}"] .mx-chip--sent`).isVisible(), "a levél azonnal megjelenik a szálban, „elküldve”");
    ok((await form.locator("textarea[name=body]").inputValue()) === "", "küldés után az űrlap kiürül");

    // SMS: counter, accents → UCS-2, fold, limit
    await form.locator(".mx-seg__o", { hasText: "SMS" }).click();
    ok(await form.locator("[data-mx-subj]").isHidden(), "SMS: a tárgy-mező eltűnik");
    ok((await form.locator("[data-mx-to]").inputValue()).startsWith("+36"), "SMS: a címzett telefonszám", await form.locator("[data-mx-to]").inputValue());
    await form.locator("textarea[name=body]").fill("Jó napot, holnap hívjuk!");
    const cnt = (await form.locator("[data-mx-count]").textContent())!;
    ok(cnt.includes("UCS-2") && cnt.includes("1 SMS-rész"), "ékezet → UCS-2 számláló", cnt);
    if (shots) await form.screenshot({ path: `${shots}/M1-kod-${label}-sms-iras.png` });
    await form.locator("[data-mx-gsm]").click();
    ok((await form.locator("textarea[name=body]").inputValue()) === "Jo napot, holnap hivjuk!", "„Ékezet nélkül” → GSM-7");
    ok((await form.locator("[data-mx-count]").textContent())!.includes("GSM-7"), "a számláló GSM-7-re vált");
    await form.locator("textarea[name=body]").fill("ő".repeat(400));
    await form.locator("[data-mx-send]").click();
    ok((await form.locator("[data-mx-err=body]").textContent())!.includes("5 SMS-résznél"), "5 résznél hosszabb → a kliens nem küldi");
    await form.locator("textarea[name=body]").fill("Jo napot, holnap hivjuk!");
    await form.locator("[data-mx-send]").click();
    await page.locator(".mx-state.is-ok").waitFor({ timeout: 10_000 });
    rows = await pmRows();
    const sm = rows.filter((r) => r.channel === "sms").at(-1);
    const quiet = (() => {
      const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Budapest", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
      return h >= 22 || h < 7;
    })();
    if (quiet) {
      ok(sm?.status === "scheduled" && Boolean(sm.scheduled_for), "csendes óra: az SMS reggel 7-re ütemezve", sm?.status);
    } else {
      ok(sm?.status === "queued" && Boolean(sm.sms_outbox_id), "DB: az SMS a sorban (sms_outbox)", sm?.status);
      ok(sm?.body.endsWith("\nA Citoviso csapata") === true, "az aláírás a szöveg végén");
      ok(await page.locator(`[data-mx-key="pm:${sm?.id}"] .mx-chip--queued`).isVisible(), "a szálban „sorban”");
      // the relay acks → settle → the bubble follows
      await db.updateTable("sms_outbox").set({ status: "sent", sent_at: new Date() }).where("id", "=", sm!.sms_outbox_id!).execute();
      await settlePartnerMessages();
      await page.locator(`[data-mx-key="pm:${sm?.id}"] .mx-chip--sent`).waitFor({ timeout: 10_000 });
      ok(true, "a modem nyugtája után a szálban „elküldve” (oldal-újratöltés nélkül)");
    }

    // JS off: plain POST + redirect
    const ctxNoJs = await browser.newContext({ viewport: { width: w, height: 900 }, javaScriptEnabled: false });
    await ctxNoJs.addCookies([{ name: "cit_op_session", value: mintOperatorCookieValue(op.id), url: `http://localhost:${port}` }]);
    const p2 = await ctxNoJs.newPage();
    await p2.goto(`${base}?tab=messages`);
    await p2.locator("input[name=subject]").fill("JS nélkül");
    await p2.locator("textarea[name=body]").fill("JS nélküli teszt.");
    const [resp] = await Promise.all([p2.waitForNavigation(), p2.locator("input[name=subject]").press("Enter")]);
    ok(resp?.status() === 200 && p2.url().includes("sent="), "JS nélkül: küldés → vissza a fülre", p2.url());
    ok((await p2.locator(".mx-state.is-ok").textContent()) === "Elküldve.", "JS nélkül: „Elküldve.”");
    await p2.goto(`${base}?tab=messages`);
    await p2.locator("textarea[name=body]").fill("tárgy nélkül");
    const [r422] = await Promise.all([p2.waitForNavigation(), p2.locator("input[name=subject]").press("Enter")]);
    ok(r422?.status() === 422 && (await p2.locator("[data-mx-err=subject]").textContent()) === "A levélnek tárgy kell.", "szerver: tárgy nélkül 422, ok a mezőnél");
    await ctxNoJs.close();

    // filters
    await page.goto(`${base}?tab=messages&f=sys`);
    ok((await page.locator("[data-mx-key]").count()) === 1, "szűrő „Rendszerlevél” → csak a rendszerlevél");
    await page.goto(`${base}?tab=messages&f=mine`);
    ok((await page.locator("[data-mx-key^='pm:']").count()) === (await page.locator("[data-mx-key]").count()), "szűrő „Kézi” → csak a kézi üzenetek");

    ok(errs.length === 0, "JS-hiba = 0", errs.join(" | "));
    await ctx.close();
  }

  console.log("\n② bejövő levél a kapcsolattartó címéről");
  const key = `email:<pmc-${Date.now()}@example.hu>`;
  const r = await ingestReplies([{ key, channel: "email", from: "Teszt Béla <Bela-Teszt@example.hu>", subject: "Re: Teszt tárgy", text: "Köszönöm, megkaptam.", receivedAt: new Date().toISOString() } as never]);
  ok(r.accepted.includes(key), "a gyűjtő nem dobja el (accepted)");
  const inb = (await pmRows()).find((x) => x.direction === "in");
  ok(inb?.address === "bela-teszt@example.hu" && inb.status === "received", "DB: bejövő a partner szálában", inb?.address);

  console.log("\n③ elutasító-jel");
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "cit_op_session", value: mintOperatorCookieValue(op.id), url: `http://localhost:${port}` }]);
  const page = await ctx.newPage();
  const reply = await db.selectFrom("outreach_reply").select("id").where("lead_id", "=", lead.id).executeTakeFirstOrThrow();
  const resB = await page.request.post(`http://localhost:${port}/replies/${reply.id}/block`, { form: { reason: "nem kéri (teszt)" }, maxRedirects: 0 });
  ok(resB.status() === 302 || resB.status() === 303, "POST /replies/:id/block → átirányít", String(resB.status()));
  const l = await db.selectFrom("lead").select(["contact_block_at", "contact_block_reason"]).where("id", "=", lead.id).executeTakeFirstOrThrow();
  ok(Boolean(l.contact_block_at) && l.contact_block_reason === "nem kéri (teszt)", "DB: a lead tiltó jelet kapott, indokkal");
  const pr = await db.selectFrom("prospect").select("unsubscribed_at").where("id", "=", prospect.id).executeTakeFirstOrThrow();
  ok(Boolean(pr.unsubscribed_at), "DB: a megkeresésekről is leiratkoztatva");
  await page.goto(`${base}?tab=messages`);
  ok(await page.locator(".mx-guard").isVisible(), "a fülön az őr: „nem küldhető üzenet”, az okkal");
  ok((await page.locator("form[data-mx-comp] fieldset").getAttribute("disabled")) !== null && (await page.locator("[data-mx-send]").isDisabled()), "az írás-doboz letiltva");
  const forced = await page.request.post(`${base}/message`, {
    form: { channel: "email", to: MAIL, subject: "x", body: "y" },
    headers: { accept: "application/json" },
  });
  ok(forced.status() === 422, "szerver: kézi küldés tiltva (422)", String(forced.status()));
  const nSent = (await pmRows()).filter((x) => x.direction === "out").length;
  const { sendAnswer } = await import("../src/replies/answer.js");
  const ans = await sendAnswer(reply.id, { text: "szia" }, "teszt");
  ok(!ans.ok && ans.message.includes("Elutasító"), "a válaszra adott válasz is tiltva", ans.message);
  ok((await pmRows()).filter((x) => x.direction === "out").length === nSent, "semmi nem íródott a tiltás után");
  await page.goto(`http://localhost:${port}/?reply=${reply.id}&replies=all#replies`);
  ok((await page.locator(".con-rep__block.is-on").count()) >= 1, "a Válaszok panelen a jelölés látszik");
  await ctx.close();
} finally {
  await browser.close();
  const outIds = (await db.selectFrom("partner_message").select("sms_outbox_id").where("partner_id", "=", partner.id).execute())
    .map((x) => x.sms_outbox_id)
    .filter((x): x is string => Boolean(x));
  await db.deleteFrom("partner").where("id", "=", partner.id).execute();
  if (outIds.length) await db.deleteFrom("sms_outbox").where("id", "in", outIds).execute();
  await db.deleteFrom("sms_outbox").where("id", "=", coldSms.id).execute();
  await db.deleteFrom("tenant").where("id", "=", tenant.id).execute();
  await db.deleteFrom("lead").where("id", "=", lead.id).execute();
  await db.deleteFrom("scrape_run").where("id", "=", run.id).execute();
  await db.deleteFrom("scraper_definition").where("id", "=", def.id).execute();
  server.close();
  await db.destroy();
}
console.log(fails ? `\npartner-messages-check: 🔴 ${fails} hiba` : "\n✅ partner-messages-check: a szál összeáll, az írás működik, az elutasító-őr tilt.");
process.exit(fails ? 1 : 0);
