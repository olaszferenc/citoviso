// NEMZETKÖZI — HR VÉGPRÓBA (2026-11-22, brief nemzetkozi-hr-vegproba-20261122.md): EGY horvát szállás a
// teljes láncon, a hideg levéltől a fizetés indításáig, és egy második horvát lead az ünnepnap → leiratkozás →
// elutasítás ágon. SCRATCH database only (scripts/lib/hr-world.mts), no AI, nothing leaves the machine — except,
// with --barion-test, the Barion SANDBOX (api/secure.test.barion.com, the dev .env's test shop).
//
// What it proves that the per-area e2e suites (country-hr-e2e, country-hr-fix-e2e, nemzetkozi-b-e2e,
// nemzetkozi-c-e2e) do not, on ONE lead and through the real paths:
//   ④ the letter that really went out: Croatian, EUR, no Ft / .hu / Szállás.hu, the legal and unsubscribe
//      lines in Croatian, and how many strings still wait for Bábel (the scratch world marks them „‹hr›”;
//      in production the same letter is HELD „Bábelre vár”); the Zagreb send window and holiday on the
//      real send path (Christmas / Sunday held, a Wednesday morning goes); the unsubscribe page in Croatian;
//   ⑤ an interested reply („Zanima me…”) and a refusal („Ne, hvala”) in Croatian: both stored as hr with
//      Poe's ticket in hr / Europe/Zagreb; after the refusal NO sender touches the second lead;
//   ⑥ the three Croatian buyer types (private, OIB company, EU-VAT company), the order in euros, and the
//      payment: with the production wallet setting the euro pay-link closes with a reason the buyer reads in
//      Croatian; with BARION_WALLET_CURRENCIES=HUF,EUR (scratch only) the real gateway starts a sandbox
//      payment (--barion-test) — the rest of the walk is the buyer persona's, in a browser;
//   ⑦ the .com suggestion for „Apartmani Đurđa” (→ durda).
//
//   npx tsx scripts/hr-vegproba-e2e.mts [--barion-test | --barion-pay [--szamlazz-test]]
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { buildHrWorld } from "./lib/hr-world.mts";

// --barion-pay: the sandbox payment is also PAID (test card, in a browser), the gateway callback is replayed
// to the local console, and the chain runs on: paid → invoice in euros → activation (dry: mock registrar,
// mock mail). Implies --barion-test. --szamlazz-test: the invoice is a real Számlázz.hu TEST-account
// document (dev .env key, OV- prefix, no NAV) instead of the mock invoicer. A sandbox shop with a euro
// account is needed: BARION_SANDBOX_ENV_FILE=<600 file> (scripts/lib/hr-world.mts barionSandboxEnv).
const BARION_PAY = process.argv.includes("--barion-pay");
const SZAMLAZZ_TEST = process.argv.includes("--szamlazz-test");
const BARION_TEST = BARION_PAY || process.argv.includes("--barion-test");
// The real gateway without a euro wallet keeps the HR market CLOSED (countryReadiness: wallet), so no
// letter would go out at all; the world is built with the scratch-only wallet, the production setting is
// measured in ⑥ a).
if (BARION_TEST) process.env.BARION_WALLET_CURRENCIES = "HUF,EUR";
const w = await buildHrWorld({ base: "citoviso_hrvegproba_e2e", payment: BARION_TEST ? "barion-test" : "mock", invoice: SZAMLAZZ_TEST ? "szamlazz-test" : "mock" });

const { db } = await import("../src/db/client.js");

let fails = 0;
let total = 0;
function check(name: string, ok: boolean, detail = ""): void {
  total++;
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}
const info = (name: string, detail: string): void => console.log(`  · ${name}: ${detail}`);
const cGet = (p: string) => fetch(`${w.consoleOrigin}${p}`, { redirect: "manual" });
const cPost = (p: string, body: unknown) =>
  fetch(`${w.consoleOrigin}${p}`, { method: "POST", redirect: "manual", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const local = (u: string) => u.replace(/^https?:\/\/[^/]+/, "");

/** Run `fn` with the no-argument Date / Date.now frozen at `at` (the send path reads the wall clock). */
async function atClock<T>(at: Date, fn: () => Promise<T>): Promise<T> {
  const RealDate = Date;
  const fixed = at.getTime();
  class FrozenDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fixed);
      else super(...(args as [string | number | Date]));
    }
    static now(): number {
      return fixed;
    }
  }
  globalThis.Date = FrozenDate as DateConstructor;
  try {
    return await fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

/** Decoded text of a stored .eml (quoted-printable bodies). */
function emlText(raw: string): string {
  return raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/[À-ÿ][\u0080-¿]+/g, (s) => {
      try {
        return Buffer.from(s, "latin1").toString("utf8");
      } catch {
        return s;
      }
    });
}

