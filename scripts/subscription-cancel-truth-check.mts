// Lemondott előfizetés — minden felület ugyanazt mondja (Elek-szállásadó P-4, 2026-10-14).
// Az „Előfizetés lemondása” után a Modulok fül („Következő számla (2026. 11. 29.) 5 180 Ft …
// díjfizetési kötelezettség változatlan”), a Pénztárca („Következő terhelés … fizetési link
// e-mailben”), az oldalsáv („megújul 2026. 11. 29.”) és a visszavonás-megerősítő is terhelést
// ígért; a T−3 „megújul” levél és a megújítási rendelés is létrejött volna.
//   ① Pénztárca: „zárul”, nincs következő terhelés, nincs „3 nappal” ígéret; a megerősítő sem ígér fizetést;
//   ② Modulok fül: „Következő számla: nincs”, a megbízás-blokk és a megerősítő a zárást mondja;
//   ③ oldalsáv: „zárul …, nem terhelünk”;
//   ④ a számlázási létra: lemondásnál T−3-kor sincs rendelés / levél (forrás-ellenőrzés);
// mindegyik negatív kontrollal (lemondás nélkül a régi ígéret áll).
// Futtatás: npx tsx scripts/subscription-cancel-truth-check.mts
import { readFile } from "node:fs/promises";
import path from "node:path";

const { adminDashboard, walletSection } = await import("../src/server/adminViews.js");
type WalletAdminData = import("../src/tenant/wallet.js").WalletAdminData;
type SubscriptionAdminData = import("../src/tenant/subscriptionAdmin.js").SubscriptionAdminData;

let fail = 0;
const check = (n: string, c: boolean, d?: unknown): void => {
  console.log(`${c ? "  ✓" : "  ✗"} ${n}${c || d === undefined ? "" : ` — ${String(d).slice(0, 300)}`}`);
  if (!c) fail++;
};
// The visible text: script templates (the module-purchase confirm card) are not on the screen.
const strip = (html: string): string =>
  html.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const session = { tenantId: "demo", tenantUserId: "demo-user", username: "elek", displayName: "Őr Vendégház", contactEmail: "or@example.com" } as unknown as Parameters<typeof adminDashboard>[0];
const content = { name: "Őr Vendégház", tagline: "", intro: "…", highlights: [], photos: [], usingOwnPhotos: true, status: "live", previewPath: null } as unknown as Parameters<typeof adminDashboard>[1];
const sub: SubscriptionAdminData = {
  status: "active", periodEnd: "2026-11-29", renewDay: 29, nextInvoiceTotal: 5180, nextChargeTotal: 5180, nextInvoiceItems: [],
  payUrl: null, arrears: null, closesOn: "2026-12-29", frozenOn: null, restoredOn: null, settled: null, cancelAtPeriodEnd: false,
  billingPeriod: "monthly", pendingAnnual: false, pendingEffectiveDate: null, annualTotal: 51800, annualSavings: 10360, annualFreeMonths: 2,
  autoCharge: true, cardLabel: "Visa ····4242", coupon: null,
};
const wal: WalletAdminData = {
  autoCharge: true, card: { brand: "Visa", last4: "4242", expMonth: 8, expYear: 2028, savedOn: "2026-10-14" }, expiring: false,
  nextChargeOn: "2026-11-29", frozen: false, charges: [], history: [], verifyAmount: 103, canChangeCard: true,
};
const cancelled = { ...sub, cancelAtPeriodEnd: true };
const CLOSE = /lemondta: .{0,30}napján zárul\. Nem terhelünk, és fizetési linket sem küldünk\./;

