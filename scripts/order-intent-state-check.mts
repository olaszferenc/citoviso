// Regression gate: the operator's "Csomag-igények" panel tells the truth about each
// order, and the pay-request button asks about THE order it sits on (Elek K-1,
// owner-approved 2026-10-02).
//
// WHAT WAS MEASURED (production lead e629826b…, 2026-10-01):
//   • both order intents said "submitted" (green) — the PAID one too: nothing ever
//     moves order_intent.status forward after a payment;
//   • next to the cancelled 97 Ft attempt stood "Fizetési kérés küldése ▸" although a
//     later order of the same lead was paid; and the route behind it picked the
//     lead's NEWEST submitted order (the paid one), which requestPayment refused;
//   • the help line said "Barion helyén mock … Auto-terhelés (MIT) = 2. fázis" while
//     production runs real Barion with stored card tokens.
//
// Run:  npx tsx scripts/order-intent-state-check.mts
//       npx tsx scripts/order-intent-state-check.mts --self-test
//         (source rules on origin's PRE-FIX files + a broken "replaced" rule — RED)

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${cond ? "" : `\n     ↳ ${detail}`}`);
}
const src = (p: string) => (SELF_TEST ? execFileSync("git", ["show", `8493d321:${p}`], { encoding: "utf8" }) : readFileSync(p, "utf8"));
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const views = await import("../src/console/views.js");
// Self-test: the "replaced" rule blinded (a later paid order no longer counts).
const state = SELF_TEST
  ? ((o: never, p: never[]) => views.orderIntentState(o, p, [])) as typeof views.orderIntentState
  : views.orderIntentState;

// ── 1. THE LIVE SHAPE ────────────────────────────────────────────────────────
const paidOrder = { id: "o-186", kind: "initial", status: "submitted", createdAt: "2026-10-01T08:29:00Z" };
const cancelledOrder = { id: "o-97", kind: "initial", status: "submitted", createdAt: "2026-10-01T08:28:00Z" };
const orders = [paidOrder, cancelledOrder];
const pays = [
  { orderIntentId: "o-186", status: "paid", createdAt: "2026-10-01T08:29:10Z" },
  { orderIntentId: "o-97", status: "cancelled", createdAt: "2026-10-01T08:28:05Z" },
];
const sPaid = state(paidOrder, pays, orders);
const sOld = state(cancelledOrder, pays, orders);
ok(sPaid.key === "paid" && !sPaid.canRequest, "a fizetett igény: „fizetve”, nincs fizetés-kérő gomb", JSON.stringify(sPaid));
ok(sOld.key === "replaced" && !sOld.canRequest, "a megszakított, de később fizetett leadé: „lezárva — egy későbbi rendelés fizetve”, NINCS gomb", JSON.stringify(sOld));

// ── 2. THE CASES THAT MUST KEEP THE BUTTON ───────────────────────────────────
const lone = state(cancelledOrder, [pays[1]!], [cancelledOrder]);
ok(lone.key === "cancelled" && lone.canRequest, "még nem fizetett lead, megszakított kísérlet: „megszakítva” + gomb", JSON.stringify(lone));
const fresh = state(cancelledOrder, [], [cancelledOrder]);
ok(fresh.key === "submitted" && fresh.canRequest, "fizetés nélküli igény: „beküldve” + gomb", JSON.stringify(fresh));
const failedOne = state(cancelledOrder, [{ orderIntentId: "o-97", status: "failed", createdAt: "2026-10-01T08:28:05Z" }], [cancelledOrder]);
ok(failedOne.key === "failed" && failedOne.canRequest, "valódi elutasítás: „sikertelen” + gomb", JSON.stringify(failedOne));
const upsell = { id: "o-up", kind: "upsell", status: "submitted", createdAt: "2026-10-02T08:00:00Z" };
const older = { id: "o-up0", kind: "upsell", status: "submitted", createdAt: "2026-10-01T07:00:00Z" };
const sUp = state(older, pays, [older, paidOrder, upsell]);
ok(sUp.key !== "replaced", "egy MÁSIK fajta (initial) fizetése nem zár le egy bővítés-igényt", JSON.stringify(sUp));

// ── 3. THE RENDERED PANEL ────────────────────────────────────────────────────
if (!SELF_TEST) {
  const mk = (o: typeof paidOrder, price: number) => ({ ...o, price, billingPeriod: "monthly", modules: ["gallery", "enquiry"],
    submittedAt: o.createdAt, domainType: "citoviso_sub", domainName: null, commitmentMonths: null });
  const pv = (p: (typeof pays)[number], id: string) => ({ ...p, paymentId: id, amount: 97, period: "monthly", payUrl: null,
    paidAt: p.status === "paid" ? p.createdAt : null, invoiceNumber: null, invoiceFailure: null });
  const html = views.orderIntentsPanel([mk(paidOrder, 186), mk(cancelledOrder, 97)], [pv(pays[0]!, "p1"), pv(pays[1]!, "p2")], "lead-1");
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  ok(!/request-payment/.test(html), "a renderelt panelen (Elek-alak) nincs „Fizetési kérés küldése”", text.slice(0, 400));
  ok(!/\bsubmitted\b/.test(text), "nincs nyers „submitted” DB-szó a panelen", text.slice(0, 400));
  for (const w of ["fizetve", "lezárva — egy későbbi rendelés fizetve", "fizetés: megszakítva", "a vevő visszalépett a fizetőoldalon"]) {
    ok(text.includes(w), `a panel kiírja: „${w}”`, text.slice(0, 400));
  }
  const unpaid = views.orderIntentsPanel([mk(cancelledOrder, 97)], [pv(pays[1]!, "p2")], "lead-1");
  ok(/name="orderId" value="o-97"/.test(unpaid), "a gomb a SAJÁT igényét nevezi meg (orderId)", unpaid.slice(0, 400));
}

// ── 4. SOURCE RULES: route + help text ───────────────────────────────────────
const v = code(src("src/console/views.ts"));
ok(!v.includes("Barion helyén mock") && !v.includes("Auto-terhelés (MIT) = 2. fázis"), "a súgó nem állít mockot / „2. fázis” MIT-et");
const route = code(src("src/console/" + "server.ts"));
const at = route.indexOf("const reqPayMatch");
ok(at > -1 && /get\("orderId"\)/.test(route.slice(at, at + 1200)), "a fizetés-kérő route a gomb saját igényére (orderId) kér fizetést");

console.log(failed ? `\n✗ ${failed} hiba` : "\n✓ a csomag-igények panelje igazat mond, a gomb a saját sorára kér");
if (SELF_TEST) {
  if (!failed) { console.log("⛔ ÖNTESZT: a javítás előtti állapotot ZÖLDNEK látta — a kapu vak"); process.exit(1); }
  console.log("✓ ÖNTESZT: a javítás előtti állapot pirosat adott"); process.exit(0);
}
process.exit(failed ? 1 : 0);
