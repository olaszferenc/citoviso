// PÉNZTÁRCA őr — a mentett kártya látható, cserélhető, visszavonható (ADR-0226).
//
//   npx tsx scripts/wallet-check.mts [--self-test]
//
// Kontraktus: `assets/design-refs/console/wallet/README.md` ①–⑨.
//
// Négy kérdés, négy réteg — mind a VISELKEDÉST méri, nem a kód jelenlétét:
//   A) RENDER — minden állapot (kártya / lejár / nincs / elakadt / maszk nélkül / csere-siker)
//      a kontraktus feliratát viseli; a kártya-képen SOHA nincs 5+ jegyű szám (②); a
//      „Kártya cseréje" gomb CSAK olyan átjárónál áll ki, amely zárolást tud feloldani (④).
//   B) TERV-SÁV — a Modulok fül kártyaválasztója (⑧) egy VALÓDI kattintással jelenik meg
//      (fizetős modul bepipálva), a gomb felirata a választást követi. Playwright, mert a
//      sáv JS-ből él; egy HTML-grep itt a szerkezetet mérné, nem azt, amit a tulaj lát.
//   C) BARION-MASZK — a GetPaymentState `FundingInformation.BankCard` → utolsó 4 (②); egy
//      hosszabb MaskedPan is 4-re vágódik; „Reserved" → pending; FinishReservation → true.
//      A `fetch` álcázva — hálózat nem megy ki.
//   D) DB-ÚT — valódi (eldobható, egyedi nevű) fixtúrán: card_update webhook → token + maszk a
//      subscription-on, a régi kártya `replaced` előzmény; a webhook ÚJRAJÁTSZÁSA nem ír
//      második előzményt; a visszavonás `revoked` előzményt ír és nullázza a maszkot; a
//      `createCardUpdateOrder` a friss nyitott rendelést újrahasznosítja.
//      ⛔ PÉNZ NEM MOZDUL: PAYMENT_GATEWAY=mock DINAMIKUS import ELŐTT
//      (reference_env_assignment_loses_to_esm_imports), a fixtúra `finally`-ben takarít.
//
// --self-test: egy szándékosan HIBÁS render (teljes kártyaszám a képen) és egy hibás
// terv-sáv-fixtúra (választó megbízás nélkül) — az őrnek PIROSRA kell mennie.

process.env.PAYMENT_GATEWAY = "mock";
process.env.CIT_SHOT = "1";

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const selfTest = process.argv.includes("--self-test");
let failures = 0;
const ok = (cond: boolean, what: string): void => {
  if (cond) console.log(`  ✓ ${what}`);
  else {
    failures++;
    console.error(`  ✗ ${what}`);
  }
};

const { adminDashboard, walletSection } = await import("../src/server/adminViews.js");
const { BarionGateway } = await import("../src/payment/barion.js");
const { MockGateway, MOCK_CARDS } = await import("../src/payment/mock.js");
const { applyWebhookResult, requestPayment, CARD_VERIFY_AMOUNT_HUF } = await import("../src/payment/service.js");
const { revokeAutoCharge } = await import("../src/payment/subscription.js");
const { createCardUpdateOrder, getWalletAdmin, cardExpiresBefore } = await import("../src/tenant/wallet.js");
const { getTenantModules } = await import("../src/tenant/modules.js");
const { config } = await import("../src/config.js");
const { db } = await import("../src/db/client.js");
type WalletAdminData = import("../src/tenant/wallet.js").WalletAdminData;
type SubscriptionAdminData = import("../src/tenant/subscriptionAdmin.js").SubscriptionAdminData;

const ROOT = path.resolve(import.meta.dirname, "..");