try {
  // ── ④ the cold letter that went out ────────────────────────────────────────────────────────
  console.log("④ a hideg levél (a valódi küldési úton, mock-transzport)");
  check("a hideg levél kiment", w.letterPath !== null);
  const raw = w.letterPath ? readFileSync(w.letterPath, "utf8") : "";
  const letter = emlText(raw);
  check("euró, nincs „Ft” / forint", /€/.test(letter) && !/\bFt\b|forint/i.test(letter), (letter.match(/[^\n]{0,30}(€|Ft)[^\n]{0,15}/g) ?? []).slice(0, 3).join(" | "));
  check("nincs Szállás.hu, nincs „.hu” cím, nincs magyar megszólítás", !/Szállás\.hu/.test(letter) && !/(^|[\s/@])[a-z0-9-]+\.hu\b/im.test(letter) && !/Tisztelt|Kedves|Üdvözlettel/.test(letter),
    (letter.match(/[^\s]{0,30}\.hu\b|Tisztelt|Kedves|Üdvözlettel/g) ?? []).slice(0, 3).join(" | "));
  check("a leiratkozó link benne van", /\/unsubscribe/.test(letter));
  const markers = (letter.match(/‹hr›[^\n<]{0,60}/g) ?? []);
  info("Bábelre váró szöveg a levélben (a teszt-világ ‹hr› jelölője; élesen ez a levél TARTVA)", markers.length ? `${markers.length} db — ${markers.slice(0, 4).join(" | ")}` : "0 — minden szöveg Bábel-fordítás");
  const { missingHrStrings } = await import("./lib/hr-open-fixture.mts");
  const missing = await missingHrStrings();
  info("hiányzó vevő-oldali hr felirat a csomagban (Bábel-teendő)", `${missing.length}${missing.length ? ` — ${missing.slice(0, 5).join(" | ")}` : ""}`);
  const { buildDraftForProspect } = await import("../src/outreach/draft.js");
  const dr = await buildDraftForProspect(w.prospectId, { reserveLabel: false });
  check("a levél nyelve hr, piaca HR, a jogi sor és a leiratkozás a levél nyelvén", dr?.lang === "hr" && dr.market.country === "HR" && !!dr.draft.unsubscribeLink,
    JSON.stringify({ lang: dr?.lang, market: dr?.market.country }));

  // The second Croatian lead — the holiday / unsubscribe / refusal branch.
  const parent = await db.selectFrom("lead").select("scrape_run_id").where("id", "=", w.leadId).executeTakeFirstOrThrow();
  // Its own address: the address-level one-shot rule (rightly) refuses a second cold letter to elek@; the
  // window checks are dry runs, so nothing is delivered to it.
  const raw2 = { name: "Apartmani Đurđa", country: "HR", city: "Tučepi", lat: 43.27, lon: 17.06, email: "durda@citoviso.com", phone: "091 234 5678", address: "Kraj 22, 21325 Tučepi" };
  const lead2 = await db.insertInto("lead").values({ scrape_run_id: parent.scrape_run_id, name: raw2.name, raw: raw2, qualification: "no_site" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const art1 = await db.selectFrom("prospect").select("mock_artifact_id").where("id", "=", w.prospectId).executeTakeFirstOrThrow();
  const a1 = await db.selectFrom("mock_artifact").selectAll().where("id", "=", art1.mock_artifact_id!).executeTakeFirstOrThrow();
  const a2 = await db.insertInto("mock_artifact").values({ ...a1, id: undefined, lead_id: lead2.id } as never).returning("id").executeTakeFirstOrThrow();
  const token2 = `hrvegproba${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const p2 = await db.insertInto("prospect").values({ lead_id: lead2.id, token: token2, mock_artifact_id: a2.id, contact_email: "durda@citoviso.com" } as never)
    .returning("id").executeTakeFirstOrThrow();
  const { sendOutreachMail } = await import("../src/outreach/sendBatch.js");
  const xmas = await atClock(new Date("2026-12-25T09:00:00Z"), () => sendOutreachMail(p2.id, { dryRun: true }));
  check("karácsony 10:00 Zágráb: a hideg levél NEM megy (horvát ünnepnap)", xmas.outcome.kind !== "sent", JSON.stringify(xmas.outcome));
  const sunday = await atClock(new Date("2026-11-29T09:00:00Z"), () => sendOutreachMail(p2.id, { dryRun: true }));
  check("vasárnap 10:00 Zágráb: NEM megy", sunday.outcome.kind !== "sent", JSON.stringify(sunday.outcome));
  const early = await atClock(new Date("2026-11-25T05:30:00Z"), () => sendOutreachMail(p2.id, { dryRun: true }));
  check("szerda 06:30 Zágráb: még NEM megy (ablak előtt)", early.outcome.kind !== "sent", JSON.stringify(early.outcome));
  const wed = await atClock(new Date("2026-11-25T09:00:00Z"), () => sendOutreachMail(p2.id, { dryRun: true }));
  check("szerda 10:00 Zágráb: megy (szárazon)", wed.outcome.kind === "sent" || wed.outcome.kind === "dry-run", JSON.stringify(wed.outcome));
  info("az ablakon kívüli ok", JSON.stringify(xmas.outcome).slice(0, 160));

  const dr2 = await buildDraftForProspect(p2.id, { reserveLabel: false });
  const unsubLink = dr2?.draft.unsubscribeLink ?? "";
  const up = await cGet(local(unsubLink));
  const upHtml = await up.text();
  check("a leiratkozó (megerősítő) lap horvátul (lang=hr), magyar felirat nélkül", up.status < 400 && /<html lang="hr"/.test(upHtml) && !/Leiratkoz|Biztosan|Igen/i.test(upHtml.replace(/\/unsubscribe/g, "")),
    `${up.status} ${upHtml.match(/<title>[^<]*<\/title>/)?.[0] ?? ""}`);
  const upPost = await fetch(`${w.consoleOrigin}${local(unsubLink)}`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded", accept: "text/html" }, body: "" });
  const upDone = await upPost.text();
  const unsubbed = await db.selectFrom("prospect").select("unsubscribed_at").where("id", "=", p2.id).executeTakeFirstOrThrow();
  check("leiratkozás rögzítve; a köszönő lap horvátul", !!unsubbed.unsubscribed_at && (upDone === "" || /<html lang="hr"/.test(upDone)) && !/Leiratkoz|sikeresen/i.test(upDone),
    `${upPost.status} ${upDone.match(/<title>[^<]*<\/title>/)?.[0] ?? ""}`);

  // ── ⑤ replies ────────────────────────────────────────────────────────────────────────────
  console.log("⑤ horvát válaszok: érdeklődő + elutasító");
  await db.updateTable("prospect").set({ sent_at: new Date("2026-11-25T09:00:00Z"), email_sent_at: new Date("2026-11-25T09:00:00Z") } as never).where("id", "=", p2.id).execute();
  const { ingestReplies, repliesNeedingSuggestion } = await import("../src/replies/store.js");
  const ing = await ingestReplies([
    { channel: "email", key: `email:<hrveg-a-${Date.now()}@test>`, from: "Ivan Babić <elek@citoviso.com>", receivedAt: "2026-11-26T08:00:00.000Z",
      subject: "Re: Apartmani Lavanda", text: "Poštovani, zanima me. Kako mogu nastaviti i koliko košta godišnje?" },
  ]);
  const r1 = await db.selectFrom("outreach_reply").select(["id", "lang", "lead_id"]).where("lead_id", "=", w.leadId).executeTakeFirst();
  check("„Zanima me…” a Lavanda leadhez, hr nyelvjellel", ing.accepted.length >= 1 && r1?.lang === "hr", JSON.stringify({ ing, r1 }));
  const need = await repliesNeedingSuggestion();
  const n1 = need.find((n) => n.id === r1?.id);
  check("Poe jegye (érdeklődő): hr, Europe/Zagreb", n1?.lang === "hr" && n1?.timeZone === "Europe/Zagreb", JSON.stringify(n1));
  const ing2 = await ingestReplies([
    { channel: "email", key: `email:<hrveg-b-${Date.now()}@test>`, from: "Đurđa Vuković <durda@citoviso.com>", receivedAt: "2026-11-26T09:00:00.000Z",
      subject: "Re: Apartmani Đurđa", text: "Ne, hvala. Ne zanima me, molim da me više ne kontaktirate." },
  ]);
  const r2 = await db.selectFrom("outreach_reply").select(["id", "lang", "lead_id"]).where("lead_id", "=", lead2.id).executeTakeFirst();
  check("„Ne, hvala” az Đurđa leadhez, hr nyelvjellel", ing2.accepted.length === 1 && r2?.lead_id === lead2.id && r2?.lang === "hr", JSON.stringify({ ing2, r2 }));
  const n2 = (await repliesNeedingSuggestion()).find((n) => n.id === r2?.id);
  check("Poe jegye (elutasító): hr, Europe/Zagreb", n2?.lang === "hr" && n2?.timeZone === "Europe/Zagreb", JSON.stringify(n2));
  const { blockLeadContact } = await import("../src/console/partnerMessages.js");
  const b = await blockLeadContact(lead2.id, "elutasító (hr): Ne, hvala", "poe");
  check("Poe elutasító-jelölése: „ne keressük” rögzítve", b.ok, JSON.stringify(b));
  const p3 = await db.insertInto("prospect").values({ lead_id: lead2.id, token: `${token2}b`, mock_artifact_id: a2.id, contact_email: "durda@citoviso.com", sent_at: new Date("2026-12-01T09:00:00Z") } as never)
    .returning("id").executeTakeFirstOrThrow();
  const cold = await atClock(new Date("2026-12-02T09:00:00Z"), () => sendOutreachMail(p3.id, { dryRun: true }));
  check("elutasító után: hideg levél kihagyva", cold.outcome.kind === "skipped", JSON.stringify(cold.outcome));
  const MON = new Date("2026-12-28T09:00:00Z");
  const { listNonOpenerCandidates } = await import("../src/outreach/nonOpenerFollowup.js");
  const non = (await listNonOpenerCandidates({ onlyLeads: [lead2.id], now: new Date("2027-01-20T09:00:00Z") })).find((c) => c.leadId === lead2.id);
  check("elutasító után: nem-nyitó utánkövető kizárva", !non || non.excluded !== null, JSON.stringify(non?.excluded));
  const { listBehaviorCandidates, setBehaviorEnabled } = await import("../src/outreach/behaviorMessage.js");
  await setBehaviorEnabled(true, "e2e", new Date("2026-12-01T00:00:00Z"));
  await db.insertInto("mock_view").values({ prospect_id: p3.id, device: "mobile", started_at: new Date("2026-12-27T10:00:00Z") } as never).execute();
  const beh = (await listBehaviorCandidates({ onlyLeads: [lead2.id], now: MON })).filter((c) => c.leadId === lead2.id);
  check("elutasító után: viselkedés-üzenet kizárva", beh.every((c) => c.excluded !== null), JSON.stringify(beh.map((c) => c.excluded)));
  const { listTrialCampaignCandidates } = await import("../src/outreach/trialCampaign.js");
  const tc = (await listTrialCampaignCandidates({ onlyLeads: [lead2.id], now: MON })).find((c) => c.leadId === lead2.id);
  check("elutasító után: próba-kampány kizárva", !tc || tc.excluded !== null, JSON.stringify(tc?.excluded));
  const { sendEscalationFollowups } = await import("../src/outreach/escalationFollowup.js");
  await db.insertInto("offer").values({ kind: "escalation", prospect_id: p3.id, percent: 30, expires_at: new Date("2027-01-10T12:00:00Z"), note: "hr-vegproba", created_at: new Date("2026-12-20T09:00:00Z") } as never).execute();
  const sent: unknown[] = [];
  const x = await sendEscalationFollowups(MON, { sender: (async (m: unknown) => { sent.push(m); return { ok: true }; }) as never, onlyProspects: new Set([p3.id]) });
  check("elutasító után: eszkalációs emlékeztető nem megy", x.sent === 0 && sent.length === 0, JSON.stringify(x));

  // ── ⑥ buyers, order, payment ────────────────────────────────────────────────────────────
  /** --barion-pay: the buyer pays the sandbox page with Barion's test card, then the gateway callback is
   *  replayed to the local console (the sandbox cannot reach https://citoviso.test) — the same idempotent
   *  path a real callback takes (handleWebhook → GetPaymentState). */
  async function payInSandbox(gatewayUrl: string): Promise<void> {
    const barionId = new URL(gatewayUrl).searchParams.get("Id") ?? "";
    const { chromium } = await import("playwright-core");
    const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || `${process.env.HOME}/bin/chrome-for-testing`, headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "hr-HR" });
      await page.goto(gatewayUrl);
      await page.waitForLoadState("networkidle").catch(() => {});
      const body = await page.locator("body").innerText();
      check("a Barion fizetőoldal euróban, horvátul („Plaćanje: … €”)", /Plaćanje:\s*[\d.,]+\s*€/.test(body), body.replace(/\s+/g, " ").slice(0, 200));
      // Not elek@: the EUR test shop is registered to elek@ — Barion refuses „the shop owner can not pay
      // in their own shop” (measured 2026-11-25). A guest payer address on the reserved example.com domain.
      await page.fill("#EmailAddress", "ivan.babic.hr@example.com");
      await page.fill("#CardNumber", "4444888888885559");
      await page.fill("#CardExpiration", "12/30");
      await page.fill("#CardCVC", "123");
      await page.fill("#CardHolderName", "Ivan Babic");
      await page.click("#StartGuestPayment");
      // The sandbox redirects to our RedirectUrl (https://citoviso.test/… — unreachable here): wait for leaving secure.test.
      await page.waitForURL((u) => !/secure\.test\.barion\.com\/Pay/.test(u.href), { timeout: 60_000 }).catch(() => {});
      info("a sandbox-fizetés után", page.url().slice(0, 140));
    } finally {
      await browser.close();
    }
    const pay = await db.selectFrom("payment").select(["id", "status", "currency", "amount"]).where("gateway_ref", "=", barionId).executeTakeFirst();
    const wh = await fetch(`${w.consoleOrigin}/pay/webhook/barion`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: `PaymentId=${encodeURIComponent(barionId)}` });
    info("a visszahívás (helyben)", `${wh.status} ${(await wh.text()).slice(0, 160)}`);
    const after = pay ? await db.selectFrom("payment").select(["status", "currency", "amount"]).where("id", "=", pay.id).executeTakeFirst() : null;
    check("a sandbox-fizetés kifizetve (paid), euróban", after?.status === "paid" && after.currency === "EUR", JSON.stringify({ before: pay, after }));
    if (!pay) return;
    // The invoice is made right after „paid” (applyWebhookResult) — the Számlázz-TESZT call may take a few seconds.
    let inv: Record<string, unknown> | undefined;
    for (let i = 0; i < 30 && !inv; i++) {
      inv = (await db.selectFrom("invoice").selectAll().where("payment_id", "=", pay.id).orderBy("id", "desc").executeTakeFirst()) as never;
      if (!inv) await new Promise((r) => setTimeout(r, 1000));
    }
    const invOk = !!inv && inv.status !== "failed" && inv.currency === "EUR";
    check(`a számla euróban elkészült (${SZAMLAZZ_TEST ? "Számlázz.hu TESZT-fiók" : "mock számlázó"})`, invOk,
      JSON.stringify(inv ? Object.fromEntries(Object.entries(inv).filter(([k]) => !/pdf|xml|raw/i.test(k))) : null).slice(0, 400));
    if (inv) info("számla", JSON.stringify(Object.fromEntries(Object.entries(inv).filter(([k]) => /^(invoice_number|provider|currency|gross|net|vat_key|vat_rate|status|error|fx_rate|fx_date|buyer_country)$/.test(k)))).slice(0, 300));
    const oi = await db.selectFrom("order_intent").selectAll().where("id", "=", (await db.selectFrom("payment").select("order_intent_id").where("id", "=", pay.id).executeTakeFirstOrThrow()).order_intent_id).executeTakeFirst() as Record<string, unknown> | undefined;
    info("a rendelés a fizetés után", JSON.stringify(oi ? Object.fromEntries(Object.entries(oi).filter(([k]) => /^(status|tenant_id|domain_type|domain_name|price|currency|preset)$/.test(k))) : null).slice(0, 300));
    const tenant = await db.selectFrom("tenant").selectAll().where("lead_id", "=", w.leadId).executeTakeFirst() as Record<string, unknown> | undefined;
    check("élesítés (száraz: mock regisztrátor, mock levél): a bérlő létrejött", !!tenant,
      JSON.stringify(tenant ? Object.fromEntries(Object.entries(tenant).filter(([k]) => /^(id|status|display_name|time_zone)$/.test(k))) : null).slice(0, 300));
  }

  console.log("⑥ vevő → rendelés euróban → fizetés");
  const { validateBuyer } = await import("../src/billing/buyer.js");
  const base = { buyer_name: "Ivan Babić", buyer_country: "HR", buyer_zip: "21300", buyer_city: "Makarska", buyer_address: "Obala kralja Tomislava 12", buyer_email: "elek@citoviso.com" };
  const priv = await validateBuyer({ ...base, buyer_type: "individual", withdrawal_waiver: true } as never, { lang: "hr" });
  check("magánszemély (HR): rendelhet", priv.ok, JSON.stringify(priv.ok ? null : priv.errors));
  const oib = await validateBuyer({ ...base, buyer_type: "business", buyer_name: "Obrt Lavanda", buyer_national_tax_id: "69435151530" }, { lang: "hr" });
  check("OIB-os cég (EU-adószám nélkül): rendelhet, nincs fordított adózás", oib.ok && oib.value.vatTreatment !== "reverse_charge", JSON.stringify(oib.ok ? oib.value.vatTreatment : oib.errors));
  const eu = await validateBuyer({ ...base, buyer_type: "business", buyer_name: "Lavanda d.o.o.", buyer_national_tax_id: "69435151530", buyer_eu_vat_number: "HR69435151530" }, { lang: "hr" });
  check("EU-adószámos cég: rendelhet (a VIES a kerítés mögött nem elérhető → nem blokkol, az operátor látja)", eu.ok, JSON.stringify(eu.ok ? { vies: eu.value.viesStatus, vat: eu.value.vatTreatment } : eu.errors));
  if (eu.ok) info("EU-adószámos cég VIES-állapota / áfakezelés", `${eu.value.viesStatus} / ${eu.value.vatTreatment}`);
  const badEu = await validateBuyer({ ...base, buyer_type: "business", buyer_name: "Lavanda d.o.o.", buyer_eu_vat_number: "HR12345678904" }, { lang: "hr" });
  check("hibás horvát EU-adószám: mezőhiba, nem magyarul", !badEu.ok && !!badEu.errors.buyer_eu_vat_number && !/stimmel|adószám/.test(badEu.errors.buyer_eu_vat_number), JSON.stringify(badEu.ok ? null : badEu.errors));

  const { computeMonthly, domainFeeForCycle } = await import("../src/pricing.js");
  const { applyOffer } = await import("../src/payment/offers.js");
  const { PRESETS } = await import("../src/modules.js");
  const offer = await db.selectFrom("offer").select(["kind", "percent"]).where("prospect_id", "=", w.prospectId).execute();
  const pct = offer.find((o) => o.kind === "outreach")?.percent ?? 0;
  // The paid probe takes the smallest package („alap”, 7 €/hó in the hr layer) — a real payment, kept small.
  const PRESET = BARION_PAY ? "alap" : "ajanlott";
  const mods = PRESETS.find((p) => p.id === PRESET)!.modules;
  const list = computeMonthly(mods, "hr");
  const fee = domainFeeForCycle(1, "hr", { domain: "apartmanilavanda.com", modules: mods, disabled: new Set() } as never);
  const price = applyOffer(list, { percent: pct }) + fee;
  const order = (extra: Record<string, unknown> = {}) => cPost(`/p/${w.token}/request`, {
    modules: mods, preset: PRESET, billing_period: "monthly", domain_type: "citoviso_registered", domain_name: "apartmanilavanda.com",
    photo_rights_declared: true, recurring_consent: true, withdrawal_waiver: true, terms_accepted: true, price,
    buyer_type: "individual", ...base, ...extra,
  });
  const gw = (process.env.PAYMENT_GATEWAY ?? "mock").toLowerCase();
  if (gw === "barion") {
    // a) the production wallet setting (forint only): the HR market does not open, and an order that
    //    still arrives gets no pay-link — the buyer gets the „received” letter in Croatian, the reason
    //    goes to the operator.
    delete process.env.BARION_WALLET_CURRENCIES;
    const { countryReadiness } = await import("../src/countryReadiness.js");
    const rd = await countryReadiness("HR");
    check("éles tárca-beállítással a HR piac ZÁRVA, és az ok a hiányzó EUR-tárca", !rd.open && rd.reasons.some((r) => /EUR/.test(r) && /tárca/i.test(r)), rd.reasons.join(" · "));
    const outBefore = new Set(readdirSync("outbox"));
    const o1 = await order();
    const j1 = (await o1.json().catch(() => ({}))) as { ok?: boolean; payUrl?: string; pending?: boolean; error?: string };
    check("éles tárca-beállítással: az euró fizetés NEM indul (a rendelés függőben, nincs fizetési link)", !j1.payUrl, JSON.stringify(j1).slice(0, 300));
    const mails = readdirSync("outbox").filter((f) => !outBefore.has(f)).map((f) => emlText(readFileSync(`outbox/${f}`, "utf8")));
    const subj = mails.map((m) => m.match(/^Subject: (.*)$/m)?.[1] ?? "").filter(Boolean);
    check("a vevő levele horvát, magyar mondat nélkül", subj.length > 0 && !mails.some((m) => /Köszönjük|megrendel|fizetés/i.test(m)), subj.join(" | "));
    // b) scratch only: the wallet as if opened — the REAL gateway against the Barion SANDBOX.
    process.env.BARION_WALLET_CURRENCIES = "HUF,EUR";
    const o2 = await order();
    const j2 = (await o2.json().catch(() => ({}))) as { ok?: boolean; payUrl?: string; pending?: boolean; error?: string };
    check("scratch + BARION_WALLET_CURRENCIES=HUF,EUR: a rendelés átmegy a kapun", j2.ok === true, JSON.stringify(j2).slice(0, 300));
    if (j2.payUrl) {
      // The order answer carries either our stable /pay/go/… link or the gateway's own page directly
      // (measured 2026-11-25: the sandbox Pay?Id=… URL) — the latter is not a console path.
      const direct = /^https:\/\/secure\.test\.barion\.com\//.test(j2.payUrl);
      const go = direct ? null : await cGet(local(j2.payUrl));
      const loc = go?.headers.get("location") ?? "";
      const goHtml = !go || loc ? "" : await go.text();
      const sandbox = direct ? j2.payUrl : loc || (goHtml.match(/https:\/\/secure\.test\.barion\.com[^"'<\s]*/)?.[0] ?? "");
      check("a Barion SANDBOX-fizetés elindult (secure.test.barion.com)", /secure\.test\.barion\.com/.test(sandbox), `${go?.status ?? "direct"} ${loc || goHtml.slice(0, 300) || j2.payUrl}`);
      if (sandbox) console.log(`  · SANDBOX-URL (a vevő-perszóna fizeti tesztkártyával): ${sandbox}`);
      if (sandbox && BARION_PAY) await payInSandbox(sandbox);
    } else {
      // Measured 2026-11-22: the sandbox shop answers „NotExistingCurrency — Payment is not supported”
      // for EUR (see the [console] pay-link line above) — the TEST shop has no euro wallet either.
      info("KÜLSŐ — a Barion TESZT-bolt nem fogad EUR-t", "nincs fizetési link (a konzol-napló a Barion válaszát mutatja); az euró-fizetés sandboxban sem járható végig, amíg a teszt-boltban nincs EUR-tárca");
    }
  } else {
    const o = await order();
    const j = (await o.json().catch(() => ({}))) as { ok?: boolean; payUrl?: string };
    check("mock átjáró: a rendelés euróban fizetési linket kap", j.ok === true && !!j.payUrl, JSON.stringify(j));
    info("Barion-sandbox", "kihagyva (futtasd --barion-test kapcsolóval)");
  }
  const oi = await db.selectFrom("order_intent").selectAll().where("prospect_id", "=", w.prospectId).orderBy("created_at", "desc").executeTakeFirst();
  check("a rendelés euróban, a kedvezményes áron", oi?.currency === "EUR" && oi.price === price, JSON.stringify({ c: oi?.currency, p: oi?.price, want: price }));

  // ── Elek IT leletei (HR végpróba): ismeretlen fizetés, hibás link, adatvédelem a mockról ─────────
  console.log("⑥b vevő-oldali zsákutcák a látogató nyelvén");
  const hrHdr = { "accept-language": "hr-HR,hr;q=0.9" };
  const bogusPay = await (await fetch(`${w.consoleOrigin}/pay/done?paymentId=nincsilyenfizetes123`, { headers: hrHdr })).text();
  check("/pay/done ismeretlen fizetés: horvát böngészőnek horvátul", !/Ezt a fizetést nem találjuk/.test(bogusPay) && /<html lang="hr"/.test(bogusPay), bogusPay.match(/<h2[^>]*>[^<]*/)?.[0] ?? bogusPay.slice(0, 120));
  const bogusPayHu = await (await fetch(`${w.consoleOrigin}/pay/done?paymentId=nincsilyenfizetes123`)).text();
  check("/pay/done ismeretlen fizetés: nyelvi jel nélkül a régi magyar lap", /Ezt a fizetést nem találjuk/.test(bogusPayHu));
  const bogusTok = await fetch(`${w.consoleOrigin}/p/apartmani-lavanda/nincsilyentoken12345678`, { headers: hrHdr });
  const bogusTokHtml = await bogusTok.text();
  check("hibás mock-link: 404, horvátul, konzol-navigáció nélkül", bogusTok.status === 404 && /<html lang="hr"/.test(bogusTokHtml) && !/Irányítópult|Pénzügy|Nincs ilyen oldal/.test(bogusTokHtml), bogusTokHtml.slice(0, 160));
  const privFromMock = await fetch(`${w.consoleOrigin}/adatvedelem`, { redirect: "manual", headers: { referer: `${w.consoleOrigin}/p/apartmani-lavanda/${w.token}` } });
  check("a mock adatvédelmi linkje (/adatvedelem) a mock nyelvére visz (?l=hr)", privFromMock.status >= 301 && privFromMock.status <= 308 && /[?&]l=hr\b/.test(privFromMock.headers.get("location") ?? ""), `${privFromMock.status} ${privFromMock.headers.get("location")}`);
  const privBare = await fetch(`${w.consoleOrigin}/adatvedelem`, { redirect: "manual" });
  check("/adatvedelem hivatkozó nélkül: a magyar tájékoztató, mint eddig", privBare.status === 200);

  // ── ⑦ domain ─────────────────────────────────────────────────────────────────────────────
  console.log("⑦ domain");
  const { suggestDomains } = await import("../src/domains.js");
  const { countryConfigSync } = await import("../src/country.js");
  const sug = suggestDomains("Apartmani Đurđa", [".com"], countryConfigSync("HR"));
  check("„Apartmani Đurđa” → .com javaslat „durda” maggal, ékezet nélkül", sug.some((s) => /durda\.com$/.test(s)) && !sug.some((s) => /[^a-z0-9.-]/.test(s)), sug.join(", "));
} finally {
  for (const f of readdirSync("outbox")) if (f.startsWith("hrveg")) rmSync(`outbox/${f}`, { force: true });
  await w.close();
  console.log(fails ? `\n⛔ hr-vegproba-e2e: ${fails}/${total} hiba` : `\n✅ hr-vegproba-e2e: ${total}/${total} rendben`);
  process.exit(fails ? 1 : 0);
}
