// CSAK-MOBILOS VEVŐ BELÉPŐJE — aki MMS/SMS-ből jött és fizetett, kapjon belépést, és a
// sikerlap ne állítson olyat, ami nem történt meg (ADR-0366, Elek 10-11 B2).
//
//   EMAIL_PROVIDER=mock PAYMENT_GATEWAY=mock npx tsx scripts/mobile-buyer-login-check.mts
//
// ⛔⛔ MIÉRT (mérve 2026-10-11, Elek). Egy csak-mobilszámos lead (prospect.contact_email = NULL)
// a pénztárban megadta az e-mail-címét, fizetett — a számla megjött, a belépés NEM, mert az
// activate() csak a prospect címére adott belépést. A sikerlap közben ezt írta: „A
// felhasználónevet és a jelszó-beállító linket e-mailben küldtük.” Ez a leadek nagy része.
//
// MIT MÉR (VALÓDI úton, saját fixtúrán, mock átjáróval és mock postával):
//   ① a rendelés → pay-link → mock „paid” visszahívás → activate() végigmegy,
//   ② a tenant-belépés a vevő pénztári címére (order_intent.buyer_email) születik,
//   ③ a sikerlap-összegző (getActivationSummary) felhasználónevet és ezt a címet adja,
//   ④ a sikerlap (payResultPage) a címet NEVEZI MEG;
//   ⑤ belépés NÉLKÜL (nincs felhasználó) a sikerlap NEM állítja, hogy e-mailben küldtük,
//      és nem kínál „Belépek” gombot.
// A régi kódon ② ③ ④ PIROS (mutációval mérve), ⑤ a régi szöveggel PIROS.
process.env.CIT_SHOT = "1";
import { randomBytes } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

const { config } = await import("../src/config.js");
if (config.emailProvider !== "mock" || (process.env.PAYMENT_GATEWAY ?? "mock").toLowerCase() !== "mock") {
  console.error("⛔ mobile-buyer-login-check: csak mock postával és mock átjáróval fut — EMAIL_PROVIDER=mock PAYMENT_GATEWAY=mock");
  process.exit(2);
}

const { db } = await import("../src/db/client.js");
const { validateBuyer } = await import("../src/billing/buyer.js");
const { approveArtifactForBuyerOrder, recordOrderIntent } = await import("../src/console/data.js");
const { applyWebhookResult, getActivationSummary, requestPayment } = await import("../src/payment/service.js");
const { payResultPage } = await import("../src/console/views.js");
const { createFixtureParent } = await import("./lib/fixture-parent.mts");