// ── fixtures ────────────────────────────────────────────────────────────────
const session = {
  tenantId: "demo",
  tenantUserId: "demo-user",
  username: "kovacs.jozsef",
  displayName: "Őr Vendégház",
  contactEmail: "or@example.com",
} as unknown as Parameters<typeof adminDashboard>[0];
const content = {
  name: "Őr Vendégház",
  tagline: "",
  intro: "…",
  highlights: [],
  photos: [],
  usingOwnPhotos: true,
  status: "live",
  previewPath: null,
} as unknown as Parameters<typeof adminDashboard>[1];
const sub: SubscriptionAdminData = {
  status: "active",
  periodEnd: "2026-09-28",
  renewDay: 28,
  nextInvoiceTotal: 6070,
  nextInvoiceItems: [],
  payUrl: null,
  arrears: null,
  closesOn: "2026-10-28",
  frozenOn: null,
  restoredOn: null,
  settled: null,
  cancelAtPeriodEnd: false,
  billingPeriod: "monthly",
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: 60700,
  annualSavings: 12140,
  annualFreeMonths: 2,
  autoCharge: true,
  cardLabel: "Visa ····4242",
  coupon: null,
};
const base: WalletAdminData = {
  autoCharge: true,
  card: { brand: "Visa", last4: "4242", expMonth: 8, expYear: 2028, savedOn: "2026-06-28" },
  expiring: false,
  nextChargeOn: "2026-09-28",
  frozen: false,
  charges: [{ on: "2026-08-28", orderKind: "renewal", billingPeriod: "monthly", amount: 7240, status: "paid" }],
  history: [{ brand: "MasterCard", last4: "8810", savedOn: "2026-03-10", endedOn: "2026-06-28", reason: "replaced" }],
  verifyAmount: CARD_VERIFY_AMOUNT_HUF,
  canChangeCard: true,
};
const strip = (html: string): string => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// ── A) RENDER ───────────────────────────────────────────────────────────────
console.log("A) render — állapotok és a kontraktus feliratai");
{
  const on = walletSection(base, sub, null);
  const onT = strip(on);
  ok(onT.includes("AUTOMATIKUS TERHELÉS BEKAPCSOLVA"), "kártya: a BEKAPCSOLVA pill (③)");
  ok(onT.includes("···· ···· ···· 4242") && onT.includes("Lejárat: 08/2028"), "kártya: utolsó 4 + lejárat (②)");
  ok(on.includes("2026. 09. 28.") && onT.includes("6 070 Ft"), "következő terhelés: dátum + a subscription összege (⑦)");
  ok(onT.includes("Korábbi kártyák (1)") && onT.includes("MASTERCARD ····8810") && onT.includes("cserélve"), "előzmény: cserélve (④)");
  ok(on.includes("data-wal-change>") && onT.includes("Kártya cseréje"), "gomb: Kártya cseréje (④)");
  ok(on.includes("data-mand-revoke>") && on.includes('form="adm-mand-off"'), "gomb: Megbízás visszavonása + kétlépéses ablak (⑥)");
  // ⑤ + ADR-0228: a bank-card Reservation IS a charge and Finish(0) a refund (sandbox-
  // measured) — the sentence must say "terhelünk … visszautaljuk … legfeljebb 30 nap",
  // and the old "zárolunk / pénzt nem vonunk le" promise must be GONE, not merely joined.
  ok(onT.includes("10 Ft-ot terhelünk") && onT.includes("azonnal vissza is utaljuk") && onT.includes("legfeljebb 30 nap"), "csere-ablak: a hitelesítés ára IGAZON kimondva — terhelés + visszautalás, max 30 nap (⑤)");
  ok(!onT.includes("zárolunk") && !onT.includes("pénzt nem vonunk le"), "csere-ablak: a hamis „zárolunk / pénzt nem vonunk le” ígéret nincs a lapon (⑤)");
  ok(CARD_VERIFY_AMOUNT_HUF === 10, `a megerősítő összeg a tulaj döntése szerint 10 Ft (mért: ${CARD_VERIFY_AMOUNT_HUF})`);
  ok(onT.includes("Kártya megadása") && onT.includes("gombbal"), "visszavonó ablak 4. pontja a valódi utódot nevezi (⑥)");
  // ② The face never carries more than four digits — whatever the gateway sent.
  const face = on.match(/<div class="adm-wal__num">([^<]*)<\/div>/)?.[1] ?? "";
  const pan = selfTest ? "4242424242424242" : face;
  ok(!/\d{5,}/.test(pan), selfTest ? "[self-test] teljes kártyaszám a képen → PIROSNAK kell lennie" : "a kártya-képen nincs 5+ jegyű szám (②)");

  const exp = strip(walletSection({ ...base, card: { ...base.card!, expMonth: 9, expYear: 2026 }, expiring: true }, sub, null));
  ok(exp.includes("LEJÁR: 09/2026") && exp.includes("fizetési linket kap"), "lejáró: LEJÁR pill + következmény (③)");

  const none = walletSection({ ...base, autoCharge: false, card: null, charges: [] }, { ...sub, autoCharge: false, cardLabel: null }, null);
  const noneT = strip(none);
  ok(noneT.includes("NINCS MENTETT KÁRTYA") && noneT.includes("fizetési link e-mailben"), "nincs kártya: pill + következő terhelés = link (③/⑦)");
  ok(noneT.includes("Kártya megadása") && !none.includes("data-mand-revoke>"), "nincs kártya: Kártya megadása, visszavonás nincs (④)");
  ok(noneT.includes("Még nem volt terhelés."), "nincs kártya: üres terhelés-lista (⑦)");

  const frozen = strip(walletSection({ ...base, frozen: true }, sub, null));
  ok(frozen.includes("A TERHELÉS NEM SIKERÜLT") && frozen.includes("A díj rendezése"), "elakadt: pill + kiút a Modulok fülre");

  const nomask = strip(walletSection({ ...base, card: { brand: null, last4: null, expMonth: null, expYear: null, savedOn: "2026-06-28" } }, sub, null));
  ok(nomask.includes("A kártya mentve van; az utolsó 4 számjegy") && !nomask.includes("····4242"), "maszk nélkül: őszinte mondat, kitalált szám nincs (②)");

  const noGw = walletSection({ ...base, canChangeCard: false }, sub, null);
  ok(!noGw.includes("data-wal-change>") && !strip(noGw).includes("Kártya cseréje"), "zárolást nem tudó átjáró: nincs csere-gomb (④)");

  const flash = strip(walletSection({ ...base, card: { brand: "MasterCard", last4: "8810", expMonth: 3, expYear: 2029, savedOn: "2026-09-24" } }, sub, "ok"));
  ok(flash.includes("Kész: a mentett kártya ezután MASTERCARD ····8810") && flash.includes("10 Ft-ot azonnal visszautaltuk") && flash.includes("legfeljebb 30 napon") && !flash.includes("zárolást feloldottuk"), "csere-siker sáv: a visszautalás igaz mondata (④/⑤)");
  ok(strip(walletSection(base, sub, "fail")).includes("A bank elutasította a megerősítést") && strip(walletSection(base, sub, "fail")).includes("nem változott"), "csere-elutasítás sáv: semmi nem változott (④)");

  ok(!walletSection(null, null, null).includes("adm-wal__face") && strip(walletSection(null, null, null)).includes("akkor jelenik meg"), "előfizetés nélkül: őszinte üres állapot");
  ok(cardExpiresBefore(9, 2026, new Date(2026, 9, 1)) && !cardExpiresBefore(9, 2026, new Date(2026, 8, 30)), "cardExpiresBefore: a hónap végéig él a kártya");
}