console.log("\n① Pénztárca");
{
  const w = strip(walletSection(wal, cancelled, null, "hu"));
  check("⭐ kimondja: lemondta, zárul, nem terhelünk", CLOSE.test(w), w.slice(0, 400));
  check("⭐ „Következő terhelés nincs”", /Következő terhelés nincs/.test(w));
  check("⭐ nincs „3 nappal e-mailt küldünk” ígéret", !/terhelés előtt 3 nappal/.test(w));
  check("⭐ a visszavonás-megerősítő nem ígér fizetési linket / felfüggesztést", !/Ezután Önnek kell fizetnie/.test(w) && !/felfüggesztjük/.test(w));
  const noCard = strip(walletSection({ ...wal, autoCharge: false, card: null }, { ...cancelled, autoCharge: false, cardLabel: null }, null, "hu"));
  check("kártya nélkül sem: „díjfizetési kötelezettség változatlan” / „fizetési link e-mailben”", !/kötelezettség változatlan/.test(noCard) && !/fizetési link e-mailben/.test(noCard) && CLOSE.test(noCard), noCard.slice(0, 300));
  const live = strip(walletSection(wal, sub, null, "hu"));
  check("negatív kontroll: lemondás nélkül a régi ígéret áll", /terhelés előtt 3 nappal/.test(live) && !CLOSE.test(live));
}
console.log("\n② Modulok fül");
{
  const { getTenantModules } = await import("../src/tenant/modules.js");
  const modules = await getTenantModules("00000000-0000-0000-0000-000000000000").catch(() => null);
  const page = (s: SubscriptionAdminData) => strip(adminDashboard(session, content, { tab: "modulok", modules, siteUrl: "https://x.citoviso.com", previewToken: "demo", units: [], subscription: s } as never));
  const m = page(cancelled);
  check("⭐ „Következő számla nincs”, nincs dátumos összeg", /Következő számla nincs/.test(m) && !/Következő számla \(/.test(m), m.slice(m.indexOf("Következő"), m.indexOf("Következő") + 200));
  check("⭐ a megbízás-blokk a zárást mondja, nem a fordulónapi levonást", CLOSE.test(m) && !/magától levonjuk a díjat/.test(m));
  check("⭐ a megerősítő nem ígér fordulónapi fizetést", !/Ezután Önnek kell fizetnie/.test(m));
  check("⭐ nincs „A következő számla tételei” lenyíló", !/A következő számla tételei/.test(m));
  const mOff = page({ ...cancelled, autoCharge: false, cardLabel: null });
  check("díjbekérős fiók: nincs „díjfizetési kötelezettség változatlan”", !/kötelezettség változatlan/.test(mOff) && CLOSE.test(mOff));
  const live = page(sub);
  check("negatív kontroll: lemondás nélkül „Következő számla (…)” és a levonás", /Következő számla \(/.test(live) && /magától levonjuk a díjat/.test(live));
}
console.log("\n③ oldalsáv");
{
  const side = (cancel: boolean) =>
    strip(adminDashboard(session, content, { tab: "attekintes", modules: null, siteUrl: "https://x.citoviso.com", previewToken: "demo", units: [], subscription: sub, subSummary: { status: "active", billingPeriod: "monthly", periodStart: "2026-10-29", periodEnd: "2026-11-29", cancelAtPeriodEnd: cancel } } as never));
  const c = side(true);
  check("⭐ „zárul …, nem terhelünk”, nincs „megújul”", /zárul .{0,20}, nem terhelünk/.test(c) && !/megújul/.test(c), c.slice(c.indexOf("előfizetés"), c.indexOf("előfizetés") + 160));
  check("negatív kontroll: lemondás nélkül „megújul”", /megújul/.test(side(false)));
}
console.log("\n④ számlázási létra");
{
  const src = await readFile(path.resolve(import.meta.dirname, "../src/payment/billing.ts"), "utf8");
  const adv = src.slice(src.indexOf("async function advanceOne"), src.indexOf("const dueSteps", src.indexOf("async function advanceOne")));
  check("⭐ lemondásnál a létra a fordulónap ELŐTT sem fut (nincs T−3 levél)", /if \(sub\.cancelAtPeriodEnd\) \{[\s\S]*?return 0;\s*\}/.test(adv), adv.slice(0, 400));
  const mint = src.slice(src.indexOf("async function findOrCreateRenewalOrder"), src.indexOf("async function findOrCreateRenewalOrder") + 400);
  check("⭐ lemondásnál nincs megújítási rendelés (egyik úton sem)", /if \(sub\.cancelAtPeriodEnd\) return null;/.test(mint));
}
const { pool } = await import("../src/db/client.js");
await pool.end();
console.log(fail ? `\n⛔ SUBSCRIPTION-CANCEL-TRUTH: ${fail} bukás` : "\n🟢 SUBSCRIPTION-CANCEL-TRUTH: lemondás után minden felület a zárást mondja; nincs T−3 levél, nincs megújítási rendelés");
process.exit(fail ? 1 : 0);