let failures = 0;
const check = (label: string, ok: boolean, detail = ""): void => {
  if (!ok) failures++;
  console.log(`  ${ok ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const stamp = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
const BUYER_EMAIL = `mobilvevo-${stamp}@example.invalid`;
const MOCK_FILE = path.resolve(process.cwd(), `sites/_mobilelogin_${stamp}.html`);
const parent = await createFixtureParent(db as never, "mobilelogin");
const tenants: string[] = [];
try {
  await writeFile(MOCK_FILE, "<!doctype html><html><head><title>t</title></head><body><main>mock</main></body></html>");
  const lead = await db
    .insertInto("lead")
    .values({
      scrape_run_id: parent.runId,
      name: `_mobilelogin_${stamp} Porta`,
      raw: JSON.stringify({ guard: "mobile-buyer-login-check" }),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const art = await db
    .insertInto("mock_artifact")
    .values({
      lead_id: lead.id,
      path: `sites/_mobilelogin_${stamp}.html`,
      status: "approved",
      inputs: JSON.stringify({
        engine: "composition",
        recipe: { template: "editorial", skin: "", archetype: "", sections: [] },
        siteData: {
          name: `_mobilelogin_${stamp} Porta`,
          tagline: "Csend a domb alatt",
          intro: "Csendes porta a falu végén.",
          highlights: ["Saját kert"],
          photos: [{ url: "/uploads/mobilelogin-a.jpg", alt: "kert", provenance: "owner" }],
          contact: { phone: "+36 30 999 0199", address: "8274 Köveskál, Fő utca 1." },
        },
      }),
    } as never)
    .returning("id")
    .executeTakeFirstOrThrow();
  const token = `mobilelogin${stamp}xxxxxxxx`.replace(/[^A-Za-z0-9_-]/g, "");
  // ⛔ The point of the case: an MMS/SMS-only prospect — NO contact_email.
  await db
    .insertInto("prospect")
    .values({ lead_id: lead.id, mock_artifact_id: art.id, token, status: "sent", sent_at: new Date(), contact_email: null } as never)
    .execute();

  const v = await validateBuyer(
    {
      buyer_type: "individual",
      buyer_name: "Teszt Elek",
      buyer_country: "HU",
      buyer_zip: "8274",
      buyer_city: "Köveskál",
      buyer_address: "Fő utca 1.",
      buyer_email: BUYER_EMAIL,
      withdrawal_waiver: true,
      terms_accepted: true,
    },
    { requireTerms: false },
  );
  if (!v.ok) throw new Error(`az őr vevő-adata érvénytelen: ${JSON.stringify(v.errors)}`);
  const rec = await recordOrderIntent({
    artifactId: art.id,
    modules: [],
    billingPeriod: "monthly",
    price: 3900,
    domainType: "citoviso_sub",
    domainName: null,
    commitmentMonths: null,
    photoRightsDeclared: true,
    recurringConsent: true,
    buyer: v.value,
    prospectToken: token,
  });
  if (!rec) throw new Error("a rendelés-rögzítés nem adott vissza rekordot");
  await approveArtifactForBuyerOrder(art.id, rec.orderIntentId);
  await requestPayment(rec.orderIntentId);
  const pay = await db
    .selectFrom("payment")
    .select("gateway_ref")
    .where("order_intent_id", "=", rec.orderIntentId)
    .executeTakeFirstOrThrow();
  const ref = String(pay.gateway_ref);
  const result = await applyWebhookResult({ gatewayRef: ref, status: "paid" });
  check("① a mock fizetés aktivál", result.ok === true && result.activated === true, JSON.stringify(result));

  const tenant = await db.selectFrom("tenant").select("id").where("lead_id", "=", lead.id).executeTakeFirst();
  if (tenant) tenants.push(tenant.id);
  const user = tenant
    ? await db.selectFrom("tenant_user").select(["username", "contact_email"]).where("tenant_id", "=", tenant.id).executeTakeFirst()
    : undefined;
  check(
    "② a belépés a vevő pénztári címére született (prospect-cím nélkül is)",
    user?.contact_email === BUYER_EMAIL,
    `tenant_user: ${user ? `${user.username} → ${user.contact_email}` : "NINCS"}`,
  );
  const sum = await getActivationSummary(ref);
  check(
    "③ a sikerlap-összegző felhasználónevet és a vevő címét adja",
    !!sum?.username && sum.contactEmail === BUYER_EMAIL,
    `${sum?.username ?? "—"} · ${sum?.contactEmail ?? "—"}`,
  );
  const page = payResultPage(true, true, { ...(sum ?? {}), loginUrl: "https://example.invalid/login" } as never);
  check("④ a sikerlap megnevezi a címet, ahová a belépés ment", page.includes(BUYER_EMAIL));

  // ⑤ No login issued at all (no address anywhere) — the page may not claim a mail.
  const none = payResultPage(true, true, {
    siteUrl: "https://example.invalid",
    username: null,
    contactEmail: null,
    loginUrl: "https://example.invalid/login",
    supportEmail: "segitseg@example.invalid",
  } as never);
  const flat = none.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  check(
    "⑤ belépés nélkül a lap NEM állítja, hogy e-mailben küldtük",
    !/e-mailben küldtük|Elküldtük a belépési adatait|e-mailben is elküldtük/.test(flat),
    flat.match(/[^.]*e-mail[^.]*\./g)?.join(" | ") ?? "",
  );
  check("⑤ …kimondja, hogy a belépés még nincs kiadva, és kinek írjon", /még nem tudtuk kiadni/.test(flat) && flat.includes("segitseg@example.invalid"));
  check("⑤ …és nem kínál „Belépek és szerkesztem” gombot", !/<a class="pd-cta"[^>]*>[^<]*Belépek és szerkesztem/.test(none));
} finally {
  await rm(MOCK_FILE, { force: true });
  for (const t of tenants) {
    await db.deleteFrom("tenant_user").where("tenant_id", "=", t).execute().catch(() => {});
    await rm(path.resolve(process.cwd(), "sites", t), { recursive: true, force: true });
  }
  await parent.drop();
  await db.destroy();
}

if (failures) {
  console.error(`\n⛔ mobile-buyer-login-check: ${failures} hiba`);
  process.exit(1);
}
console.log("\n✅ mobile-buyer-login-check: a csak-mobilos vevő is kap belépést, és a sikerlap igazat mond");