// ── B) TERV-SÁV — valódi kattintással ───────────────────────────────────────
console.log("B) terv-sáv kártyaválasztó (⑧) — Playwright");
{
  const modules = await getTenantModules("00000000-0000-0000-0000-000000000000").catch(() => null);
  const render = (s: SubscriptionAdminData) =>
    adminDashboard(session, content, { tab: "modulok", modules, siteUrl: "https://x.citoviso.com", previewToken: "demo", units: [], subscription: s })
      .replaceAll('href="/assets/', `href="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`)
      .replaceAll('src="/assets/', `src="${pathToFileURL(path.join(ROOT, "public/assets")).href}/`);
  const withCard = render(sub);
  const noCard = render({ ...sub, autoCharge: false, cardLabel: null });
  ok(withCard.includes('<input type="radio" name="card"') && strip(withCard).includes("Ez a kártya lesz ezután a mentett kártya"), "megbízással: a két rádió + az ígéret a sávban");
  ok(selfTest ? false : !noCard.includes('<input type="radio" name="card"'), selfTest ? "[self-test] választó megbízás nélkül → PIROS" : "megbízás nélkül: nincs kártyaválasztó");

  const tmp = await mkdtemp(path.join(tmpdir(), "wallet-check-"));
  const file = path.join(tmp, "modulok.html");
  await writeFile(file, withCard, "utf8");
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(e.message));
    await page.goto(pathToFileURL(file).href);
    await page.waitForTimeout(200);
    const box = page.locator("#adm-plan-card");
    ok(await box.isHidden(), "alapállapot: a választó rejtve (nincs fizetendő)");
    // Tick the first PAID, not-yet-owned module — that is what puts money in the bar.
    const paid = page.locator('input[name="module"][data-committed="0"][data-price]:not([data-price="0"])').first();
    if ((await paid.count()) === 0) {
      ok(false, "nincs fizetős, nem birtokolt modul a fixtúrán — a próba nem futtatható");
    } else {
      await paid.evaluate((el) => {
        (el as HTMLInputElement).checked = true;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(100);
      ok(await box.isVisible(), "fizetős modul bepipálva → a választó látszik");
      const apply = page.locator("#adm-plan-apply");
      ok(/a kártyáját .* terheljük/.test((await apply.textContent()) ?? ""), "mentett kártya kiválasztva → „a kártyáját … terheljük”");
      await page.locator('input[name="card"][value="new"]').evaluate((el) => {
        (el as HTMLInputElement).checked = true;
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForTimeout(100);
      ok(((await apply.textContent()) ?? "").includes("Fizetés másik kártyával"), "másik kártya kiválasztva → „Fizetés másik kártyával — …”");
      ok(await page.locator('input[name="card"][value="new"]').isVisible(), "a „Másik kártyával” rádió LÁTHATÓ 390 px-en");
    }
    ok(errs.length === 0, `JS-hiba nincs${errs.length ? `: ${errs.join(" | ")}` : ""}`);
  } finally {
    await browser.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

// ── C) BARION-MASZK — fetch álcázva ─────────────────────────────────────────
console.log("C) Barion GetPaymentState → kártya-maszk (②), Reserved → pending, FinishReservation");
{
  const gw = new BarionGateway("test-poskey", "shop@example.com");
  const realFetch = globalThis.fetch;
  const answers: unknown[] = [];
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(answers.shift() ?? {}), { headers: { "content-type": "application/json" } })) as typeof fetch;
  try {
    answers.push({
      Status: "Succeeded",
      TraceId: "trace-1",
      FundingInformation: { BankCard: { MaskedPan: "0425", BankCardType: "Visa", ValidThruYear: "2028", ValidThruMonth: "08" } },
    });
    const r1 = await gw.parseWebhook({ paymentId: "p1" }, {});
    ok(typeof r1 === "object" && r1?.status === "paid" && r1.card?.last4 === "0425" && r1.card.brand === "Visa" && r1.card.expMonth === 8 && r1.card.expYear === 2028, "Succeeded + BankCard → card{Visa, 0425, 08/2028}");
    answers.push({ Status: "Succeeded", FundingInformation: { BankCard: { MaskedPan: "4111 **** **** 1111", BankCardType: "MasterCard" } } });
    const r2 = await gw.parseWebhook({ paymentId: "p2" }, {});
    ok(typeof r2 === "object" && r2?.card?.last4 === "1111", "hosszabb MaskedPan → CSAK az utolsó 4 marad (②)");
    answers.push({ Status: "Succeeded" });
    const r3 = await gw.parseWebhook({ paymentId: "p3" }, {});
    ok(typeof r3 === "object" && r3?.status === "paid" && !r3.card, "kártya-adat nélkül: paid, card null (nem találunk ki)");
    answers.push({ Status: "Reserved" });
    ok((await gw.parseWebhook({ paymentId: "p4" }, {})) === "pending", "Reserved → pending (a zárolás áll)");
    answers.push({ Status: "Reserved", Transactions: [{ TransactionId: "tx-1" }] }, { Status: "Succeeded" });
    ok((await gw.finishReservation("p5", 0)) === true, "FinishReservation(0): Reserved → Succeeded → true");
    answers.push({ Status: "Reserved", Transactions: [{ TransactionId: "tx-2" }] }, { Errors: [{ ErrorCode: "X", Title: "nope" }] });
    ok((await gw.finishReservation("p6", 0)) === false, "FinishReservation hiba → false (a hívó hangosan naplóz, újrapróbál)");
    ok(!!new MockGateway().finishReservation && (await new MockGateway().parseWebhook({ gatewayRef: "m", status: "paid", card: MOCK_CARDS[1]!.id }))?.card?.last4 === "8810", "mock: a választott próbakártya maszkja a webhookban");
  } finally {
    globalThis.fetch = realFetch;
  }
}

// ── D) DB-ÚT — eldobható fixtúra ────────────────────────────────────────────
console.log("D) DB-út — card_update webhook, újrajátszás, visszavonás, order-újrahasznosítás");
const STAMP = String(process.hrtime.bigint());
let tenantId = "";
let leadId = "";
let prospectId = "";
async function reap(): Promise<void> {
  if (!tenantId) return;
  const orders = await db.selectFrom("order_intent").select("id").where("tenant_id", "=", tenantId).execute();
  for (const o of orders) await db.deleteFrom("payment").where("order_intent_id", "=", o.id as string).execute().catch(() => {});
  await db.deleteFrom("saved_card_history").where("tenant_id", "=", tenantId).execute().catch(() => {});
  await db.deleteFrom("subscription").where("tenant_id", "=", tenantId).execute().catch(() => {});
  await db.deleteFrom("order_intent").where("tenant_id", "=", tenantId).execute().catch(() => {});
  await db.deleteFrom("prospect").where("id", "=", prospectId).execute().catch(() => {});
  await db.deleteFrom("tenant").where("id", "=", tenantId).execute().catch(() => {});
  await db.deleteFrom("lead").where("id", "=", leadId).execute().catch(() => {});
}
try {
  // Own parent instead of "the first scrape_run" (a sibling could drop that under us — CASCADE).
  const { createFixtureParent } = await import("./lib/fixture-parent.mts");
  const parent = await createFixtureParent(db as never, "wallet");
  const run = { id: parent.runId };
  const lead = await db.insertInto("lead").values({ scrape_run_id: run.id as string, name: `Pénztárca-őr ${STAMP}` } as never).returning("id").executeTakeFirstOrThrow();
  leadId = lead.id as string;
  const tenant = await db.insertInto("tenant").values({ lead_id: leadId, display_name: `Pénztárca-őr ${STAMP}` } as never).returning("id").executeTakeFirstOrThrow();
  tenantId = tenant.id as string;
  const prospect = await db.insertInto("prospect").values({ lead_id: leadId, token: `walletguard-${STAMP}` }).returning("id").executeTakeFirstOrThrow();
  prospectId = prospect.id as string;
  const buyer = {
    buyer_type: "business",
    buyer_tax_number: "12345678-2-42",
    buyer_name: `Pénztárca-őr Kft. ${STAMP}`,
    buyer_country: "HU",
    buyer_zip: "8600",
    buyer_city: "Siófok",
    buyer_address: "Fő u. 1.",
    buyer_email: "or@example.com",
    vat_treatment: "aam",
  };
  // A declared buyer on a past order — createCardUpdateOrder inherits it (0029).
  await db
    .insertInto("order_intent")
    .values({ prospect_id: prospectId, tenant_id: tenantId, kind: "renewal", price: 6070, billing_period: "monthly", modules: JSON.stringify([]), status: "submitted", submitted_at: new Date(), ...buyer } as never)
    .execute();
  const periodEnd = new Date(Date.now() + 10 * 86_400_000);
  await db
    .insertInto("subscription")
    .values({
      tenant_id: tenantId,
      status: "active",
      current_period_start: new Date(Date.now() - 20 * 86_400_000),
      current_period_end: periodEnd,
      anchor_date: periodEnd,
      billing_period: "monthly",
      payment_method: "token",
      recurrence_token: `tok-old-${STAMP}`,
      card_brand: "Visa",
      card_last4: "1111",
      card_exp_month: 1,
      card_exp_year: 2027,
      card_saved_at: new Date(Date.now() - 30 * 86_400_000),
    } as never)
    .execute();

  const w0 = await getWalletAdmin(tenantId);
  ok(!!w0 && w0.autoCharge && w0.card?.last4 === "1111" && w0.history.length === 0 && w0.canChangeCard, "kiindulás: Visa ····1111, előzmény nincs, csere lehetséges (mock tud zárolást)");

  // The card-change order + its hold-type pay-link.
  const o1 = await createCardUpdateOrder(tenantId);
  ok(o1.ok && !!o1.orderId, "createCardUpdateOrder: order született (öröklött vevő)");
  const link = await requestPayment(o1.orderId!);
  ok(!!link?.payUrl, "requestPayment(card_update): pay-link (a mock zárolást tud)");
  const payRow = await db.selectFrom("payment").select(["id", "initiates_recurrence", "amount"]).where("id", "=", link!.paymentId).executeTakeFirstOrThrow();
  ok(payRow.initiates_recurrence === true && payRow.amount === CARD_VERIFY_AMOUNT_HUF, `a fizetés-sor: initiates_recurrence=true, ${CARD_VERIFY_AMOUNT_HUF} Ft`);
  const o2 = await createCardUpdateOrder(tenantId);
  ok(o2.ok && o2.orderId === o1.orderId, "második kattintás: a nyitott rendelést hasznosítja újra (nincs második zárolás)");

  // The webhook: the new card becomes the mandate, the old one goes to history.
  const r = await applyWebhookResult({ gatewayRef: link!.gatewayRef, status: "paid", traceId: "trace-new", card: { brand: "MasterCard", last4: "8810", expMonth: 3, expYear: 2029 } });
  ok(r.ok && r.activated === true, "card_update webhook: ok + activated (a megbízás eltárolva)");
  const s1 = await db.selectFrom("subscription").selectAll().where("tenant_id", "=", tenantId).executeTakeFirstOrThrow();
  ok(s1.recurrence_token === payRow.id && s1.recurrence_trace_id === "trace-new" && s1.payment_method === "token", "token = az új fizetés id-je, trace eltárolva");
  ok(s1.card_brand === "MasterCard" && s1.card_last4 === "8810" && s1.card_exp_month === 3 && s1.card_exp_year === 2029, "maszk = az új kártya");
  const h1 = await db.selectFrom("saved_card_history").selectAll().where("tenant_id", "=", tenantId).execute();
  ok(h1.length === 1 && h1[0]!.end_reason === "replaced" && h1[0]!.card_last4 === "1111", "előzmény: a régi ····1111 „replaced”");
  const inv = await db.selectFrom("invoice").select("id").where("payment_id", "=", payRow.id).execute();
  ok(inv.length === 0, "card_update: számla NEM készült (pénz nem mozdult)");
  // Replay must not manufacture a second history row or move the token.
  const r2 = await applyWebhookResult({ gatewayRef: link!.gatewayRef, status: "paid", traceId: "trace-new", card: { brand: "MasterCard", last4: "8810", expMonth: 3, expYear: 2029 } });
  const h2 = await db.selectFrom("saved_card_history").selectAll().where("tenant_id", "=", tenantId).execute();
  ok(r2.ok && r2.alreadySettled === true && h2.length === 1, "ugyanaz a webhook újra: idempotens, előzmény marad 1");

  const w1 = await getWalletAdmin(tenantId);
  ok(!!w1 && w1.card?.last4 === "8810" && w1.history.length === 1 && w1.history[0]!.reason === "replaced", "getWalletAdmin: az új kártya + 1 „cserélve” előzmény");
  ok(!!w1 && !w1.charges.some((c) => c.orderKind === "card_update"), "a zárolás NEM szerepel terhelésként (⑦)");

  // Revoke: token + mask dropped, history says "revoked".
  ok(await revokeAutoCharge(tenantId), "revokeAutoCharge: true");
  const s2 = await db.selectFrom("subscription").selectAll().where("tenant_id", "=", tenantId).executeTakeFirstOrThrow();
  ok(s2.recurrence_token === null && s2.card_last4 === null && s2.card_saved_at === null && s2.payment_method === "invoice", "visszavonás: token + maszk nullázva, díjbekérős");
  const h3 = await db.selectFrom("saved_card_history").selectAll().where("tenant_id", "=", tenantId).orderBy("ended_at", "desc").execute();
  ok(h3.length === 2 && h3[0]!.end_reason === "revoked" && h3[0]!.card_last4 === "8810", "előzmény: ····8810 „revoked” (2 sor)");
  const w2 = await getWalletAdmin(tenantId);
  ok(!!w2 && !w2.autoCharge && w2.card === null && w2.history.length === 2, "getWalletAdmin visszavonás után: nincs kártya, 2 előzmény");

  // Upsell "másik kártyával": the pay-link initiates a token even though the kind is upsell.
  const up = await db
    .insertInto("order_intent")
    .values({ prospect_id: prospectId, tenant_id: tenantId, kind: "upsell", price: 327, billing_period: "monthly", modules: JSON.stringify(["reviews"]), status: "submitted", submitted_at: new Date(), ...buyer } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const l1 = await requestPayment(up.id as string, { newCard: true });
  const p1 = await db.selectFrom("payment").select("initiates_recurrence").where("id", "=", l1!.paymentId).executeTakeFirstOrThrow();
  ok(p1.initiates_recurrence === true, "upsell newCard: a pay-link tokent kér (⑧)");
  const up2 = await db
    .insertInto("order_intent")
    .values({ prospect_id: prospectId, tenant_id: tenantId, kind: "upsell", price: 327, billing_period: "monthly", modules: JSON.stringify(["reviews"]), status: "submitted", submitted_at: new Date(), ...buyer } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const l2 = await requestPayment(up2.id as string);
  const p2 = await db.selectFrom("payment").select("initiates_recurrence").where("id", "=", l2!.paymentId).executeTakeFirstOrThrow();
  ok(p2.initiates_recurrence === false, "sima upsell pay-link: NEM kér tokent (a régi viselkedés áll)");
} finally {
  await reap();
  await db.destroy().catch(() => {});
}

if (failures) {
  console.error(`\nwallet-check: ${failures} sértés.`);
  if (selfTest) {
    console.log("✅ --self-test: az őr KÉPES pirosra menni (a fenti sértéseket VÁRTUK).");
    process.exit(0);
  }
  process.exit(1);
}
if (selfTest) {
  console.error("\n⛔ --self-test: a hibás fixtúrán sem találtam sértést — az őr nem mér.");
  process.exit(1);
}
console.log("✅ wallet-check: a Pénztárca a kontraktus szerint viselkedik (render · terv-sáv · Barion-maszk · DB-út).");
